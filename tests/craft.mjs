import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { freshSave } from "../src/model.js";

const url = process.env.GAME_URL || "http://127.0.0.1:5217/";
const evidenceDir = path.join(os.tmpdir(), "bead-craft-qa");
await fs.mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  recordVideo: { dir: evidenceDir, size: { width: 390, height: 844 } } });
const page = await context.newPage(), errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript((save) => {
  if (!localStorage.getItem("pencil-bead-atelier-v1")) localStorage.setItem("pencil-bead-atelier-v1", JSON.stringify(save));
},
  { ...freshSave(), started: true, inventory: Array(6).fill(30) });
const click = (action) => page.locator(`[data-action="${action}"]`).first().click();
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const idle = () => page.waitForFunction(() => JSON.parse(window.render_game_to_text()).craft?.flights.length === 0);
const slotPosition = (i) => ({ x: Math.cos(Math.PI / 2 - i * Math.PI / 6) * 2.28, y: Math.sin(Math.PI / 2 - i * Math.PI / 6) * 2.14 });
async function point(i) {
  const b = await page.locator(".bracelet-scene").boundingBox(), p = slotPosition(i);
  return { x: b.x + b.width / 2 + p.x * b.width / 9, y: b.y + b.height / 2 - p.y * b.width / 9 };
}
function assertRest(s) {
  assert.equal(s.craft.flights.length, 0);
  s.craft.pieces.forEach((p, i) => {
    assert.equal(p.type, s.draft[i]);
    assert.equal(p.visible, s.draft[i] !== null);
    if (p.visible) {
      const at = slotPosition(i);
      assert.ok(Math.abs(p.x - at.x) < 0.00001);
      assert.ok(Math.abs(p.y - at.y) < 0.00001);
      assert.equal(p.scale, 1);
    }
  });
}
try {
  await page.goto(url);
  await click("nav:craft");
  await page.waitForTimeout(100);
  const stock = (await state()).resources.inventory;
  await click("bead:0");
  let s = await state();
  const launched = s.draft.indexOf(0);
  assert.equal(s.craft.flights.length, 1);
  assert.equal(s.craft.flights[0].index, launched);
  assert.ok(Math.hypot(s.craft.pieces[launched].x, s.craft.pieces[launched].y) < 0.4, "starts at center");
  await page.screenshot({ path: path.join(evidenceDir, "01-center.png") });
  await page.waitForFunction(() => {
    const craft = JSON.parse(window.render_game_to_text()).craft;
    return craft.flights.some((f) => f.elapsed > 0.3 && f.elapsed < 0.6);
  });
  s = await state();
  const rolling = s.craft.pieces[launched];
  assert.ok(Math.hypot(rolling.x, rolling.y) > 0.5);
  assert.ok(Math.hypot(rolling.x - slotPosition(launched).x, rolling.y - slotPosition(launched).y) > 0.08);
  await page.screenshot({ path: path.join(evidenceDir, "02-rolling.png") });
  await idle();
  assertRest(await state());
  assert.deepEqual((await state()).resources.inventory, stock);

  // Real touch drag follows the finger, then drops into an empty groove.
  const cdp = await context.newCDPSession(page), target = (launched + 5) % 12;
  const from = await point(launched), to = await point(target);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...middle, id: 1 }] });
  s = await state();
  assert.equal(s.craft.dragging, launched);
  const dragged = s.craft.pieces[launched];
  assert.ok(Math.hypot(dragged.x - slotPosition(launched).x, dragged.y - slotPosition(launched).y) > 0.3);
  await page.screenshot({ path: path.join(evidenceDir, "03-follow-finger.png") });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...to, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await idle();
  assert.equal((await state()).draft[target], 0);
  assert.equal((await state()).draft[launched], null);
  assertRest(await state());
  await click("undo");
  assert.equal((await state()).draft[launched], 0);

  // Undo returns the old draft, and rapid launches reserve different empty grooves.
  await click("undo");
  assert.equal((await state()).draft.filter((t) => t !== null).length, 0);
  for (const type of [0, 1, 2, 3]) await click(`bead:${type}`);
  s = await state();
  assert.equal(s.draft.filter((t) => t !== null).length, 4);
  assert.ok(s.craft.flights.length >= 2, "rapid taps keep concurrent flights alive");
  assert.equal(new Set(s.craft.flights.map((f) => f.index)).size, s.craft.flights.length);
  await page.screenshot({ path: path.join(evidenceDir, "04-multiple-launches.png") });
  await idle();
  const beforeSwap = await state(), a = beforeSwap.draft.indexOf(0), b = beforeSwap.draft.indexOf(1);
  const pa = await point(a), pb = await point(b);
  await page.mouse.move(pa.x, pa.y); await page.mouse.down();
  await page.mouse.move(pb.x, pb.y, { steps: 6 }); await page.mouse.up();
  await idle();
  assert.equal((await state()).draft[a], 1); assert.equal((await state()).draft[b], 0);
  await click("undo");
  assert.deepEqual((await state()).draft, beforeSwap.draft);

  // Cancellation snaps back without mutating the saved draft.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...pa, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: pa.x + 30, y: pa.y + 30, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await idle();
  assertRest(await state());
  assert.deepEqual((await state()).draft, beforeSwap.draft);

  for (const type of [4, 5, 0, 1, 2, 3, 4, 5]) await click(`bead:${type}`);
  await idle();
  const full = await state();
  assert.equal(full.draft.filter((t) => t !== null).length, 12);
  await click("bead:0"); assert.deepEqual((await state()).draft, full.draft);
  const p0 = await point(0);
  await page.touchscreen.tap(p0.x, p0.y);
  await click("bead:5"); await idle();
  assert.equal((await state()).draft[0], 5);
  await click("undo"); assert.deepEqual((await state()).draft, full.draft);
  await page.touchscreen.tap(p0.x, p0.y); await click("erase");
  assert.equal((await state()).draft[0], null);
  await click("bead:0");
  assert.equal((await state()).draft[0], 0);
  await click("nav:home"); await click("nav:craft");
  assertRest(await state());
  assert.equal((await state()).draft[0], 0);
  await page.reload();
  await click("nav:craft");
  assert.equal((await state()).draft[0], 0);
  assert.deepEqual((await state()).resources.inventory, stock);

  await click("settings"); await click("motion"); await click("close");
  await page.touchscreen.tap((await point(0)).x, (await point(0)).y); await click("erase");
  await click("bead:3");
  assertRest(await state());
  assert.equal((await state()).draft[0], 3);
  await page.screenshot({ path: path.join(evidenceDir, "05-rest.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(evidenceDir, "06-desktop.png") });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const limited = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const limitedPage = await limited.newPage();
  limitedPage.on("pageerror", (e) => errors.push(e.message));
  await limitedPage.addInitScript((s) => localStorage.setItem("pencil-bead-atelier-v1", JSON.stringify(s)),
    { ...freshSave(), started: true, inventory: [1, 0, 0, 0, 0, 0] });
  await limitedPage.goto(url);
  await limitedPage.locator('[data-action="nav:craft"]').first().click();
  const addPearl = limitedPage.locator('[data-action="bead:0"]');
  await addPearl.focus(); await limitedPage.keyboard.press("Enter");
  await limitedPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).craft?.flights.length === 0);
  const reserved = await limitedPage.evaluate(() => JSON.parse(window.render_game_to_text()).draft);
  assert.equal(reserved.filter((t) => t === 0).length, 1);
  await addPearl.click();
  await limitedPage.locator('[data-action="bead:1"]').click();
  assert.deepEqual(await limitedPage.evaluate(() => JSON.parse(window.render_game_to_text()).draft), reserved);
  assert.equal(await limitedPage.evaluate(() => JSON.parse(window.render_game_to_text()).craft.flights.length), 0);
  await limited.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, centerLaunch: true, rolling: true, concurrentLaunches: true, touchDrag: true,
    emptyGrooveDrop: true, occupiedSwap: true, cancelSnapback: true, fullAndReplace: true, undoAndSave: true,
    reducedMotion: true, unchangedInventory: true, insufficientStockBlocked: true, keyboardLaunch: true, errors, evidenceDir }));
} catch (error) {
  await page.screenshot({ path: path.join(evidenceDir, "failure.png") });
  console.error(await state()); throw error;
} finally { await context.close(); await browser.close(); }
