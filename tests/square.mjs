import { chromium } from "playwright";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { newSession, findMove, move, freshSave } from "../src/model.js";

let fixture;
for (let seed = 71; seed < 10000; seed++) {
  const session = newSession(seed), pair = findMove(session.board);
  const result = move(session, ...pair), hit = [...result.frames[0].hit].sort((a, b) => a - b);
  if (hit.length === 4 && hit[1] === hit[0] + 1 && hit[2] === hit[0] + 8 && hit[3] === hit[0] + 9) {
    fixture = { seed, session, pair, result }; break;
  }
}
assert.ok(fixture, "find a stable board whose hint is a square-only move");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(), errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(({ saved, now }) => {
  localStorage.setItem("pencil-bead-atelier-v1", JSON.stringify(saved));
  Date.now = () => now;
}, { saved: { ...freshSave(), started: true }, now: 1793376000000 + fixture.seed - 71 });
const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const screenshot = path.join(os.tmpdir(), "bead-square-clear.png");
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5217/");
  await click("match-intro"); await click("match-start");
  await page.waitForTimeout(150);
  assert.deepEqual((await state()).match.board, fixture.session.board);
  assert.match(await page.locator(".match-heading").innerText(), /2×2/);
  await click("tool:hint");
  for (const index of fixture.pair) {
    const b = await page.locator(".board-scene").boundingBox();
    await page.touchscreen.tap(b.x + ((index % 8 + 0.85) * b.width) / 8.7, b.y + ((Math.floor(index / 8) + 0.85) * b.height) / 8.7);
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).match.animation.phase === "clear");
  await page.screenshot({ path: screenshot });
  await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).busy);
  const after = (await state()).match;
  assert.deepEqual(after.board, fixture.result.session.board);
  assert.deepEqual(after.collected, fixture.result.session.collected);
  assert.equal(after.moves, 15);
  after.animation.pieces.forEach((piece, i) => assert.equal(piece.type, after.board[i]));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, seed: fixture.seed, hintedSwap: fixture.pair, square: fixture.result.frames[0].hit, collected: after.collected, screenshot, errors }));
} finally { await browser.close(); }
