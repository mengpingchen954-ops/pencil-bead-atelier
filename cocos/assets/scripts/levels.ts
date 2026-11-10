// @ts-nocheck
// Authored opening sequence: teach one objective at a time, then combine them.
const L = (title, moves, total, main = 0, accent = 0, paper = [], thread = [], tip = '') =>
  ({ title, moves, total, main, accent, paper, thread, tip });
const CORNERS = [9, 14, 49, 54];
const RING = [10, 13, 18, 21, 42, 45, 50, 53];
const CROSS = [19, 20, 26, 29, 34, 37, 43, 44];
export const OPENING_LEVELS = [
  L('打开旧珠盒', 16, 66, 0, 0, [], [], '交换相邻珠子，同色三连或 2×2 方块都能采珠。'),
  L('为心愿挑颜色', 17, 0, 10, 0, [], [], '留意本关需要收集的颜色。点一下特殊珠子，或交换它，就能发动。'),
  L('拆开材料纸袋', 18, 48, 0, 0, CORNERS, [], '在纸袋所在格或它的上下左右消除，就能打开纸袋。'),
  L('松开打结的线', 19, 0, 0, 8, [], CORNERS, '在线结所在格消除珠子，就能解开它；线结不会随珠子落下。'),
  L('留一抹喜欢的颜色', 19, 72, 12, 0, [], [], '把同色珠子聚成四连，让丝线珠替你收集整行或整列。'),
  L('纸袋里的小惊喜', 19, 0, 0, 0, RING, [], '纸袋围成一圈，利用特殊珠子打开更远的纸袋。'),
  L('把心意慢慢理顺', 20, 0, 14, 0, [], [10, 13, 26, 29, 50, 53], '消除线结格中的珠子，同时收集本关目标色。'),
  L('一桌闪亮的材料', 20, 84, 0, 0, [9, 14, 27, 28, 49, 54], [], '连锁会继续收集珠子，也会打开相邻纸袋。'),
  L('两种颜色的约定', 20, 0, 12, 8, [], [], '主色与辅色都要备齐；先看目标，再安排交换。'),
  L('拆袋与理线', 23, 0, 0, 0, RING, [19, 20, 27, 28, 43, 44], '纸袋靠相邻消除打开，线结需要在所在格消除。'),
  L('旧珠盒焕新', 23, 96, 0, 0, [], CROSS, '特殊珠子的连锁也能解开线结。'),
  L('装满喜欢的颜色', 23, 0, 16, 0, RING, [], '线消适合长距离采集，花束珠会收集周围九格。'),
  L('温柔的点缀', 23, 0, 0, 12, [], CROSS, '别忘了辅色；小木槌可以处理最后一个难解的线结。'),
  L('把零散串成光', 24, 108, 0, 0, RING, [], '优先制造特殊珠子，再让它们相互触发。'),
  L('一份完整的心意', 26, 0, 18, 10, [9, 14, 26, 29, 49, 54], [18, 21, 27, 28, 42, 45], '颜色、纸袋与线结一起完成，就是满载而归。'),
];
export function levelConfig(level = 1, order = null) {
  const n = Math.max(1, Number.isFinite(level) ? Math.floor(level) : 1);
  const source = OPENING_LEVELS[(n - 1) % OPENING_LEVELS.length];
  const season=Math.floor((n-1)/15)+1;
  const main = Number.isInteger(order?.main) ? order.main : 0;
  const accent = Number.isInteger(order?.accent) ? order.accent : 3;
  const objectives = [];
  if (source.total) objectives.push({ kind: 'total', target: source.total });
  if (source.main) objectives.push({ kind: 'color', type: main, target: source.main });
  if (source.accent) objectives.push({ kind: 'color', type: accent, target: source.accent });
  if (source.paper.length) objectives.push({ kind: 'paper', target: source.paper.length });
  if (source.thread.length) objectives.push({ kind: 'thread', target: source.thread.length });
  const obstacles = Array(64).fill('');
  const position=i=>(i+8*((season-1)%8))%64;
  source.paper.forEach(i => obstacles[position(i)] = 'paper');
  source.thread.forEach(i => obstacles[position(i)] = 'thread');
  return { level: n, title: (season>1?'第'+season+'季 · ':'')+source.title, moves: source.moves, target: source.total,
    objectives, obstacles, tip: source.tip, chapter: Math.floor((n - 1) / 15) + 1 };
}
