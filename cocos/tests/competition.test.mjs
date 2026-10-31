import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, normalizeSave } from '../assets/scripts/model.ts';
import { COMPETITIONS, beginCompetition, evaluateCompetition, submitCompetition, competitionPalette } from '../assets/scripts/competition.ts';
const ids=['daisy','sea','rose','forest','violet','promise'];
test('occasional invitations open after the first, third and fifth commissions',()=>{
  for(let count=0;count<=6;count++)for(const event of COMPETITIONS){
    const save={...freshSave(),completed:ids.slice(0,count)};
    assert.equal(!!beginCompetition(save,event.id),count>=event.unlock);
  }
  assert.equal(beginCompetition(freshSave(),'unknown'),null);
});
test('judges use the published rubric, with gold, silver, bronze and participation awards',()=>{
  const gold=evaluateCompetition('spring',competitionPalette('spring'),'daisy');
  assert.deepEqual(gold,{score:100,theme:45,accent:20,detail:10,echo:25,medal:'金色灵感奖',reward:60});
  assert.equal(evaluateCompetition('spring',Array(12).fill(3),'daisy').medal,'银色巧思奖');
  assert.equal(evaluateCompetition('spring',[3,3,3,3,3,3,5,5,5,0,0,0],'heart').medal,'铜色心意奖');
  assert.equal(evaluateCompetition('spring',Array(12).fill(1),'heart').medal,'参与纪念奖');
  for(const beads of [Array(12),Array(12).fill(null),Array(11).fill(3),Array(12).fill(9),Array(12).fill(NaN)])assert.equal(evaluateCompetition('spring',beads,'daisy'),null);
  assert.equal(evaluateCompetition('spring',competitionPalette('spring'),'unknown'),null);
});
test('submissions reward once and leave commission work, inventory, stories and energy intact',()=>{
  const base={...freshSave(),completed:['daisy'],draft:[0,...Array(11).fill(null)],charm:'heart'};
  let save=beginCompetition(base,'spring');
  assert.equal(submitCompetition(save),null);
  save.competitions.draft.beads=competitionPalette('spring');
  const next=submitCompetition(save);
  assert.equal(next.coins,base.coins+60);assert.equal(next.competitions.draft,null);
  for(const key of ['draft','charm','inventory','energy','rep','completed','collection','seenStories'])assert.deepEqual(next[key],base[key]);
  assert.equal(beginCompetition(next,'spring'),null);assert.equal(submitCompetition(next),null);
  assert.equal(submitCompetition({...next,competitions:{...next.competitions,draft:save.competitions.draft}}),null);
  save.competitions.draft.beads[0]=1;
  assert.equal(next.competitions.entries[0].beads[0],3);
});
test('unfinished designs survive reload; changing theme needs an explicit replacement',()=>{
  const base={...freshSave(),completed:ids.slice(0,3)};
  let save=beginCompetition(base,'spring');save.competitions.draft.beads[2]=5;
  const restored=normalizeSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.competitions,save.competitions);
  assert.equal(beginCompetition(restored,'spring'),restored);
  assert.equal(beginCompetition(restored,'sea'),null);
  save=beginCompetition(restored,'sea',true);
  assert.equal(save.competitions.draft.id,'sea');assert.equal(save.competitions.draft.beads[2],null);
  assert.equal(restored.competitions.draft.beads[2],5);
});
test('save import filters locked or malformed contests and recomputes forged scores without rewards',()=>{
  const old=freshSave();delete old.competitions;
  assert.deepEqual(normalizeSave(old).competitions,{draft:null,entries:[]});
  const entry={id:'spring',beads:competitionPalette('spring'),charm:'daisy',score:999,reward:999999};
  const save=normalizeSave({...old,completed:['daisy'],competitions:{draft:{id:'sea',beads:Array(12).fill(2),charm:'moon'},entries:[entry,entry,{...entry,id:'sea'}]}});
  assert.equal(save.coins,old.coins);assert.equal(save.competitions.draft,null);
  assert.equal(save.competitions.entries.length,1);assert.equal(save.competitions.entries[0].score,100);assert.equal(save.competitions.entries[0].reward,60);
  const reloaded=normalizeSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(reloaded.competitions,save.competitions);assert.equal(reloaded.coins,old.coins);
});
