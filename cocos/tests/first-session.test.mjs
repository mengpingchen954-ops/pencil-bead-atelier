import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDERS} from '../assets/scripts/content.ts';
import {freshSave,normalizeSave,deliver,checkOrder,materialDeficits,supplyGoals,newSession,findSupplyMove,move,bankEarlyCollection,sessionRewards,recordFirstStep} from '../assets/scripts/model.ts';

test('new game starts with locked materials and migration preserves old property without inventing gathered stock',()=>{
 const save=freshSave();assert.ok(save.inventory.every(n=>n===0));assert.ok(save.materialUnlocked.every(n=>!n));
 const legacy={...save,inventory:[3,1,0,2,0,0],draft:[0,3,...Array(10).fill(null)]};delete legacy.gatheredStock;delete legacy.materialUnlocked;
 const migrated=normalizeSave(legacy);assert.deepEqual(migrated.inventory,[3,1,0,2,0,0,...Array(42).fill(0)]);assert.deepEqual(migrated.draft,legacy.draft);assert.ok(migrated.gatheredStock.every(n=>n===0));
});

test('early gathering uses exact missing colors, offers an immediate target-color move, and preserves earned stock once on failure',()=>{
 const first=deliver({...freshSave(),inventory:[10,0,0,5,2,0,...Array(42).fill(0)],charm:"daisy",draft:[...ORDERS[0].palette]});first.deliveryReceipt=null;
 const goals=supplyGoals(first);assert.deepEqual(goals,[{kind:'color',type:0,target:1},{kind:'color',type:2,target:6}]);
 for(let seed=1;seed<=40;seed++){
   const session=newSession(seed,1,ORDERS[1],first);assert.equal(session.supplyOnly,true);assert.deepEqual(session.objectives,goals);assert.ok(session.obstacles.every(x=>!x));
   const pair=findSupplyMove(session.board,session.supplyGoals);assert.ok(pair);const result=move(session,...pair);assert.ok(result.valid);
   assert.ok(result.session.collected[0]+result.session.collected[2]>0);
   const bank=bankEarlyCollection(first,result.session),again=bankEarlyCollection(bank.save,bank.session);
   assert.deepEqual(bank.save.inventory,first.inventory.map((n,i)=>n+Math.floor((result.session.collected[i]||0)/10)));assert.deepEqual(again.save.inventory,bank.save.inventory);
   assert.deepEqual(bankEarlyCollection(bank.save,{...bank.session,status:'lost'}).save.inventory,bank.save.inventory);
   assert.deepEqual(sessionRewards({...bank.session,status:'won'},bank.save),bank.session.collected.map(n=>Math.floor(n/10)));
 }
 const ready={...first,inventory:Array(6).fill(50)};assert.deepEqual(supplyGoals(ready),[]);assert.equal(newSession(7,1,ORDERS[1],ready).supplyOnly,false);
 const empty={...first,inventory:Array(6).fill(0)};assert.ok(supplyGoals(empty).some(g=>g.kind==='total'&&g.target===12));
 const later=newSession(7,4,ORDERS[1],first);assert.equal(later.supplyOnly,false);assert.deepEqual(bankEarlyCollection(first,later).save,first);
});

test('first-session milestones retain their first timestamps and normalize only known numeric fields',()=>{
 let save=recordFirstStep(freshSave(),'craft',100);save=recordFirstStep(save,'craft',200);assert.equal(save.firstSteps.craft,100);
 assert.equal(recordFirstStep(save,'unknown',300),save);
 const normalized=normalizeSave({...save,firstSteps:{craft:100,bad:9,firstGather:'secret'}});assert.deepEqual(normalized.firstSteps,{craft:100});
});
