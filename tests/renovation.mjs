import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CLEAN_SPOTS, REPAIRS, FURNITURE, ORDERS } from "../src/content.js";
import { freshSave } from "../src/model.js";

const url = process.env.GAME_URL || "http://127.0.0.1:5217/";
const evidence = path.join(os.tmpdir(), "bead-renovation-qa");
await fs.mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], failed = [];
const key = "pencil-bead-atelier-v1";
const state = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const click = (page, action) => page.locator(`[data-action="${action}"]`).first().click();
const ready = (page) => page.waitForFunction(() => typeof window.render_game_to_text === "function");
async function createPage(seed) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key, seed });
  await page.goto(url);
  await ready(page);
  return { context, page };
}
async function screenshot(page, name) {
  await page.locator("img").evaluateAll((images) => Promise.all(images.map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: path.join(evidence, `${name}.png`) });
}
try {
  const { context, page } = await createPage({ ...freshSave(), started: true, inventory: Array(6).fill(50) });
  assert.equal((await state(page)).shop.cleaned, 0);
  assert.equal(await page.locator(".home-room .clean-spot").count(), 11);
  await screenshot(page, "01-dirty-home");
  await click(page, "nav:decor");
  assert.equal(await page.locator("[data-clean]").count(), 11);
  assert.equal(await page.locator('[data-action="buy:chair"]').isDisabled(), true);
  assert.equal(await page.locator('[data-action="repair:wall"]').isDisabled(), true);
  await screenshot(page, "02-dirty-shop");
  const before = (await state(page)).resources;
  await click(page, "clean:box-left");
  await page.reload();
  await ready(page);
  assert.deepEqual((await state(page)).renovation.cleared, ["box-left"]);
  await click(page, "nav:decor");
  // A continuous real touch gesture wipes several dirty patches without scrolling the page.
  const cdp = await context.newCDPSession(page);
  const center = async (id) => {
    const r = await page.locator(`[data-clean="${id}"]`).boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const from = await center("glass-1");
  const scroll = await page.locator("#view").evaluate((el) => el.scrollTop);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  assert.equal(await page.locator(".clean-tool").isVisible(), true);
  for (const id of ["glass-2", "glass-4", "glass-3"]) {
    const to = await center(id);
    for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * i / 5, y: from.y + (to.y - from.y) * i / 5 }] });
    Object.assign(from, to);
  }
  assert.equal((await state(page)).shop.cleaned, 5);
  assert.equal(await page.locator("#view").evaluate((el) => el.scrollTop), scroll);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await page.locator(".clean-tool").isVisible(), false);
  for (const spot of CLEAN_SPOTS) if (!(await state(page)).renovation.cleared.includes(spot.id)) await click(page, `clean:${spot.id}`);
  assert.equal((await state(page)).shop.cleaned, 11);
  assert.deepEqual((await state(page)).resources, before);
  assert.equal(await page.locator("[data-clean]").count(), 0);
  assert.equal(await page.locator("[data-clean-room]").count(), 0);
  assert.equal(await page.locator(".room-cracks").isVisible(), true);
  assert.equal(await page.locator('[data-action="buy:chair"]').isEnabled(), true);
  await click(page, "buy:chair"); // 80 coins cannot buy a 160-coin chair.
  assert.equal((await state(page)).upgrades.chair, 0);
  assert.equal((await state(page)).resources.coins, 80);
  assert.match(await page.locator("#toast").innerText(), /还差 80/);
  await screenshot(page, "03-clean-not-repaired");
  for (const [index, order] of ORDERS.entries()) {
    await click(page, "nav:craft");
    await click(page, "sample");
    await click(page, "sample-fill");
    assert.equal((await state(page)).charm, order.charm);
    await click(page, "deliver");
    await click(page, "confirm-delivery");
    await click(page, "story-close");
    if (index === 0) {
      await click(page, "nav:decor");
      assert.equal((await state(page)).resources.coins, 260);
      await click(page, "buy:chair");
      assert.equal((await state(page)).resources.coins, 100);
      assert.equal(await page.locator('.room-piece-chair.tier-1').count(), 1);
      await click(page, "repair:wall");
      assert.equal((await state(page)).resources.coins, 40);
      assert.equal(await page.locator(".room-cracks").isVisible(), false);
      await click(page, "repair:floor");
      assert.equal((await state(page)).resources.coins, 0);
      assert.equal(await page.locator(".room-broken-floor").isVisible(), false);
      await click(page, "repair:window");
      assert.equal((await state(page)).renovation.repairs.window, false);
      assert.equal((await state(page)).resources.coins, 0);
    }
  }
  await click(page, "nav:decor");
  await click(page, "repair:window");
  for (const f of FURNITURE) while ((await state(page)).upgrades[f.id] < 2) await click(page, `buy:${f.id}`);
  const completed = await state(page);
  assert.equal(completed.completed.length, 6);
  assert.equal(completed.resources.coins, 0);
  assert.equal(completed.shop.percent, 100);
  assert.equal(await page.locator(".room-curtains").isVisible(), true);
  assert.equal(await page.locator(".repair-card.owned").count(), REPAIRS.length);
  assert.equal(await page.locator(".furniture-story").count(), 3);
  await page.reload();
  await ready(page);
  assert.deepEqual((await state(page)).renovation, completed.renovation);
  assert.deepEqual((await state(page)).upgrades, completed.upgrades);
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await click(page, "nav:decor");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screenshot(page, `04-renovated-${width}`);
    await click(page, "nav:home");
    assert.equal(await page.locator(".home-room.room-wall-new.room-floor-new.room-window-new").count(), 1);
    await screenshot(page, `05-renovated-home-${width}`);
  }
  await context.close();
  const legacy = { ...freshSave(), started: true, coins: 721, upgrades: { chair: 1, display: 2, desk: 1 } };
  delete legacy.renovation;
  const old = await createPage(legacy);
  await click(old.page, "nav:decor");
  assert.equal((await state(old.page)).resources.coins, 721);
  assert.deepEqual((await state(old.page)).upgrades, legacy.upgrades);
  assert.equal(await old.page.locator("[data-clean]").count(), 0);
  await old.context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(JSON.stringify({ passed: true, realTouchWipe: true, freeCleaning: true, partialReload: true, sixOrderIncomeToFullRenovation: true, legacySavePreserved: true, widths: [360, 390, 1440], errors, failed, screenshots: evidence }, null, 2));
} finally {
  await browser.close();
}
