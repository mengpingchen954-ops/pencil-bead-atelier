import test from 'node:test';
import assert from 'node:assert/strict';
import {MATERIALS} from '../assets/scripts/content.ts';
import {categoryMaterials} from '../assets/scripts/materials.ts';
import {freshSave,normalizeSave,newSession,bankEarlyCollection,gatheredMaterials} from '../assets/scripts/model.ts';
import {finishWork} from '../assets/scripts/commerce.ts';

test('each category puts unlocked materials first in first-unlock order, leaving locked and practice order stable',()=>{
 const save=freshSave();
 for(let c=0;c<4;c++){
  const catalog=categoryMaterials(c),unlocked=catalog.slice(-3).reverse();
  unlocked.forEach(i=>save.materialUnlocked[i]=true);save.materialUnlockOrder.push(...unlocked);
  assert.deepEqual(categoryMaterials(c,false,save),[...unlocked,...catalog.filter(i=>!unlocked.includes(i))]);
  assert.deepEqual(categoryMaterials(c,true,save),categoryMaterials(c,true));
 }
 assert.deepEqual(categoryMaterials(0,false,freshSave()),categoryMaterials(0));
});

test('new rewards append unlocks once, and repeated acquisition cannot move an earlier unlock',()=>{
 let save=freshSave();
 for(const level of [5,1,12,5]){
  const session={...newSession(42,level),status:'won',moves:0,collected:[60,50,40,30,20,10]},before=structuredClone(save);
  const newly=session.materialTypes.filter((type,slot)=>gatheredMaterials(session)[slot]>0&&!save.materialUnlocked[type]);
  const bank=bankEarlyCollection(save,session);
  assert.deepEqual(bank.save.materialUnlockOrder,[...save.materialUnlockOrder,...newly]);assert.deepEqual(save,before);
  assert.deepEqual(bankEarlyCollection(bank.save,bank.session),bank);save=normalizeSave(JSON.parse(JSON.stringify(bank.save)));
  assert.deepEqual(save.materialUnlockOrder,bank.save.materialUnlockOrder);
 }
});

test('legacy, partial and malformed history migrates without losing stock, unlocking materials or changing stable order',()=>{
 const old=freshSave(),ids=[0,2,7,51,90,148];ids.forEach(i=>{old.materialUnlocked[i]=true;old.inventory[i]=old.gatheredStock[i]=5;});
 delete old.materialUnlockOrder;
 const legacy=normalizeSave(old);assert.deepEqual(legacy.materialUnlockOrder,ids);assert.deepEqual(legacy.inventory,old.inventory);
 for(const history of [null,{},'wrong',42])assert.deepEqual(normalizeSave({...old,materialUnlockOrder:history}).materialUnlockOrder,ids);
 const save=normalizeSave({...old,materialUnlockOrder:[90,90,-1,999,3,'51',2.5,null,51]});
 assert.deepEqual(save.materialUnlockOrder,[90,51,0,2,7,148]);assert.deepEqual(save.materialUnlocked,old.materialUnlocked);
 assert.deepEqual(normalizeSave(save),save);
});

test('using all stock and reloading keeps material unlock positions',()=>{
 const save=freshSave(),types=categoryMaterials(0).slice(-2).reverse();
 types.forEach(i=>{save.materialUnlocked[i]=true;save.inventory[i]=save.gatheredStock[i]=1;});save.materialUnlockOrder=types;save.draft=types;
 const done=normalizeSave(finishWork(save,1000));assert.ok(done);assert.ok(types.every(i=>done.gatheredStock[i]===0));
 assert.deepEqual(done.materialUnlockOrder,types);assert.deepEqual(categoryMaterials(0,false,done).slice(0,2),types);
});
