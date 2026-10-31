// @ts-nocheck
// Rules and narrative retained from the original game; engine-independent.
import { STORIES } from "./content.ts";

export function storyUnlocked(save, scene) {
  if (!scene) return false;
  if (scene.furniture) return save.upgrades[scene.furniture] >= 1;
  return !scene.afterOrder || save.completed.includes(scene.afterOrder);
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

// Keep media relative to the game so GitHub Pages repository paths keep working.
export function mediaPath(path, base) {
  if (typeof path !== "string" || !path.startsWith("videos/") ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      /[\\?#%:]/.test(path)) return "";
  return `${base}${path}`;
}
