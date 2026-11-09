import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIALS,BEADS} from '../assets/scripts/content.ts';
import {materialPalette,materialStock,charmType,MATERIAL_DROPS} from '../assets/scripts/materials.ts';
import {freshSave,normalizeSave,newSession,bankEarlyCollection,gatheredMaterials,canPlace,findMove,move,useTool,activateSpecial,createBoard,matches} from '../assets/scripts/model.ts';
import {ORDERS} from '../assets/scripts/content.ts';
import {craftChecks,finishWork} from '../assets/scripts/commerce.ts';
test('all 48 supplied materials are reachable in weighted six-type match palettes',()=>{
 assert.equal(BEADS.length,36);assert.equal(MATERIALS.length,48);
 for(let c=0;c<4;c++)assert.equal(MATERIALS.filter(m=>m.category===c).length,12);
 assert.deepEqual(MATERIAL_DROPS,[0,0,0,0,0,0,0,0,1,1,1,2,2,2,2,3,4,4,5,5]);
 const all=new Set();for(let level=1;level<=12;level++){const types=materialPalette(level);assert.equal(new Set(types).size,6);assert.deepEqual(types.map(i=>MATERIALS[i].category),[0,1,0,1,2,3]);types.forEach(i=>all.add(i));assert.deepEqual(newSession(42,level).materialTypes,types);}
 assert.equal(all.size,48);assert.deepEqual(materialPalette(13),materialPalette(1));
});

test('every level favors pale materials, caps dark draw weight at 20%, and retains category weights',()=>{
 const dark=new Set([1,14,17,20,21,22,25,27,28,29,31,32,34,35]);
 const counts={light:0,dark:0};
 for(let level=1;level<=24;level++){
  const types=materialPalette(level),draws=MATERIAL_DROPS.map(slot=>types[slot]);
  assert.ok([0,7,8,6,9,10].includes(types[0]));assert.ok([19,16,15,18].includes(types[1]));
  assert.ok(draws.filter(type=>dark.has(type)).length<=4,'dark weight at level '+level);
  assert.deepEqual([0,1,2,3].map(category=>draws.filter(type=>MATERIALS[type].category===category).length),[12,4,2,2]);
  for(let seed=1;seed<=100;seed++){
   const session=newSession(seed,level);session.board.forEach(slot=>counts[dark.has(types[slot])?'dark':'light']++);
   assert.deepEqual(matches(session.board),[]);assert.ok(findMove(session.board));
  }
 }
 assert.ok(counts.dark/(counts.light+counts.dark)<.15,JSON.stringify(counts));
});
test('only awarded materials unlock, bank once and survive failure and reload',()=>{
 let save=freshSave();for(let level=1;level<=8;level++){
  const session={...newSession(91,level),collected:[30,20,10,5,2,1],status:'lost',moves:0};const types=session.materialTypes;
  const before=structuredClone(save),bank=bankEarlyCollection(save,session);save=bank.save;
  gatheredMaterials(session).forEach((n,i)=>{assert.equal(save.gatheredStock[types[i]],before.gatheredStock[types[i]]+n);assert.equal(save.materialUnlocked[types[i]],before.materialUnlocked[types[i]]||n>0);});
  assert.deepEqual(bankEarlyCollection(save,bank.session).save,save);assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(save))),save);
 }
});
test('gifted and legacy inventory cannot bypass matching provenance in placement or completion',()=>{
 const old={...freshSave(),inventory:Array(48).fill(100),draft:Array(12).fill(0),coins:1234};delete old.gatheredStock;delete old.materialUnlocked;
 let save=normalizeSave(old);assert.equal(save.coins,1234);assert.equal(save.inventory[0],100);assert.equal(materialStock(save,0),0);assert.equal(canPlace(save,0,0),false);assert.equal(finishWork(save),null);
 save={...save,inventory:save.inventory.map((n,i)=>n+(i===0?12:0)),gatheredStock:[12,...Array(47).fill(0)],materialUnlocked:[true,...Array(47).fill(false)]};
 assert.equal(canPlace(save,0,0),true);assert.ok(Object.values(craftChecks(save)).every(Boolean));
 const done=finishWork(save,100);assert.ok(done);assert.equal(done.inventory[0],100);assert.equal(done.gatheredStock[0],0);assert.equal(done.materialUnlocked[0],true);assert.equal(finishWork({...done,draft:Array(12).fill(0)},200),null);
});
test('gathered charms are optional, locked charms are rejected and a saved charm is consumed exactly once',()=>{
 let save={...freshSave(),inventory:[12,...Array(47).fill(0)],gatheredStock:[12,...Array(47).fill(0)],materialUnlocked:[true,...Array(47).fill(false)]};save.draft=Array(12).fill(0);save.charm='heart';
 assert.equal(finishWork(save,100),null);
 const type=charmType('heart'),session=newSession(4,12),slot=session.materialTypes.indexOf(type);assert.ok(slot>=0);save.inventory[type]=save.gatheredStock[type]=1;save.materialUnlocked[type]=true;
 const done=finishWork(save,100);assert.ok(done);assert.equal(done.gatheredStock[type],0);assert.equal(done.inventory[type],0);assert.equal(done.commerce.works[0].charm,'heart');assert.equal(done.charm,'none');assert.equal(finishWork(done,100),null);
});

test('weighted match boards and refills favor jewelry and crystal while retaining every category',()=>{
 const counts=[0,0,0,0],routes=Object.fromEntries(['move','special','hammer','bloom','shuffle'].map(name=>[name,[0,0,0,0]]));
 for(let seed=1;seed<=800;seed++){
  const session=newSession(seed,1),categories=session.board.map(type=>MATERIALS[session.materialTypes[type]].category);
  categories.forEach(category=>counts[category]++);
  assert.deepEqual([...new Set(categories)].sort(),[0,1,2,3]);
  assert.deepEqual(matches(session.board),[]);
  const pair=findMove(session.board);assert.ok(pair);
  const special={...session,specials:[...session.specials]};special.specials[27]='row';
  const results={move:move(session,...pair),special:activateSpecial(special,27),hammer:useTool(session,'hammer',27),bloom:useTool(session,'bloom',27),shuffle:useTool(session,'shuffle')};
  for(const [route,result] of Object.entries(results)){
   assert.equal(result.valid,true);assert.deepEqual(matches(result.session.board),[]);assert.ok(findMove(result.session.board,result.session.specials));
   const types=route==='shuffle'?result.session.board:result.frames.flatMap(frame=>frame.falls.filter(f=>f.from===null).map(f=>f.type));
   types.forEach(type=>routes[route][MATERIALS[session.materialTypes[type]].category]++);
  }
 }
 const check=(values,name)=>{const total=values.reduce((a,b)=>a+b,0);assert.ok(total>1000,name);values.forEach((count,category)=>assert.ok(Math.abs(count/total-[.6,.2,.1,.1][category])<.05,name+': '+values));};
 check(counts,'opening');for(const [route,values] of Object.entries(routes))check(values,route);
});

test('legacy order boards retain their original uniform generation',()=>{
 for(const seed of [1,42,971])assert.deepEqual(newSession(seed,1,ORDERS[0]).board,createBoard(seed));
});

test('chosen bead size is preserved in saved work and restored across reload',()=>{
 let save={...freshSave(),inventory:[12,...Array(47).fill(0)],gatheredStock:[12,...Array(47).fill(0)],materialUnlocked:[true,...Array(47).fill(false)]};
 save.draft=Array(12).fill(0);save.beadSize=10;delete save.draftSizes;const done=finishWork(save,100);
 assert.equal(done.commerce.works[0].beadSize,10);assert.deepEqual(done.commerce.works[0].beadSizes,Array(12).fill(10));assert.deepEqual(normalizeSave(done).commerce.works[0].beadSizes,Array(12).fill(10));
});

test('wood-era and later levels always contain all four categories and bank their actual IDs',()=>{
 for(const level of [1,5,6,13,14,29,30,100,100000]){
  const session=newSession(19,level);assert.deepEqual([...new Set(session.board.map(t=>MATERIALS[session.materialTypes[t]].category))].sort(),[0,1,2,3]);
  const collected=[30,40,50,60,70,80],completed={...session,collected,status:'lost',moves:0},reward=gatheredMaterials(completed),bank=bankEarlyCollection(freshSave(),completed).save;
  session.materialTypes.forEach((type,i)=>{assert.equal(bank.inventory[type],reward[i]);assert.equal(bank.gatheredStock[type],reward[i]);assert.equal(bank.materialUnlocked[type],reward[i]>0);});
  assert.equal(bank.inventory.reduce((n,m)=>n+m,0),reward.reduce((n,m)=>n+m,0));
 }
});
