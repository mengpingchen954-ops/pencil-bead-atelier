import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { ORDERS, CLEAN_SPOTS } from "../src/content.js";
import { findMove, move, total, freshSave } from "../src/model.js";
const url = process.env.GAME_URL || "http://127.0.0.1:5217/";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage(),
  errors = [],
  failed = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
});
await fs.mkdir("artifacts", { recursive: true });
const state = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const click = async (a) => {
  await page.locator(`[data-action="${a}"]`).first().click();
};
const shot = async (name) => {
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(images.map((i) => i.decode().catch(() => {}))),
    );
  await page.screenshot({ path: `artifacts/${name}.png` });
};
const ready = () =>
  page.waitForFunction(() => typeof window.render_game_to_text === "function");
async function cell(index) {
  const r = await page.locator(".board-scene").boundingBox();
  return {
    x: r.x + (((index % 8) + 0.85) * r.width) / 8.7,
    y: r.y + ((Math.floor(index / 8) + 0.85) * r.height) / 8.7,
  };
}
async function tap(index) {
  const p = await cell(index);
  await page.touchscreen.tap(p.x, p.y);
}
async function winPuzzle(first = false) {
  await click("match-intro");
  await click("match-start");
  await page.waitForFunction(
    () => document.querySelector("#scene").clientWidth > 0,
  );
  await page.waitForTimeout(100);
  if (first) {
    await shot("03-match");
    const before = await state();
    await tap(0);
    await tap(63);
    assert.equal((await state()).match.moves, before.match.moves);
    await click("tool:hint");
    await click("tool:shuffle");
    await page.waitForFunction(
      () => !JSON.parse(window.render_game_to_text()).busy,
    );
    await click("tool:hammer");
    await tap(20);
    await page.waitForFunction(
      () => !JSON.parse(window.render_game_to_text()).busy,
    );
    assert.equal((await state()).match.tools.hammer, 1);
  }
  for (let n = 0; n < 24; n++) {
    const s = await state();
    if (s.match.status !== "playing") break;
    if (s.match.moves <= 6 && s.match.tools.bloom) {
      await click("tool:bloom");
      await tap(27);
      await page.waitForFunction(
        () => !JSON.parse(window.render_game_to_text()).busy,
      );
      continue;
    }
    const pair = findMove(s.match.board);
    assert.ok(pair);
    if (first && n === 0) {
      const a = await cell(pair[0]),
        b = await cell(pair[1]);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 7 });
      await page.mouse.up();
    } else {
      await tap(pair[0]);
      await tap(pair[1]);
    }
    await page.waitForFunction(
      () => !JSON.parse(window.render_game_to_text()).busy,
    );
  }
  assert.equal((await state()).match.status, "won");
  await page.waitForSelector('[data-action="claim"]');
  if (first) await shot("04-reward");
  const prior = (await state()).resources.inventory;
  await click("claim");
  const after = await state();
  assert.ok(after.resources.inventory.every((n, i) => n > prior[i]));
  assert.ok(["home", "craft"].includes(after.screen));
}
try {
  await page.goto(url);
  await ready();
  await shot("01-cover");
  await click("start");
  await click("story-close");
  assert.equal((await state()).screen, "home");
  await shot("02-home");
  await click("nav:craft");
  await click("deliver");
  assert.equal((await state()).modal, null);
  await winPuzzle(true);
  assert.equal((await state()).screen, "craft");
  for (const type of ORDERS[0].palette) await click(`bead:${type}`);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).craft.flights.length === 0);
  assert.equal((await state()).draft.filter((n) => n !== null).length, 12);
  await shot("05-workshop");
  // Swap actual Three.js bracelet slots, then undo; reserve stock is never spent by editing.
  const anchor = await page.locator(".bracelet-scene").boundingBox();
  const point = (i) => ({
    x:
      anchor.x +
      anchor.width / 2 +
      (Math.cos(Math.PI / 2 - (i * Math.PI) / 6) * 2.28 * anchor.width) / 9,
    y:
      anchor.y +
      anchor.height / 2 -
      (Math.sin(Math.PI / 2 - (i * Math.PI) / 6) * 2.14 * anchor.width) / 9,
  });
  const p0 = point(0),
    p1 = point(1),
    beforeSwap = await state();
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  await page.mouse.move(p1.x, p1.y, { steps: 8 });
  await page.mouse.up();
  assert.equal((await state()).draft[0], beforeSwap.draft[1]);
  await click("undo");
  assert.deepEqual((await state()).draft, beforeSwap.draft);
  await page.mouse.click(p0.x, p0.y);
  assert.equal((await state()).screen, "craft");
  await click("erase");
  assert.equal((await state()).draft.filter((n) => n !== null).length, 11);
  await click("undo");
  await click("deliver");
  await shot("06-delivery");
  await click("confirm-delivery");
  assert.deepEqual((await state()).completed, ["daisy"]);
  await shot("07-story");
  await click("story-close");
  await click("nav:decor");
  for (const spot of CLEAN_SPOTS) await click(`clean:${spot.id}`);
  const coins = (await state()).resources.coins;
  await click("buy:chair");
  assert.equal((await state()).upgrades.chair, 1);
  assert.equal((await state()).resources.coins, coins - 160);
  await shot("08-decor");
  await page.reload();
  await ready();
  assert.equal((await state()).upgrades.chair, 1);
  assert.equal((await state()).completed.length, 1);
  // Complete remaining orders through real puzzles and inventory-backed crafting.
  for (const o of ORDERS.slice(1)) {
    await click("nav:craft");
    let s = await state();
    let needs = () =>
      o.palette.some(
        (t) =>
          s.resources.inventory[t] < o.palette.filter((x) => x === t).length,
      );
    if (needs()) {
      await winPuzzle();
      s = await state();
    }
    assert.equal(needs(), false, `enough stock for ${o.id}`);
    await click("sample");
    await click("sample-fill");
    assert.equal((await state()).requirements.stock, true);
    assert.equal((await state()).charm, o.charm);
    await click("deliver");
    await click("confirm-delivery");
    await click("story-close");
  }
  assert.equal((await state()).completed.length, 6);
  assert.equal((await state()).resources.rep, 140);
  await click("nav:album");
  assert.equal(await page.locator(".album-card").count(), 6);
  await shot("09-album");
  await click("collection:sea");
  await click("close");
  await click("nav:journal");
  await click("story:4");
  assert.ok((await page.locator(".dialogue").innerText()).length > 0);
  await click("story-next");
  await shot("10-story-pressure");
  await click("story-close");
  await click("settings");
  await click("sound");
  await click("motion");
  await click("close");
  await page.reload();
  await ready();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pencil-bead-atelier-v1")),
  );
  assert.equal(stored.sound, false);
  assert.equal(stored.reduced, true);
  assert.equal(stored.completed.length, 6);
  await click("nav:decor");
  await click("buy:display");
  await click("buy:desk");
  assert.equal((await state()).upgrades.display, 1);
  assert.equal((await state()).upgrades.desk, 1);
  // Deliberately make the least productive legal moves to check the real loss/retry screen.
  await click("nav:home");
  await click("match-intro");
  await click("match-start");
  const inventoryBeforeLoss = (await state()).resources.inventory;
  for (let n = 0; n < 16; n++) {
    const s = (await state()).match;
    if (s.status !== "playing") break;
    let best = null,
      gain = Infinity;
    for (let i = 0; i < 64; i++)
      for (const j of [i + 1, i + 8]) {
        const r = move(s, i, j);
        if (r.valid) {
          const g = total(r.session.collected) - total(s.collected);
          if (g < gain) {
            gain = g;
            best = [i, j];
          }
        }
      }
    assert.ok(best);
    await tap(best[0]);
    await tap(best[1]);
    await page.waitForFunction(
      () => !JSON.parse(window.render_game_to_text()).busy,
    );
  }
  assert.equal((await state()).match.status, "lost");
  assert.deepEqual((await state()).resources.inventory, inventoryBeforeLoss);
  await shot("13-loss");
  const energyBeforeRetry = (await state()).resources.energy;
  await click("match-start");
  assert.equal((await state()).resources.energy, energyBeforeRetry - 1);
  await click("pause");
  await click("abandon");
  for (const dimensions of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(dimensions);
    for (const s of ["home", "orders", "craft", "decor", "album", "journal"]) {
      await click(`nav:${s === "journal" ? "album" : s}`);
      if (s === "journal") await click("nav:journal");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(
        overflow,
        false,
        `no horizontal overflow ${s} ${dimensions.width}`,
      );
    }
    await shot(`11-layout-${dimensions.width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await click("nav:home");
  await shot("12-desktop");
  const exhaustedContext = await browser.newContext({
    viewport: { width: 360, height: 740 },
  });
  const exhaustedPage = await exhaustedContext.newPage();
  exhaustedPage.on("pageerror", (e) => errors.push(e.message));
  await exhaustedPage.addInitScript(
    (saved) =>
      localStorage.setItem("pencil-bead-atelier-v1", JSON.stringify(saved)),
    { ...freshSave(), started: true, lastStory: 0, energy: 0 },
  );
  await exhaustedPage.goto(url);
  await exhaustedPage.waitForFunction(
    () => typeof window.render_game_to_text === "function",
  );
  await exhaustedPage.locator('[data-action="match-intro"]').click();
  await exhaustedPage.locator('[data-action="match-start"]').click();
  assert.equal(
    JSON.parse(await exhaustedPage.evaluate(() => window.render_game_to_text()))
      .modal,
    "energy",
  );
  await exhaustedContext.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        orders: 6,
        storyChapters: 3,
        consoleErrors: errors,
        failedRequests: failed,
        checkedWidths: [360, 390, 1440],
        finalState: await state(),
      },
      null,
      2,
    ),
  );
} catch (e) {
  await shot("failure");
  console.error(await state().catch(() => ""));
  throw e;
} finally {
  await browser.close();
}
