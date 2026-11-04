// @ts-nocheck
// Rules and narrative retained from the original game; engine-independent.
import { STORIES, ORDERS } from "./content.ts";

export function storyUnlocked(save, scene) {
  if (!scene) return false;
  if (scene.furniture) return save.upgrades[scene.furniture] >= 1;
  const sold=save.commerce?.works.filter(w=>w.status==='sold').length||0;
  const index=ORDERS.findIndex(o=>o.id===scene.afterOrder);
  return !scene.afterOrder || save.completed.includes(scene.afterOrder) ||
    sold>0 && index>=0 && save.completed.length+sold>=index+1;
}

export function pendingStory(save) {
  return STORIES.find((scene) =>
    storyUnlocked(save, scene) && !save.seenStories.includes(scene.id),
  );
}

export function finishStory(save, id) {
  const scene = STORIES.find((s) => s.id === id);
  if (!storyUnlocked(save, scene) || save.seenStories.includes(id)) return save;
  return { ...save, seenStories: [...save.seenStories, id] };
}

export function storyEvidence(save) {
  return STORIES.filter((s) => s.evidence && save.seenStories.includes(s.id));
}

export const STORY_STOPS = [
  {id:'family',name:'祖孙家',scenes:['old-table']},
  {id:'workshop',name:'旧工作间',scenes:['first-receipt','stolen-design']},
  {id:'shop',name:'饰品小店',scenes:['design-record','unfair-contract']},
  {id:'name',name:'独立参展',scenes:['own-name']},
  {id:'tomorrow',name:'新的明天',scenes:['first-independence']},
];

// The map presents the existing main story; it never unlocks places or grants rewards.
export function storyRoute(save) {
  const stops=STORY_STOPS.map(stop=>{
    const scenes=stop.scenes.map(id=>STORIES.find(s=>s.id===id));
    const unlocked=scenes.some(s=>storyUnlocked(save,s)),read=scenes.every(s=>save.seenStories.includes(s.id));
    const needed=scenes.find(s=>!storyUnlocked(save,s));
    const order=ORDERS.find(o=>o.id===needed?.afterOrder);
    return {...stop,unlocked,read,hint:order?'累计售出 '+(ORDERS.indexOf(order)+1)+' 件作品':'故事已解锁'};
  });
  const main=STORIES.filter(s=>!s.furniture),next=main.find(s=>storyUnlocked(save,s)&&!save.seenStories.includes(s.id));
  const current=stops.find(s=>s.scenes.includes(next?.id))||stops.filter(s=>s.unlocked).slice(-1)[0];
  return {stops,currentId:current.id,nextStoryId:next?.id||'',read:main.filter(s=>save.seenStories.includes(s.id)).length,total:main.length};
}

// Keep media relative to the game so GitHub Pages repository paths keep working.
export function mediaPath(path, base) {
  if (typeof path !== "string" || !path.startsWith("videos/") ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      /[\\?#%:]/.test(path)) return "";
  return `${base}${path}`;
}
