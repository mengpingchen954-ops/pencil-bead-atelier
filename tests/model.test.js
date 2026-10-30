import test from "node:test";
import assert from "node:assert/strict";
import { ORDERS } from "../src/content.js";
import {
  createBoard,
  matches,
  findMove,
  move,
  newSession,
  useTool,
  freshSave,
  deliver,
  canPlace,
  purchase,
  normalizeSave,
  refreshEnergy,
  total,
} from "../src/model.js";

test("100 seeded boards start stable with a legal move and settle after swaps", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const board = createBoard(seed);
    assert.equal(board.length, 64);
    assert.equal(matches(board).length, 0);
    const pair = findMove(board);
    assert.ok(pair);
    const before = newSession(seed),
      result = move(before, ...pair);
    assert.equal(result.valid, true);
    assert.equal(result.session.moves, 15);
    assert.ok(total(result.session.collected) >= 3);
    assert.equal(matches(result.session.board).length, 0);
    assert.ok(findMove(result.session.board));
    assert.deepEqual(before.board, board);
  }
});
test("invalid swap is free; exhausted and completed sessions cannot move", () => {
  const s = newSession(4);
  assert.equal(move(s, 7, 8).valid, false);
  assert.equal(s.moves, 16);
  let invalid;
  for (let i = 0; i < 63; i++)
    if (!move(s, i, i + 1).valid) {
      invalid = [i, i + 1];
      break;
    }
  assert.equal(move(s, ...invalid).session, s);
  assert.equal(
    move({ ...s, status: "won" }, ...findMove(s.board)).valid,
    false,
  );
  const result = move({ ...s, moves: 1, target: 10000 }, ...findMove(s.board));
  assert.equal(result.session.status, "lost");
  const won = move({ ...s, target: 3 }, ...findMove(s.board));
  assert.equal(won.session.status, "won");
});
test("tools have finite uses, settle the board and do not spend moves", () => {
  let s = newSession(9);
  for (let i = 0; i < 2; i++) {
    const r = useTool(s, "hammer", 8);
    assert.ok(r.valid);
    s = r.session;
  }
  assert.equal(useTool(s, "hammer", 8).valid, false);
  assert.equal(s.moves, 16);
  assert.equal(matches(s.board).length, 0);
  const cross = useTool(newSession(10), "bloom", 28);
  assert.ok(total(cross.session.collected) >= 15);
  const shuffled = useTool(newSession(10), "shuffle");
  assert.equal(shuffled.session.tools.shuffle, 1);
  assert.ok(findMove(shuffled.session.board));
});
test("handmade delivery conserves stock and grants its reward only once", () => {
  const s = freshSave(),
    o = ORDERS[0];
  assert.equal(deliver(s), null);
  s.inventory = Array(6).fill(20);
  s.draft = [...o.palette];
  assert.equal(
    canPlace({ ...s, inventory: [8, 20, 20, 20, 20, 20] }, 0, 0),
    true,
  );
  const next = deliver(s);
  assert.ok(next);
  assert.equal(next.coins, 260);
  assert.equal(total(next.inventory), 108);
  assert.equal(next.collection.length, 1);
  assert.deepEqual(next.collection[0].beads, o.palette);
  assert.deepEqual(s.draft, o.palette);
  assert.equal(deliver({ ...next, draft: o.palette }), null);
  assert.equal(deliver({ ...s, charm: "moon" }), null);
  assert.equal(deliver({ ...s, inventory: [0, 0, 0, 0, 0, 0] }), null);
});
test("all six orders can be crafted and advance the collection", () => {
  let s = { ...freshSave(), inventory: Array(6).fill(50) };
  for (const o of ORDERS) {
    s = { ...s, orderId: o.id, draft: [...o.palette], charm: o.charm };
    s = deliver(s);
    assert.ok(s);
  }
  assert.equal(s.completed.length, 6);
  assert.equal(s.collection.length, 6);
  assert.equal(s.rep, 140);
});
test("furniture purchases are sequential and cannot overspend", () => {
  const s = freshSave();
  assert.equal(purchase(s, "chair", 1), null);
  assert.equal(purchase({ ...s, coins: 1000 }, "chair", 2), null);
  const next = purchase({ ...s, coins: 200 }, "chair", 1);
  assert.equal(next.coins, 40);
  assert.equal(next.upgrades.chair, 1);
  assert.equal(purchase(next, "chair", 1).coins, 40);
  assert.equal(purchase(next, "bogus", 1), null);
});
test("malformed saves are bounded and energy recovery respects time", () => {
  const s = normalizeSave({
    version: 1,
    coins: -2,
    energy: 100,
    inventory: [NaN, Infinity, -3, 8],
    completed: ["daisy", "daisy", "evil"],
    draft: [99, -2, "x", 1],
    upgrades: { chair: 999 },
  });
  assert.equal(s.coins, 0);
  assert.equal(s.energy, 10);
  assert.deepEqual(s.inventory, [0, 0, 0, 8, 0, 0]);
  assert.deepEqual(s.completed, ["daisy"]);
  assert.equal(s.draft[0], null);
  assert.equal(s.upgrades.chair, 2);
  assert.deepEqual(
    normalizeSave({ ...s, collection: [null, 7, { id: "daisy" }] }).collection,
    [],
  );
  const e = refreshEnergy(
    { ...freshSave(), energy: 2, energyAt: 1000 },
    361000,
  );
  assert.equal(e.energy, 4);
  assert.equal(e.energyAt, 361000);
});
