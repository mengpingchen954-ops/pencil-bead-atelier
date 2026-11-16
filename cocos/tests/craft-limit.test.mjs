import {MATERIALS as TEST_MATERIALS} from '../assets/scripts/content.ts';
const MATERIAL_COUNT=TEST_MATERIALS.length;
import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSave,canPlace,craftTarget,normalizeSave} from '../assets/scripts/model.ts';
import {craftChecks,finishWork,listWork,suggestedPrice} from '../assets/scripts/commerce.ts';
import {ringAngle,ringRadius} from '../assets/scripts/materials.ts';
test('free works accept 1 through 20 pieces and preserve them through listing and reload',()=>{
 for(let count=1;count<=20;count++){
  const save={...freshSave(),draft:Array(count).fill(0),inventory:Array(MATERIAL_COUNT).fill(30),gatheredStock:Array(MATERIAL_COUNT).fill(30)};
  assert.equal(craftChecks(save).full,true);const finished=finishWork(save,1000),listed=listWork(finished,1,suggestedPrice(save.draft),2000);
  assert.equal(normalizeSave(listed).commerce.works[0].beads.length,count);
  assert.equal(canPlace(save,0,count),count<20);assert.equal(craftTarget(save.draft,-1,()=>0,true),count<20?count:-1);
 }
 const save={...freshSave(),draft:Array(21).fill(0),inventory:Array(MATERIAL_COUNT).fill(30),gatheredStock:Array(MATERIAL_COUNT).fill(30)};
 assert.equal(finishWork(save,1000),null);assert.equal(normalizeSave(save).draft.length,21,'Existing drafts are preserved for editing');
 assert.equal(craftTarget(Array(20).fill(0),5,()=>0,true),5);assert.equal(craftTarget([...Array(19).fill(0),null],-1,()=>0,true),19);
});
test('the ring expands instead of shrinking beads, preserving gaps with mixed sizes up to twenty pieces',()=>{
 for(let count=2;count<=20;count++){
  const beads=Array.from({length:count},(_,i)=>i===Math.floor(count/2)?38:0),sizes=beads.map((_,i)=>[6,8,10,12][i%4]),radius=ringRadius(beads,sizes);
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
   if(beads[i]===38||beads[j]===38)continue;
   const a=ringAngle(beads,i,sizes),b=ringAngle(beads,j,sizes),distance=radius*Math.hypot(Math.cos(a)-Math.cos(b),Math.sin(a)-Math.sin(b));
   assert.ok(distance-76*(sizes[i]+sizes[j])/16>=4-1e-10);
  }
 }
 assert.ok(ringRadius(Array(20).fill(0),Array(20).fill(8))>ringRadius(Array(12).fill(0),Array(12).fill(8)));
});
test('charm attachment narrows both adjacent gaps; bead-only spacing stays unchanged',()=>{
 const plain=Array(12).fill(0),charmed=[...plain];charmed[6]=38;
 const gap=(beads,index)=>ringAngle(beads,index+1)-ringAngle(beads,index);
 assert.ok(gap(charmed,5)<gap(plain,5)*.75);assert.ok(gap(charmed,6)<gap(plain,6)*.75);
 for(let i=0;i<12;i++)assert.ok(Math.abs(ringAngle(plain,i)-(i*Math.PI*2/12-Math.PI/2))<1e-12);
});
