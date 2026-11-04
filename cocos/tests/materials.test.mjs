import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIALS,BEADS} from '../assets/scripts/content.ts';
import {materialPalette,materialStock,charmType} from '../assets/scripts/materials.ts';
import {freshSave,normalizeSave,newSession,bankEarlyCollection,canPlace} from '../assets/scripts/model.ts';
import {craftChecks,finishWork} from '../assets/scripts/commerce.ts';
test('all 48 supplied materials are reachable in six-type match palettes with equal-size categories',()=>{
 assert.equal(BEADS.length,36);assert.equal(MATERIALS.length,48);
 for(let c=0;c<4;c++)assert.equal(MATERIALS.filter(m=>m.category===c).length,12);
 const all=new Set();for(let level=1;level<=8;level++){const types=materialPalette(level);assert.equal(new Set(types).size,6);types.forEach(i=>all.add(i));assert.deepEqual(newSession(42,level).materialTypes,types);}
 assert.equal(all.size,48);assert.deepEqual(materialPalette(9),materialPalette(1));
});
test('only actual eliminated materials unlock, bank once and survive failure, exit and reload',()=>{
 let save=freshSave();for(let level=1;level<=8;level++){
  const session={...newSession(91,level),collected:[3,0,1,0,0,0],status:'lost'};const types=session.materialTypes;
  const before=structuredClone(save),bank=bankEarlyCollection(save,session);save=bank.save;
  assert.equal(save.gatheredStock[types[0]],before.gatheredStock[types[0]]+3);assert.equal(save.gatheredStock[types[2]],before.gatheredStock[types[2]]+1);
  assert.equal(save.materialUnlocked[types[1]],before.materialUnlocked[types[1]]);assert.equal(save.materialUnlocked[types[0]],true);
  assert.deepEqual(bankEarlyCollection(save,bank.session).save,save);assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(save))),save);
 }
});
test('gifted and legacy inventory cannot bypass matching provenance in placement or completion',()=>{
 const old={...freshSave(),inventory:Array(48).fill(100),draft:Array(12).fill(0),coins:1234};delete old.gatheredStock;delete old.materialUnlocked;
 let save=normalizeSave(old);assert.equal(save.coins,1234);assert.equal(save.inventory[0],100);assert.equal(materialStock(save,0),0);assert.equal(canPlace(save,0,0),false);assert.equal(finishWork(save),null);
 const session={...newSession(4,1),collected:[12,0,0,0,0,0]};save=bankEarlyCollection(save,session).save;
 assert.equal(canPlace(save,0,0),true);assert.ok(Object.values(craftChecks(save)).every(Boolean));
 const done=finishWork(save,100);assert.ok(done);assert.equal(done.inventory[0],100);assert.equal(done.gatheredStock[0],0);assert.equal(done.materialUnlocked[0],true);assert.equal(finishWork({...done,draft:Array(12).fill(0)},200),null);
});
test('gathered charms are optional, locked charms are rejected and a saved charm is consumed exactly once',()=>{
 let save=bankEarlyCollection(freshSave(),{...newSession(4,1),collected:[12,0,0,0,0,0]}).save;save.draft=Array(12).fill(0);save.charm='heart';
 assert.equal(finishWork(save,100),null);
 const type=charmType('heart'),session=newSession(4,8),slot=session.materialTypes.indexOf(type);assert.ok(slot>=0);session.collected[slot]=1;save=bankEarlyCollection(save,session).save;
 const done=finishWork(save,100);assert.ok(done);assert.equal(done.gatheredStock[type],0);assert.equal(done.inventory[type],0);assert.equal(done.commerce.works[0].charm,'heart');assert.equal(done.charm,'none');assert.equal(finishWork(done,100),null);
});

test('chosen bead size is preserved in saved work and restored across reload',()=>{
 let save=bankEarlyCollection(freshSave(),{...newSession(4,1),collected:[12,0,0,0,0,0]}).save;
 save.draft=Array(12).fill(0);save.beadSize=10;const done=finishWork(save,100);
 assert.equal(done.commerce.works[0].beadSize,10);assert.equal(normalizeSave(done).commerce.works[0].beadSize,10);
});
