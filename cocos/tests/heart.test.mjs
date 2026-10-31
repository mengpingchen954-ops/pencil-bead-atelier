import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, normalizeSave, deliver } from '../assets/scripts/model.ts';
import { ORDERS } from '../assets/scripts/content.ts';
import { askSea, chooseSeaGift, seaVisitReady, finishSeaVisit, seaResponse } from '../assets/scripts/heart.ts';
function complete(save,id) {
  const order=ORDERS.find(o=>o.id===id);
  return deliver({...save,orderId:id,draft:[...order.palette],charm:order.charm});
}
test('Xiaoman conversation unlocks relevant packing, saves the exact gift and gives a matching response',()=>{
  let s={...freshSave(),started:true,inventory:Array(6).fill(100)};
  assert.equal(askSea(s,'fear'),null);
  s=complete(s,'daisy');
  assert.equal(chooseSeaGift(s,'blessing','slow'),null);
  s=askSea(s,'fear');s=askSea(s,'sunrise');
  assert.equal(askSea(s,'fear'),s);
  s=chooseSeaGift(s,'blessing','slow');s=chooseSeaGift(s,'paper','sky');s=chooseSeaGift(s,'ribbon','blue');
  assert.equal(chooseSeaGift(s,'blessing','home'),null);
  const before=s.inventory.slice(),coins=s.coins;
  s=complete(s,'sea');
  assert.equal(s.coins,coins+220);
  assert.deepEqual(s.collection.find(x=>x.id==='sea').gift,{blessing:'slow',paper:'sky',ribbon:'blue'});
  assert.match(seaResponse(s),/慢慢走/);
  assert.equal(chooseSeaGift(s,'blessing','scenery'),null);
  assert.ok(s.inventory.some((n,i)=>n<before[i]));
  assert.equal(seaVisitReady(s),false);
  assert.equal(finishSeaVisit(s,'heart'),null);
  s=complete(s,'rose');assert.equal(seaVisitReady(s),true);
  const unchanged={coins:s.coins,rep:s.rep,inventory:s.inventory.slice(),completed:s.completed.slice()};
  assert.equal(finishSeaVisit(s,'invalid'),null);
  s=finishSeaVisit(s,'heart');
  assert.deepEqual({coins:s.coins,rep:s.rep,inventory:s.inventory,completed:s.completed},unchanged);
  assert.equal(finishSeaVisit(s,'daisy'),null);
  assert.equal(s.collection.find(x=>x.id==='sea').travelCharm,'heart');
  assert.equal(s.collection.find(x=>x.id==='sea').charm,'moon');
  const restored=normalizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.seaHeart.visited,true);
  assert.deepEqual(restored.collection,s.collection);
  assert.deepEqual(restored.seaHeart,s.seaHeart);
});
test('old and malformed saves retain progress but cannot fabricate a return visit or unsupported choices',()=>{
  const old={...freshSave(),completed:['daisy','sea','rose']};delete old.seaHeart;
  const restored=normalizeSave(old);assert.equal(seaVisitReady(restored),true);
  assert.equal(restored.seaHeart.visited,false);assert.equal(restored.completed.length,3);
  const bad=normalizeSave({...freshSave(),seaHeart:{facts:['fear','fear','unknown'],gift:{blessing:'home',paper:'sky',ribbon:'bad'},visited:true,travelCharm:'moon'}});
  assert.deepEqual(bad.seaHeart,{facts:['fear'],gift:{blessing:'scenery',paper:'cream',ribbon:'sage'},visited:false,travelCharm:'daisy'});
  assert.equal(chooseSeaGift(restored,'__proto__','bad'),null);
});
