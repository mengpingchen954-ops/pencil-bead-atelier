import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSave,newSession,bankEarlyCollection,gatheredMaterials,sessionRewards,goalProgress,normalizeSave,total} from '../assets/scripts/model.ts';

test('every finished round awards exactly 3–4 kinds and 13–14 pieces, mapped to actual materials once',()=>{
 const combinations=new Set();
 for(let seed=1;seed<=100;seed++)for(const level of [1,4,12,19,100])for(const status of ['won','lost']){
  const session={...newSession(seed,level),status,moves:0,collected:[9,10,19,20,29,30]},before=structuredClone(session);
  const reward=gatheredMaterials(session),kinds=reward.filter(Boolean).length,quantity=total(reward);
  assert.ok(kinds===3||kinds===4);assert.ok(quantity===13||quantity===14);combinations.add(kinds+'/'+quantity);
  assert.equal(reward[0],0);assert.equal(reward[1],0);assert.ok(reward[5]>=reward[4]&&reward[4]>=reward[3]&&reward[3]>0);
  const bank=bankEarlyCollection(freshSave(),session);
  session.materialTypes.forEach((type,i)=>{assert.equal(bank.save.inventory[type],reward[i]);assert.equal(bank.save.gatheredStock[type],reward[i]);assert.equal(bank.save.materialUnlocked[type],reward[i]>0);});
  assert.deepEqual(session,before);assert.deepEqual(gatheredMaterials(session),reward);
  assert.deepEqual(bankEarlyCollection(bank.save,bank.session),bank);
  assert.deepEqual(sessionRewards({...session,status:'won'}),reward);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(bank.save))),bank.save);
 }
 assert.equal(combinations.size,4);
});

test('playing, empty and abandoned rounds award nothing; complete sparse rounds still meet the budget',()=>{
 const session={...newSession(42,19),collected:[300,0,0,0,0,0]};
 for(const s of [session,{...session,status:'lost'},{...session,status:'won',collected:Array(6).fill(0)}]){
  const save=freshSave();assert.deepEqual(gatheredMaterials(s),Array(6).fill(0));assert.deepEqual(bankEarlyCollection(save,s).save,save);
 }
 const reward=gatheredMaterials({...session,status:'won'});assert.equal(total(reward),14);assert.equal(reward.filter(Boolean).length,3);assert.equal(reward[0],5);
 const goal={...session,objectives:[{kind:'color',type:0,target:8}]};assert.equal(goalProgress(goal)[0].current,300);assert.equal(goalProgress(goal)[0].done,true);
});

test('old property survives, repeat banking cannot duplicate, and a fresh run has a separate reward',()=>{
 const original={...freshSave(),inventory:Array(48).fill(200),gatheredStock:Array(48).fill(150),materialUnlocked:Array(48).fill(true)};
 const session={...newSession(43,19),status:'won',collected:[99,80,60,40,20,1]};
 const bank=bankEarlyCollection(original,session);assert.equal(total(bank.save.inventory)-total(original.inventory),14);
 assert.equal(total(bank.save.gatheredStock)-total(original.gatheredStock),14);assert.deepEqual(bank.save.materialUnlocked,original.materialUnlocked);
 assert.deepEqual(bankEarlyCollection(bank.save,bank.session),bank);
 const next={...newSession(44,19),status:'lost',moves:0,collected:[1,1,1,1,1,1]};
 assert.equal(total(bankEarlyCollection(bank.save,next).save.inventory)-total(bank.save.inventory),13);
});
