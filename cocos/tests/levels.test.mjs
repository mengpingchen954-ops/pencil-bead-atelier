import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDERS } from '../assets/scripts/content.ts';
import { OPENING_LEVELS } from '../assets/scripts/levels.ts';
import { levelConfig, newSession, move, useTool, activateSpecial, findMove, matches, goalProgress, sessionRewards, freshSave, total } from '../assets/scripts/model.ts';

const stable = () => Array.from({ length: 64 }, (_, i) => (i % 8 + Math.floor(i / 8)) % 6);
function longLine(length, vertical = false) {
  const board = stable();
  if (vertical) {
    [11, 19, 35].forEach(i => board[i] = 5); board[27] = 2; board[26] = 5;
    if (length === 5) board[43] = 5;
  } else {
    [24, 25, 27].forEach(i => board[i] = 5); board[26] = 2; board[18] = 5;
    if (length === 5) board[28] = 5;
  }
  assert.deepEqual(matches(board), []);
  return { ...newSession(55), board, target: 10000 };
}

test('15 authored stages introduce color, paper and thread goals progressively with independent layouts', () => {
  assert.equal(OPENING_LEVELS.length, 15);
  assert.equal(new Set(OPENING_LEVELS.map(level => level.title)).size, 15);
  for (let level = 1; level <= 15; level++) {
    const config = levelConfig(level, ORDERS[1]);
    assert.ok(config.moves >= 16 && config.moves <= 24);
    assert.ok(config.objectives.length > 0 && config.objectives.every(goal => goal.target > 0));
    assert.equal(config.obstacles.length, 64);
    for (const goal of config.objectives) {
      if (['paper', 'thread'].includes(goal.kind)) assert.equal(config.obstacles.filter(x => x === goal.kind).length, goal.target);
      if (goal.kind === 'color') assert.ok([ORDERS[1].main, ORDERS[1].accent].includes(goal.type));
    }
    config.obstacles[0] = 'thread';
    assert.notEqual(levelConfig(level, ORDERS[1]).obstacles[0], 'thread');
    for (let seed = 1; seed <= 24; seed++) {
      const session = newSession(seed, level, ORDERS[1]);
      const snapshot = JSON.stringify(session), pair = findMove(session.board, session.specials, session.obstacles);
      assert.deepEqual(matches(session.board), []); assert.ok(pair);
      const result = move(session, ...pair); assert.ok(result.valid);
      assert.equal(result.session.moves, session.moves - 1); assert.equal(JSON.stringify(session), snapshot);
      assert.deepEqual(matches(result.session.board), []); assert.ok(findMove(result.session.board, result.session.specials));
      assert.equal(result.session.specials.length, 64);
      assert.deepEqual(result.session.obstacles, result.frames.at(-1).obstaclesAfter);
    }
  }
  assert.equal(levelConfig(16).chapter, 2); assert.equal(levelConfig(16).title, levelConfig(1).title);
});

test('four in a line retains a directional special and five retains a burst, without counting the survivor as collected', () => {
  for (const [length, vertical, kind] of [[4, false, 'row'], [4, true, 'column'], [5, false, 'burst']]) {
    const session = longLine(length, vertical), pair = vertical ? [26, 27] : [18, 26];
    const result = move(session, ...pair), frame = result.frames[0];
    assert.ok(result.valid); assert.equal(frame.created.length, 1);
    const creation = frame.created[0]; assert.equal(creation.kind, kind); assert.equal(creation.index, pair[1]);
    assert.ok(!frame.hit.includes(creation.index)); assert.equal(frame.hit.length, length - 1);
    assert.equal(frame.activated.length, 0);
    const survivor = frame.falls.find(f => f.from === creation.index);
    assert.ok(survivor); assert.equal(survivor.special, kind); assert.equal(frame.specialsAfter[survivor.to], kind);
    assert.equal(frame.before[creation.index], survivor.type);
    for (const cascade of result.frames) {
      assert.equal(cascade.falls.filter(f => f.from !== null).length, 64 - cascade.hit.length);
      assert.equal(new Set(cascade.falls.filter(f => f.from !== null).map(f => f.from)).size, 64 - cascade.hit.length);
      for (const fall of cascade.falls) assert.equal(cascade.specialsAfter[fall.to], fall.special);
    }
    const counted = Array(6).fill(0);
    result.frames.forEach(f => f.hit.forEach(i => counted[f.before[i]]++));
    assert.deepEqual(result.session.collected, counted);
  }
});

test('special click and special swaps use one move, activate once each, and chain across row, column and burst', () => {
  const session = { ...newSession(73), board: stable(), target: 10000 };
  session.specials[27] = 'row'; session.specials[29] = 'column'; session.specials[45] = 'burst';
  const original = JSON.stringify(session), result = activateSpecial(session, 27), first = result.frames[0];
  assert.ok(result.valid); assert.equal(result.session.moves, session.moves - 1);
  assert.equal(first.activated.length, 3); assert.equal(new Set(first.activated.map(x => x.index)).size, 3);
  assert.equal(new Set(first.hit).size, first.hit.length);
  for (let i = 24; i < 32; i++) assert.ok(first.hit.includes(i));
  for (let i = 5; i < 64; i += 8) assert.ok(first.hit.includes(i));
  assert.ok(first.hit.includes(44)); assert.ok(first.hit.includes(54));
  assert.equal(JSON.stringify(session), original);
  assert.equal(activateSpecial(session, 12).valid, false);
  assert.equal(activateSpecial({ ...session, moves: 0 }, 27).valid, false);
  assert.equal(activateSpecial({ ...session, status: 'won' }, 27).valid, false);
  const pair = findMove(session.board, session.specials); assert.ok(pair);
  const swapped = move(session, ...pair); assert.ok(swapped.valid); assert.equal(swapped.session.moves, session.moves - 1);
  assert.ok(swapped.frames[0].activated.length > 0);
});

test('paper opens next to a clear, thread only on a cleared cell, and fixed obstacles do not fall', () => {
  const session = { ...newSession(81, 10), board: stable(), target: 10000,
    objectives: [{kind:'paper',target:2},{kind:'thread',target:2}], cleared: {paper:0,thread:0}, obstacles: Array(64).fill('') };
  session.obstacles[20] = 'paper'; session.obstacles[28] = 'paper';
  session.obstacles[27] = 'thread'; session.obstacles[35] = 'thread';
  const result = useTool(session, 'hammer', 27), frame = result.frames[0];
  assert.equal(frame.obstaclesAfter[28], ''); assert.equal(frame.obstaclesAfter[27], '');
  assert.equal(frame.obstaclesAfter[20], 'paper'); assert.equal(frame.obstaclesAfter[35], 'thread');
  assert.deepEqual(frame.cleared, {paper:1,thread:1}); assert.equal(result.session.moves, session.moves);
  assert.equal(result.session.status, 'playing');
  const progress = goalProgress(result.session); assert.equal(progress[0].current, result.session.cleared.paper);
  assert.equal(progress[1].current, result.session.cleared.thread);
  const tools = { ...result.session.tools, bloom: 1 };
  const finish = useTool({...result.session, tools}, 'bloom', 19);
  assert.equal(finish.session.cleared.paper, 2); assert.equal(finish.session.cleared.thread, 2);
  assert.equal(finish.session.status, 'won'); assert.ok(goalProgress(finish.session).every(goal => goal.done));
});

test('every goal must complete before victory, including on the last move; exhausted tools never spend stock or moves', () => {
  const session = {...newSession(17, 9, ORDERS[1]), board: stable(), moves:1, specials:Array(64).fill(''),
    objectives:[{kind:'color',type:2,target:8},{kind:'thread',target:1}], collected:[0,0,8,0,0,0],
    obstacles:Array(64).fill(''), cleared:{paper:0,thread:0}};
  session.specials[27]='row'; session.obstacles[27]='thread';
  const won=activateSpecial(session,27); assert.equal(won.session.status,'won'); assert.equal(won.session.moves,0);
  session.obstacles[27]='';session.obstacles[0]='thread';
  const lost=activateSpecial(session,27); assert.equal(lost.session.status,'lost');
  assert.equal(goalProgress(lost.session).find(goal=>goal.kind==='thread').done,false);
  assert.equal(useTool({...session,tools:{hammer:0}},'hammer',0).valid,false);
  assert.equal(useTool({...session,status:'won'},'hammer',0).valid,false);
});

test('shuffling preserves each special and every obstacle without awarding collection or spending a move', () => {
  const session=newSession(51,15,ORDERS[2]); session.specials[5]='row';session.specials[29]='column';session.specials[48]='burst';
  const before=JSON.stringify(session),result=useTool(session,'shuffle');
  assert.ok(result.valid);assert.deepEqual(result.session.specials,session.specials);assert.deepEqual(result.session.obstacles,session.obstacles);
  assert.deepEqual(result.session.collected,session.collected);assert.equal(result.session.moves,session.moves);
  assert.equal(result.session.tools.shuffle,1);assert.equal(JSON.stringify(session),before);
  assert.deepEqual(matches(result.session.board),[]);assert.ok(findMove(result.session.board,result.session.specials));
});

test('commission rewards use the final fixed budget without missing-recipe bonuses', () => {
  const save=freshSave(),session=newSession(31,1,ORDERS[1]);
  session.collected=[9,10,19,20,29,30];session.status='won';
  const before=JSON.stringify({session,save}),reward=sessionRewards(session,save);
  const expected=[0,0,3,3,4,4];

  assert.deepEqual(reward,expected);assert.deepEqual(sessionRewards(session,save),reward);
  assert.equal(total(reward),14);assert.equal(reward.filter(Boolean).length,4);
  assert.equal(JSON.stringify({session,save}),before);
  assert.deepEqual(sessionRewards({...session,status:'lost'},save),Array(6).fill(0));
  assert.deepEqual(sessionRewards({...session,status:'playing'},save),Array(6).fill(0));
  assert.deepEqual(sessionRewards(session,{...save,inventory:Array(6).fill(100)}),expected);
});


test('all 15 authored stages can finish through legal goal-focused moves and finite tools on multiple deterministic boards', () => {
  const merit = session => goalProgress(session).reduce((sum, goal) => sum + Math.min(goal.current, goal.target) / goal.target, 0) * 100
    + session.specials.filter(Boolean).length * 1.8 + total(session.collected) * .005;
  for (let level = 1; level <= 15; level++) for (const seed of [971, 2913, 5826]) {
    let session = newSession(seed, level, ORDERS[level % 6]);
    for (let guard = 0; guard < 40 && session.status === 'playing'; guard++) {
      let best = null, score = -Infinity;
      const choose = result => {
        if (!result.valid) return;
        const next = merit(result.session) + (result.session.status === 'won' ? 10000 : 0);
        if (next > score) { score = next; best = result; }
      };
      for (let i = 0; i < 64; i++) {
        for (const j of [i + 1, i + 8]) choose(move(session, i, j));
        if (session.specials[i]) choose(activateSpecial(session, i));
        if (session.moves <= 4) for (const tool of ['hammer', 'bloom']) if (session.tools[tool]) choose(useTool(session, tool, i));
      }
      assert.ok(best, `stage ${level} seed ${seed} has a legal action`);
      session = best.session;
    }
    assert.equal(session.status, 'won', `stage ${level} seed ${seed}: ${JSON.stringify(goalProgress(session))}`);
    assert.ok(goalProgress(session).every(goal => goal.done));
    assert.ok(Object.values(session.tools).every(n => n >= 0));
    assert.deepEqual(matches(session.board), []);
  }
});
