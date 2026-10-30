import { ORDERS, FURNITURE } from "./content.js";
export const SAVE_KEY = "pencil-bead-atelier-v1";
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const total = (a) => a.reduce((s, n) => s + n, 0);
export function matches(board) {
  const hit = new Set();
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const i = y * 8 + x,
        t = board[i];
      if (t < 0) continue;
      if (x < 6 && board[i + 1] === t && board[i + 2] === t) {
        for (let k = x; k < 8 && board[y * 8 + k] === t; k++)
          hit.add(y * 8 + k);
      }
      if (y < 6 && board[i + 8] === t && board[i + 16] === t) {
        for (let k = y; k < 8 && board[k * 8 + x] === t; k++)
          hit.add(k * 8 + x);
      }
    }
  return [...hit];
}
export function adjacent(a, b) {
  return (
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    a < 64 &&
    b >= 0 &&
    b < 64 &&
    (Math.abs(a - b) === 8 ||
      (Math.floor(a / 8) === Math.floor(b / 8) && Math.abs(a - b) === 1))
  );
}
export function findMove(board) {
  for (let i = 0; i < 64; i++)
    for (const j of [i + 1, i + 8]) {
      if (!adjacent(i, j) || board[i] === board[j]) continue;
      const b = [...board];
      [b[i], b[j]] = [b[j], b[i]];
      if (matches(b).length) return [i, j];
    }
  return null;
}
export function createBoard(seed = 1) {
  const random = rng(seed);
  for (let attempt = 0; attempt < 100; attempt++) {
    const board = [];
    for (let i = 0; i < 64; i++) {
      let t;
      do {
        t = Math.floor(random() * 6);
      } while (
        (i % 8 >= 2 && board[i - 1] === t && board[i - 2] === t) ||
        (i >= 16 && board[i - 8] === t && board[i - 16] === t)
      );
      board.push(t);
    }
    if (findMove(board)) return board;
  }
  throw new Error("Unable to create a playable board");
}
export const targetForLevel = (level) => 60 + Math.min(level, 6) * 6;
export function newSession(seed = 1, level = 1) {
  return {
    board: createBoard(seed),
    seed,
    moves: 16,
    target: targetForLevel(level),
    collected: [0, 0, 0, 0, 0, 0],
    score: 0,
    tools: { hammer: 2, shuffle: 2, bloom: 1 },
    status: "playing",
    level,
  };
}
function resolve(board, first, seed) {
  const random = rng(seed);
  const collected = [0, 0, 0, 0, 0, 0],
    frames = [];
  let hit = first;
  for (let chain = 0; hit.length && chain < 40; chain++) {
    const before = [...board];
    for (const i of hit) {
      if (board[i] >= 0) collected[board[i]]++;
      board[i] = -1;
    }
    const falls = [];
    for (let x = 0; x < 8; x++) {
      const col = [];
      for (let y = 7; y >= 0; y--)
        if (board[y * 8 + x] >= 0)
          col.push({ type: board[y * 8 + x], from: y * 8 + x });
      const missing = 8 - col.length;
      for (let y = 7; y >= 0; y--) {
        const retained = col[7 - y];
        const type = retained?.type ?? Math.floor(random() * 6);
        board[y * 8 + x] = type;
        falls.push({
          from: retained?.from ?? null,
          fromRow: retained ? Math.floor(retained.from / 8) : y - missing,
          to: y * 8 + x,
          type,
        });
      }
    }
    frames.push({ before, hit: [...hit], after: [...board], falls });
    hit = matches(board);
  }
  if (matches(board).length) board = createBoard(seed + 7);
  if (!findMove(board)) board = createBoard(seed + 17);
  return { board, collected, frames };
}
export function move(session, a, b) {
  if (session.status !== "playing" || !adjacent(a, b))
    return { valid: false, session };
  const board = [...session.board];
  [board[a], board[b]] = [board[b], board[a]];
  const hit = matches(board);
  if (!hit.length) return { valid: false, session };
  const result = resolve(board, hit, session.seed + session.moves * 997);
  const collected = session.collected.map((v, i) => v + result.collected[i]);
  const moves = session.moves - 1;
  return {
    valid: true,
    frames: result.frames,
    session: {
      ...session,
      board: result.board,
      moves,
      collected,
      score: session.score + total(result.collected) * 10,
      status:
        total(collected) >= session.target
          ? "won"
          : moves <= 0
            ? "lost"
            : "playing",
    },
  };
}
export function useTool(session, tool, index = 0) {
  if (
    session.status !== "playing" ||
    !session.tools[tool] ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 64
  )
    return { valid: false, session };
  const tools = { ...session.tools, [tool]: session.tools[tool] - 1 };
  if (tool === "shuffle")
    return {
      valid: true,
      session: {
        ...session,
        tools,
        board: createBoard(
          session.seed + session.score + session.tools.shuffle * 31,
        ),
      },
      frames: [],
    };
  if (!["hammer", "bloom"].includes(tool)) return { valid: false, session };
  const hit =
    tool === "bloom"
      ? Array.from({ length: 64 }, (_, i) => i).filter(
          (i) =>
            Math.floor(i / 8) === Math.floor(index / 8) || i % 8 === index % 8,
        )
      : [index];
  const result = resolve(
    [...session.board],
    hit,
    session.seed + session.score + 22,
  );
  const collected = session.collected.map((v, i) => v + result.collected[i]);
  return {
    valid: true,
    frames: result.frames,
    session: {
      ...session,
      tools,
      board: result.board,
      collected,
      score: session.score + total(result.collected) * 10,
      status: total(collected) >= session.target ? "won" : "playing",
    },
  };
}
export function freshSave() {
  return {
    version: 1,
    started: false,
    coins: 80,
    rep: 0,
    energy: 10,
    energyAt: Date.now(),
    level: 1,
    inventory: [3, 0, 0, 2, 0, 0],
    completed: [],
    collection: [],
    upgrades: { chair: 0, display: 0, desk: 0 },
    draft: Array(12).fill(null),
    charm: "daisy",
    orderId: "daisy",
    sound: true,
    reduced: false,
    lastStory: -1,
  };
}
const bounded = (v, max = 100000) =>
  Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
export function normalizeSave(input) {
  const s = freshSave();
  if (!input || input.version !== 1) return s;
  for (const k of ["coins", "rep", "level"]) s[k] = bounded(input[k]);
  s.level = Math.max(1, s.level);
  s.started = !!input.started;
  s.sound = input.sound !== false;
  s.reduced = !!input.reduced;
  s.energy = bounded(input.energy, 10);
  s.energyAt = Number.isFinite(input.energyAt)
    ? Math.min(Date.now(), Math.max(0, input.energyAt))
    : Date.now();
  s.inventory = Array.from({ length: 6 }, (_, i) =>
    bounded(input.inventory?.[i]),
  );
  s.completed = [
    ...new Set(
      (Array.isArray(input.completed) ? input.completed : []).filter((id) =>
        ORDERS.some((o) => o.id === id),
      ),
    ),
  ];
  for (const f of FURNITURE)
    s.upgrades[f.id] = bounded(input.upgrades?.[f.id], 2);
  s.draft = Array.from({ length: 12 }, (_, i) =>
    Number.isInteger(input.draft?.[i]) &&
    input.draft[i] >= 0 &&
    input.draft[i] < 6
      ? input.draft[i]
      : null,
  );
  s.charm = ["daisy", "moon", "heart"].includes(input.charm)
    ? input.charm
    : "daisy";
  s.orderId = ORDERS.some((o) => o.id === input.orderId)
    ? input.orderId
    : (ORDERS.find((o) => !s.completed.includes(o.id))?.id ?? "daisy");
  s.collection = (Array.isArray(input.collection) ? input.collection : [])
    .filter(
      (x) =>
        x &&
        ORDERS.some((o) => o.id === x.id) &&
        Array.isArray(x.beads) &&
        x.beads.length === 12 &&
        x.beads.every((n) => Number.isInteger(n) && n >= 0 && n < 6) &&
        ["daisy", "moon", "heart"].includes(x.charm),
    )
    .slice(0, 6);
  s.lastStory = Number.isInteger(input.lastStory)
    ? Math.max(-1, Math.min(6, input.lastStory))
    : -1;
  return s;
}
export function draftCounts(draft) {
  const a = [0, 0, 0, 0, 0, 0];
  for (const n of draft) if (Number.isInteger(n) && n >= 0 && n < 6) a[n]++;
  return a;
}
export function canPlace(save, type, index) {
  if (
    !Number.isInteger(type) ||
    type < 0 ||
    type > 5 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 12
  )
    return false;
  const counts = draftCounts(save.draft);
  if (save.draft[index] === type) counts[type]--;
  return counts[type] < save.inventory[type];
}
export function checkOrder(
  save,
  order = ORDERS.find((o) => o.id === save.orderId),
) {
  const counts = draftCounts(save.draft);
  return {
    full: save.draft.every((n) => n !== null),
    main: counts[order.main] >= order.mainNeed,
    accent: counts[order.accent] >= order.accentNeed,
    charm: save.charm === order.charm,
    stock: counts.every((n, i) => n <= save.inventory[i]),
  };
}
export function deliver(save) {
  const order = ORDERS.find((o) => o.id === save.orderId);
  const checks = checkOrder(save, order);
  if (
    save.completed.includes(order.id) ||
    !Object.values(checks).every(Boolean)
  )
    return null;
  const counts = draftCounts(save.draft);
  return {
    ...save,
    coins: save.coins + order.reward,
    rep: save.rep + order.rep,
    inventory: save.inventory.map((n, i) => n - counts[i]),
    completed: [...save.completed, order.id],
    collection: [
      ...save.collection,
      { id: order.id, beads: [...save.draft], charm: save.charm },
    ],
    draft: Array(12).fill(null),
  };
}
export function purchase(save, id, tier) {
  const item = FURNITURE.find((f) => f.id === id);
  if (!item || !Number.isInteger(tier) || tier < 0 || tier > 2) return null;
  const owned = save.upgrades[id];
  if (tier <= owned) return { ...save };
  if (tier !== owned + 1 || save.coins < item.prices[tier]) return null;
  return {
    ...save,
    coins: save.coins - item.prices[tier],
    upgrades: { ...save.upgrades, [id]: tier },
  };
}
export function refreshEnergy(save, now = Date.now()) {
  const recovered = Math.max(0, Math.floor((now - save.energyAt) / 180000));
  return {
    ...save,
    energy: Math.min(10, save.energy + recovered),
    energyAt: save.energy >= 10 ? now : save.energyAt + recovered * 180000,
  };
}
