import test from "node:test";
import assert from "node:assert/strict";
import { STORIES, ORDERS } from "../src/content.js";
import { freshSave, normalizeSave } from "../src/model.js";
import { storyUnlocked, pendingStory, finishStory, storyEvidence, mediaPath } from "../src/story.js";

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
