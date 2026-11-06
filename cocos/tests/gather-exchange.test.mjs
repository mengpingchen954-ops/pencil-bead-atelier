import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSave,newSession,bankEarlyCollection,gatheredMaterials,sessionRewards,goalProgress,normalizeSave} from '../assets/scripts/model.ts';

test('each identical material requires ten clears: 9/10/19/20 thresholds are independent',()=>{
 const session={...newSession(42,19),collected:[9,10,19,20,29,30]},before=structuredClone(session);
 assert.deepEqual(gatheredMaterials(session),[0,1,1,2,2,3]);
 const bank=bankEarlyCollection(freshSave(),session);
 session.materialTypes.forEach((type,i)=>{
  const expected=[0,1,1,2,2,3][i];assert.equal(bank.save.inventory[type],expected);assert.equal(bank.save.gatheredStock[type],expected);assert.equal(bank.save.materialUnlocked[type],expected>0);
 });
 assert.deepEqual(session,before);assert.deepEqual(bankEarlyCollection(bank.save,bank.session),bank);
 assert.deepEqual(sessionRewards({...session,status:'won'}),[0,1,1,2,2,3]);
 assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(bank.save))),bank.save);
});

test('same-stage moves and cascades carry remainders, multiple exchanges bank only their delta',()=>{
 let save=freshSave(),session=newSession(42,19);
 for(const [cleared,expected] of [[3,0],[6,0],[9,0],[12,1],[19,1],[20,2],[49,4],[50,5]]){
  const result=bankEarlyCollection(save,{...session,collected:[cleared,9,0,0,0,0]});save=result.save;session=result.session;
  assert.equal(save.inventory[session.materialTypes[0]],expected);assert.equal(save.materialUnlocked[session.materialTypes[1]],false);
  assert.deepEqual(bankEarlyCollection(save,session).save,save);
 }
 const frozen=structuredClone(save);
 for(const status of ['won','lost'])assert.deepEqual(bankEarlyCollection(save,{...session,status}).save,frozen);
 // A fresh run cannot combine its nine clears with the previous run's remainder.
 const next=newSession(55,19);assert.deepEqual(bankEarlyCollection(save,{...next,collected:[9,0,0,0,0,0]}).save,save);
 assert.equal(bankEarlyCollection(save,{...next,collected:[10,0,0,0,0,0]}).save.inventory[next.materialTypes[0]],6);
});

test('existing stock is preserved, no receipt or unlock occurs below ten, and goals still count clears',()=>{
 const original={...freshSave(),inventory:Array(48).fill(200),gatheredStock:Array(48).fill(150),materialUnlocked:Array(48).fill(true)};
 const session={...newSession(42,19),collected:[9,9,9,9,9,9]};
 assert.deepEqual(bankEarlyCollection(original,session).save,original);
 assert.deepEqual(bankEarlyCollection(freshSave(),session).save.materialUnlocked,Array(48).fill(false));
 const goal={...session,objectives:[{kind:'color',type:0,target:8}]};assert.equal(goalProgress(goal)[0].current,9);assert.equal(goalProgress(goal)[0].done,true);
 assert.deepEqual(gatheredMaterials(goal),Array(6).fill(0));
});
