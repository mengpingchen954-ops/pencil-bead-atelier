import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { freshSave } from "../src/model.js";
import { STORIES, ORDERS } from "../src/content.js";

// Browser plugin not available; use the project's existing Playwright runtime.
// Flow: opening/order/furniture -> story -> record -> replay; video -> finish/skip/fallback.
const url = process.env.GAME_URL || "http://127.0.0.1:5217/";
const browser = await chromium.launch({ headless: true });
const errors = [], requests = [], evidenceDir = path.join(os.tmpdir(), "bead-story-qa");
await fs.mkdir(evidenceDir, { recursive: true });
async function createPage(saved, manifest) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) requests.push(`${r.status()} ${r.url()}`); });
  if (saved) await page.addInitScript((s) => localStorage.setItem("pencil-bead-atelier-v1", JSON.stringify(s)), saved);
  if (manifest) await page.route("**/story-media.json", (route) => route.fulfill({ json: manifest }));
  return { context, page };
}
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function click(page, action) {
  const modalAction = page.locator(`#modal-root [data-action="${action}"]`);
  await (await modalAction.count() ? modalAction : page.locator(`[data-action="${action}"]`).first()).click();
}
async function ready(page) {
  await page.goto(url);
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  assert.match(await page.title(), /珠光小店物语/);
  assert.equal(await page.locator("vite-error-overlay").count(), 0);
  assert.ok((await page.locator("#view").innerText()).length > 20);
}
async function readScene(page, id) {
  await page.waitForSelector(".dialogue");
  assert.equal((await state(page)).story.id, id);
  for (let n = 0; n < STORIES.find((s) => s.id === id).lines.length; n++) await click(page, "story-next");
  assert.equal((await state(page)).modal, null);
}
try {
  const { page, context } = await createPage();
  await ready(page);
  await click(page, "start");
  await page.waitForSelector(".dialogue");
  await page.screenshot({ path: path.join(evidenceDir, "01-opening.png") });
  await click(page, "story-next");
  assert.match(await page.locator(".dialogue").innerText(), /代管/);
  await click(page, "story-close");
  assert.deepEqual((await state(page)).seenStories, []);
  assert.match(await page.locator(".journey-card").innerText(), /第一笔钱/);
  const primaryAction = await page.locator('.home-actions [data-action="match-intro"]').boundingBox();
  assert.ok(primaryAction.y + primaryAction.height < 770, "primary gameplay stays above the mobile bottom navigation");
  await click(page, "story:0");
  await readScene(page, "old-table");
  await page.reload();
  assert.deepEqual((await state(page)).seenStories, ["old-table"]);
  await context.close();

  const old = { ...freshSave(), started: true, completed: ORDERS.map((o) => o.id), coins: 721, upgrades: { chair: 1, desk: 1, display: 1 }, lastStory: 6 };
  delete old.seenStories;
  delete old.renovation;
  const legacy = await createPage(old);
  await ready(legacy.page);
  assert.equal((await state(legacy.page)).resources.coins, 721);
  await click(legacy.page, "nav:journal");
  assert.equal(await legacy.page.locator(".story-link").count(), 10);
  await click(legacy.page, "story:1");
  await readScene(legacy.page, "first-receipt");
  assert.deepEqual((await state(legacy.page)).evidence, ["first-receipt"]);
  await click(legacy.page, "evidence:first-receipt");
  assert.match(await legacy.page.locator('[role="dialog"]').innerText(), /经营记录/);
  await click(legacy.page, "story:1");
  await readScene(legacy.page, "first-receipt");
  assert.equal((await state(legacy.page)).resources.coins, 721);
  assert.equal((await state(legacy.page)).evidence.length, 1);
  await click(legacy.page, "nav:decor");
  await legacy.page.locator('.furniture-story[data-action="story:8"]').click();
  await readScene(legacy.page, "keepsake-box");
  await click(legacy.page, "nav:home");
  await click(legacy.page, "nav:journal");
  for (const width of [360, 390, 1440]) {
    await legacy.page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    assert.equal(await legacy.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await legacy.page.locator("#view").evaluate((view) => view.scrollTo(0, 0));
    await legacy.page.screenshot({ path: path.join(evidenceDir, `02-journal-${width}.png`) });
    await click(legacy.page, "story:6");
    await legacy.page.waitForSelector(".dialogue");
    const bounds = await legacy.page.locator(".story-modal").boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= (width === 1440 ? 1000 : 844));
    await click(legacy.page, "story-close");
  }
  await legacy.context.close();

  // Generate a real short video in memory, outside game assets and source control.
  const maker = await browser.newPage();
  const clip = Buffer.from(await maker.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 180; canvas.height = 320;
    const ctx = canvas.getContext("2d"), stream = canvas.captureStream(15), chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    const recorded = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start();
    const started = performance.now();
    const timer = setInterval(() => {
      ctx.fillStyle = "#eee5d0"; ctx.fillRect(0, 0, 180, 320);
      ctx.fillStyle = "#718160"; ctx.beginPath();
      ctx.arc(90, 160, 25 + Math.sin((performance.now() - started) / 120) * 7, 0, Math.PI * 2); ctx.fill();
    }, 50);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    clearInterval(timer); recorder.stop(); await recorded;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  }));
  await maker.close();
  const video = await createPage({ ...freshSave(), sound: false }, { "old-table": { src: "videos/qa.webm", captions: "videos/qa.zh.vtt" } });
  await video.page.route("**/videos/qa.webm", (route) => route.fulfill({ status: 200, contentType: "video/webm", body: clip }));
  await video.page.route("**/videos/qa.zh.vtt", (route) => route.fulfill({ status: 200, contentType: "text/vtt", body: "WEBVTT\n\n00:00:00.000 --> 00:00:01.500\n剧情测试字幕\n" }));
  await ready(video.page);
  await click(video.page, "start");
  await video.page.waitForSelector("video");
  assert.equal(await video.page.locator("video").getAttribute("playsinline"), "");
  assert.equal(await video.page.locator("video").evaluate((v) => v.muted), true);
  await click(video.page, "story-play");
  await video.page.waitForFunction(() => document.querySelector("video")?.currentTime > 0.1);
  await video.page.waitForFunction(() => document.querySelector("track")?.readyState === 2);
  assert.equal(await video.page.locator("video").evaluate((v) => v.textTracks[0].cues[0].text), "剧情测试字幕");
  await video.page.locator("video").evaluate((v) => v.pause());
  await video.page.screenshot({ path: path.join(evidenceDir, "03-video.png") });
  await click(video.page, "story-play");
  await video.page.waitForSelector('[data-action="story-finish"]');
  await click(video.page, "story-finish");
  assert.deepEqual((await state(video.page)).seenStories, ["old-table"]);
  assert.equal((await state(video.page)).resources.coins, 80);
  await click(video.page, "nav:journal");
  await click(video.page, "story:0");
  await video.page.waitForSelector("video");
  await video.page.locator("video").evaluate((v) => { v.play = () => Promise.reject(new DOMException("User gesture required", "NotAllowedError")); });
  await click(video.page, "story-play");
  await video.page.getByText("未能开始播放，可再次点击播放，或阅读文字剧情。").waitFor();
  await click(video.page, "story-text");
  await readScene(video.page, "old-table");
  assert.equal((await state(video.page)).seenStories.length, 1);
  await click(video.page, "story:0");
  await click(video.page, "story-play");
  await video.page.waitForFunction(() => document.querySelector("video")?.currentTime > 0.1);
  const oldVideo = await video.page.locator("video").elementHandle();
  await click(video.page, "story-close");
  assert.equal(await oldVideo.evaluate((v) => v.paused), true);
  await video.context.close();

  const broken = await createPage({ ...freshSave(), started: true, completed: ["daisy"] }, { "first-receipt": { src: "videos/broken.mp4" } });
  await broken.page.route("**/videos/broken.mp4", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: "invalid media" }));
  await ready(broken.page);
  await click(broken.page, "nav:journal");
  await click(broken.page, "story:1");
  await broken.page.waitForSelector(".video-fallback");
  await broken.page.screenshot({ path: path.join(evidenceDir, "04-video-fallback.png") });
  await readScene(broken.page, "first-receipt");
  assert.equal((await state(broken.page)).evidence.length, 1);
  await broken.context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(JSON.stringify({ passed: true, scenes: STORIES.length, widths: [360, 390, 1440], realVideoPlayback: true, videoEnded: true, skipAndReplay: true, mediaFailureFallback: true, blockedPlaybackFallback: true, legacySavePreserved: true, errors, failedRequests: requests, screenshots: evidenceDir }, null, 2));
} finally {
  await browser.close();
}
