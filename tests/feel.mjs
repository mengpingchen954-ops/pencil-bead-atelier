import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { freshSave, move, total, adjacent } from "../src/model.js";
const url = process.env.GAME_URL || "http://127.0.0.1:5217/";
await fs.mkdir("artifacts/feel", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
  recordVideo: { dir: "artifacts/feel", size: { width: 390, height: 844 } },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
const state = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const waitIdle = () =>
  page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).busy);
const phase = (p) =>
  page.waitForFunction(
    (value) =>
      JSON.parse(window.render_game_to_text()).match.animation.phase === value,
    p,
  );
async function point(i) {
  const b = await page.locator(".board-scene").boundingBox();
  return {
    x: b.x + (((i % 8) + 0.85) * b.width) / 8.7,
    y: b.y + ((Math.floor(i / 8) + 0.85) * b.height) / 8.7,
  };
}
async function tap(i) {
  const p = await point(i);
  await page.touchscreen.tap(p.x, p.y);
}
function pairs(s) {
  const all = [];
  for (let a = 0; a < 64; a++)
    for (const b of [a + 1, a + 8])
      if (adjacent(a, b)) all.push({ a, b, result: move(s, a, b) });
  return all;
}
function assertRest(s) {
  assert.equal(s.match.animation.phase, "idle");
  assert.equal(s.match.animation.activeTweens, 0);
  s.match.animation.pieces.forEach((p, i) => {
    assert.equal(p.type, s.match.board[i]);
    assert.equal(p.x, (i % 8) - 3.5);
    assert.equal(p.y, 3.5 - Math.floor(i / 8));
    assert.equal(p.opacity, 1);
  });
}
try {
  await page.addInitScript(
    (s) => localStorage.setItem("pencil-bead-atelier-v1", JSON.stringify(s)),
    { ...freshSave(), started: true, lastStory: 0 },
  );
  await page.goto(url);
  await page.waitForFunction(
    () => typeof window.render_game_to_text === "function",
  );
  await click("match-intro");
  await click("match-start");
  await page.waitForTimeout(100);
  const initial = await state(),
    miss = pairs(initial.match).find((p) => !p.result.valid);
  assert.ok(miss);
  await tap(miss.a);
  await tap(miss.b);
  await phase("swap");
  await page.waitForTimeout(45);
  const swapping = await state();
  assert.equal(swapping.busy, true);
  assert.ok(
    swapping.match.animation.pieces.some(
      (p) =>
        Math.abs(p.x - ((p.index % 8) - 3.5)) > 0.01 ||
        Math.abs(p.y - (3.5 - Math.floor(p.index / 8))) > 0.01,
    ),
  );
  await page.screenshot({ path: "artifacts/feel/01-invalid-swap.png" });
  await waitIdle();
  const bounced = await state();
  assert.deepEqual(bounced.match.board, initial.match.board);
  assert.equal(bounced.match.moves, initial.match.moves);
  assertRest(bounced);
  const valid = pairs(bounced.match)
    .filter((p) => p.result.valid)
    .sort(
      (a, b) =>
        b.result.frames.length - a.result.frames.length ||
        total(b.result.session.collected) - total(a.result.session.collected),
    )
    .find((p) => total(p.result.session.collected) < initial.match.target);
  assert.ok(valid);
  const a = await point(valid.a),
    b = await point(valid.b),
    cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: a.x, y: a.y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: a.x + (b.x - a.x) * 0.62, y: a.y + (b.y - a.y) * 0.62, id: 1 },
    ],
  });
  await page.waitForTimeout(35);
  const dragged = await state();
  assert.equal(dragged.busy, false);
  const draggedPiece = dragged.match.animation.pieces[valid.a];
  assert.ok(
    Math.abs(draggedPiece.x - ((valid.a % 8) - 3.5)) > 0.1 ||
      Math.abs(draggedPiece.y - (3.5 - Math.floor(valid.a / 8))) > 0.1,
  );
  const horizontal = valid.b - valid.a === 1;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      {
        x: a.x + (horizontal ? (b.x - a.x) * 0.62 : 35),
        y: a.y + (horizontal ? 35 : (b.y - a.y) * 0.62),
        id: 1,
      },
    ],
  });
  const locked = (await state()).match.animation.pieces[valid.a];
  assert.equal(
    horizontal ? locked.y : locked.x,
    horizontal ? 3.5 - Math.floor(valid.a / 8) : (valid.a % 8) - 3.5,
  );
  await page.screenshot({ path: "artifacts/feel/02-follow-finger.png" });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phase("clear");
  await page.screenshot({ path: "artifacts/feel/03-pop-clear.png" });
  await page.waitForFunction(() => {
    const s = JSON.parse(window.render_game_to_text());
    return (
      s.match.animation.phase === "fall" &&
      s.match.animation.pieces.some(
        (p) => Math.abs(p.y - (3.5 - Math.floor(p.index / 8))) > 0.03,
      )
    );
  });
  const falling = await state();
  assert.ok(falling.match.animation.pieces.some((p) => p.y > 3.5));
  await page.screenshot({ path: "artifacts/feel/04-gravity.png" });
  await tap(40);
  assert.deepEqual((await state()).queuedInput, { tap: 40 });
  await waitIdle();
  const settled = await state();
  assert.deepEqual(settled.match.board, valid.result.session.board);
  assert.equal(settled.match.moves, initial.match.moves - 1);
  assert.equal(settled.selected, 40);
  assertRest(settled);
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#match-effects>*").count(), 0);
  await page.screenshot({ path: "artifacts/feel/05-settled.png" });
  // Reduced motion uses the same outcomes while avoiding sparkle/flying beads and long waits.
  await click("settings");
  await click("motion");
  await click("close");
  const reducedBefore = await state();
  const reducedPair = pairs(reducedBefore.match).find(
    (p) =>
      p.result.valid &&
      total(p.result.session.collected) < reducedBefore.match.target,
  );
  assert.ok(reducedPair);
  await tap(reducedPair.a);
  await tap(reducedPair.b);
  await waitIdle();
  const reducedAfter = await state();
  assert.deepEqual(reducedAfter.match.board, reducedPair.result.session.board);
  assertRest(reducedAfter);
  assert.equal(await page.locator(".bead-pickup").count(), 0);
  await click("pause");
  await click("abandon");
  await click("settings");
  await click("motion");
  await click("close");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await click("match-intro");
  await click("match-start");
  const desktop = await state();
  const desktopPair = pairs(desktop.match).find((p) => p.result.valid);
  const p1 = await point(desktopPair.a),
    p2 = await point(desktopPair.b);
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move(p2.x, p2.y, { steps: 6 });
  await page.mouse.up();
  await waitIdle();
  assertRest(await state());
  await page.screenshot({ path: "artifacts/feel/06-desktop.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      touchDrag: true,
      invalidSwapReturns: true,
      continuousGravity: true,
      cascadeFrames: valid.result.frames.length,
      bufferedTap: true,
      reducedMotion: true,
      desktopMouse: true,
      consoleErrors: errors,
    }),
  );
} catch (e) {
  await page.screenshot({ path: "artifacts/feel/failure.png" });
  console.error(await state());
  throw e;
} finally {
  await context.close();
  await browser.close();
}
