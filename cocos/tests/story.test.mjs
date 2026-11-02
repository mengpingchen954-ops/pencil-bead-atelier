import test from "node:test";
import assert from "node:assert/strict";
import { STORIES, ORDERS } from "../assets/scripts/content.ts";
import { freshSave, normalizeSave } from "../assets/scripts/model.ts";
import { storyUnlocked, pendingStory, finishStory, storyEvidence, mediaPath, STORY_STOPS, storyRoute } from "../assets/scripts/story.ts";

test("story unlocks use stable order and furniture IDs, not the number of scenes seen", () => {
  const save = freshSave();
  assert.equal(pendingStory(save).id, "old-table");
  assert.equal(storyUnlocked(save, STORIES[1]), false);
  assert.equal(storyUnlocked({ ...save, completed: ["sea"] }, STORIES[1]), false);
  assert.equal(storyUnlocked({ ...save, completed: ["daisy"] }, STORIES[1]), true);
  const keepsake = STORIES.find((s) => s.id === "keepsake-box");
  assert.equal(storyUnlocked(save, keepsake), false);
  assert.equal(storyUnlocked({ ...save, upgrades: { ...save.upgrades, desk: 1 } }, keepsake), true);
});

test("finishing and replaying story collect records once without changing earned resources", () => {
  const save = { ...freshSave(), completed: ["daisy"], coins: 260 };
  assert.equal(finishStory(save, "own-name"), save);
  assert.equal(finishStory(save, "missing-scene"), save);
  const next = finishStory(save, "first-receipt");
  assert.deepEqual(next.inventory, save.inventory);
  assert.equal(next.coins, save.coins);
  assert.equal(next.rep, save.rep);
  assert.deepEqual(storyEvidence(next).map((s) => s.id), ["first-receipt"]);
  assert.equal(finishStory(next, "first-receipt"), next);
  assert.deepEqual(save.seenStories, []);
});

test("old saves retain all progress and leave rewritten scenes available to read", () => {
  const old = { ...freshSave(), coins: 543, completed: ORDERS.map((o) => o.id), lastStory: 6 };
  delete old.seenStories;
  const migrated = normalizeSave(old);
  assert.equal(migrated.coins, 543);
  assert.equal(migrated.completed.length, 6);
  assert.deepEqual(migrated.seenStories, []);
  const bad = normalizeSave({ ...freshSave(), seenStories: ["old-table", "old-table", "own-name", null, "invalid"] });
  assert.deepEqual(bad.seenStories, ["old-table"]);
});

test("media URLs stay under the game repository path", () => {
  assert.equal(mediaPath("videos/opening.mp4", "/pencil-bead-atelier/"), "/pencil-bead-atelier/videos/opening.mp4");
  for (const path of ["", null, 3, "https://example.com/a.mp4", "/videos/a.mp4", "videos/../a.mp4", "videos/%2e%2e/a", "videos/a?x=1", "videos/a\\b"]) {
    assert.equal(mediaPath(path, "./"), "");
  }
  assert.equal(new Set(STORIES.map((s) => s.id)).size, STORIES.length);
});

test('story route groups every existing main scene once, derives locks from exact commissions and never changes saves',()=>{
 const save=freshSave(),before=JSON.stringify(save),route=storyRoute(save);
 assert.equal(route.currentId,'family');assert.equal(route.nextStoryId,'old-table');assert.equal(route.read,0);assert.equal(route.total,7);
 assert.deepEqual(route.stops.filter(s=>s.unlocked).map(s=>s.id),['family']);
 assert.deepEqual(STORY_STOPS.flatMap(s=>s.scenes),STORIES.filter(s=>!s.furniture).map(s=>s.id));
 assert.equal(storyRoute({...save,completed:['rose']}).stops.find(s=>s.id==='workshop').unlocked,false);
 assert.match(route.stops.find(s=>s.id==='workshop').hint,/给奶奶的一朵花/);assert.equal(JSON.stringify(save),before);
 const earned=storyRoute({...save,completed:['daisy'],seenStories:['old-table']});assert.equal(earned.currentId,'workshop');assert.equal(earned.nextStoryId,'first-receipt');assert.equal(earned.read,1);
});

test('route reading progress excludes furniture stories and completed maps keep the final milestone',()=>{
 const save={...freshSave(),completed:ORDERS.map(o=>o.id),seenStories:STORIES.map(s=>s.id)},route=storyRoute(save);
 assert.equal(route.read,7);assert.equal(route.total,7);assert.equal(route.nextStoryId,'');assert.equal(route.currentId,'tomorrow');assert.ok(route.stops.every(s=>s.read&&s.unlocked));
 assert.equal(storyRoute({...freshSave(),seenStories:['grandma-chair']}).read,0);
});
