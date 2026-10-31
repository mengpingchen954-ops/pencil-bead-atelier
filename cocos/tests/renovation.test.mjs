import test from "node:test";
import assert from "node:assert/strict";
import { CLEAN_SPOTS, REPAIRS, FURNITURE, ORDERS } from "../assets/scripts/content.ts";
import { freshSave, cleanSpot, isShopClean, repairShop, shopProgress, purchase, normalizeSave, deliver } from "../assets/scripts/model.ts";

const clean = (save) => CLEAN_SPOTS.reduce((s, spot) => cleanSpot(s, spot.id), save);

test("cleaning is free, persistent and idempotent; a dirty shop blocks new purchases", () => {
  const original = { ...freshSave(), coins: 999 };
  assert.equal(purchase(original, "chair", 1), null);
  assert.equal(repairShop(original, "wall"), null);
  assert.equal(cleanSpot(original, "unknown"), null);
  const partial = cleanSpot(original, CLEAN_SPOTS[0].id);
  assert.equal(cleanSpot(partial, CLEAN_SPOTS[0].id), null);
  assert.deepEqual(original.renovation.cleared, []);
  assert.deepEqual(normalizeSave(partial).renovation, partial.renovation);
  const done = clean(original);
  assert.equal(isShopClean(done), true);
  assert.equal(done.coins, original.coins);
  assert.equal(done.energy, original.energy);
  assert.deepEqual(done.inventory, original.inventory);
  assert.equal(shopProgress(done).cleaned, 11);
  assert.ok(purchase(done, "chair", 1));
});

test("repairs charge once, require funds and leave other repairs untouched", () => {
  const before = clean({ ...freshSave(), coins: 60 });
  assert.equal(repairShop(before, "unknown"), null);
  const after = repairShop(before, "wall");
  assert.equal(after.coins, 0);
  assert.deepEqual(after.renovation.repairs, { wall: true, floor: false, window: false });
  assert.equal(before.renovation.repairs.wall, false);
  assert.equal(repairShop(after, "wall"), after);
  assert.equal(repairShop(after, "floor"), null);
  assert.deepEqual(normalizeSave(after).renovation, after.renovation);
});

test("save validation preserves legacy furnishings and filters corrupted renovation fields", () => {
  const legacy = { ...freshSave(), coins: 721, upgrades: { chair: 1, desk: 2, display: 1 } };
  delete legacy.renovation;
  const migrated = normalizeSave(legacy);
  assert.equal(migrated.coins, 721);
  assert.deepEqual(migrated.upgrades, legacy.upgrades);
  assert.equal(isShopClean(migrated), true);
  const malformed = normalizeSave({ ...freshSave(), renovation: { cleared: [CLEAN_SPOTS[0].id, CLEAN_SPOTS[0].id, null, "bogus"], repairs: { wall: true, floor: "true" } } });
  assert.deepEqual(malformed.renovation.cleared, [CLEAN_SPOTS[0].id]);
  assert.deepEqual(malformed.renovation.repairs, { wall: false, floor: false, window: false });
  assert.equal(isShopClean(normalizeSave(freshSave())), false);
});

test("six real order rewards cover every repair and both tiers of all furniture", () => {
  let save = clean({ ...freshSave(), inventory: Array(6).fill(50) });
  for (const order of ORDERS) {
    save = deliver({ ...save, orderId: order.id, draft: [...order.palette], charm: order.charm });
    assert.ok(save);
  }
  for (const repair of REPAIRS) save = repairShop(save, repair.id);
  for (const item of FURNITURE) for (const tier of [1, 2]) save = purchase(save, item.id, tier);
  assert.ok(save);
  assert.equal(save.coins, 0);
  assert.deepEqual(shopProgress(save), { cleaned: 11, repaired: 3, furnished: 6, percent: 100, stage: "焕然一新 · 我们的家" });
});
