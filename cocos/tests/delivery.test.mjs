import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDERS} from '../assets/scripts/content.ts';
import {freshSave, deliver, normalizeSave, pendingDelivery} from '../assets/scripts/model.ts';

const prepared=()=>({...freshSave(),started:true,inventory:Array(6).fill(100),draft:[...ORDERS[0].palette]});
test('a delivery records its exact handmade work and earned rewards in the same transaction',()=>{
 const before=prepared(),after=deliver(before),receipt=pendingDelivery(after);
 assert.equal(after.coins-before.coins,receipt.order.reward);assert.equal(after.rep-before.rep,receipt.order.rep);
 assert.deepEqual(receipt.work.beads,before.draft);assert.equal(receipt.work.charm,before.charm);
 assert.equal(receipt.repeat,false);assert.equal(receipt.number,1);assert.equal(deliver(after),null);
 const restored=normalizeSave(JSON.parse(JSON.stringify(after)));
 assert.deepEqual(pendingDelivery(restored),receipt);assert.equal(restored.coins,after.coins);
 assert.equal(pendingDelivery({...restored,deliveryReceipt:null}),null);
});
test('legacy and forged receipts cannot invent an unlock, completed work or payout',()=>{
 const save=deliver(prepared());
 const legacy={...save};delete legacy.deliveryReceipt;assert.equal(normalizeSave(legacy).deliveryReceipt,null);
 for(const receipt of [{id:'sea',number:2,repeat:false},{id:'daisy',number:1,repeat:true},{id:'daisy',number:9,repeat:false},{id:'bad',number:1,repeat:false},null]){
  const restored=normalizeSave({...save,deliveryReceipt:receipt});assert.equal(restored.deliveryReceipt,null);assert.equal(restored.coins,save.coins);
 }
 assert.equal(normalizeSave({...save,collection:[]}).deliveryReceipt,null);
 const canonical=normalizeSave({...save,deliveryReceipt:{...save.deliveryReceipt,reward:99999,beads:Array(12).fill(5)}});
 assert.deepEqual(canonical.deliveryReceipt,save.deliveryReceipt);assert.deepEqual(pendingDelivery(canonical).work.beads,save.collection[0].beads);
});
test('returning-customer receipts use the latest paid work without changing story collection',()=>{
 let save={...prepared(),inventory:Array(6).fill(1000)};
 for(const o of ORDERS)save=deliver({...save,draft:[...o.palette],charm:o.charm});
 const story=structuredClone(save.collection),before=save.coins;
 save=deliver({...save,draft:[...ORDERS[0].palette],charm:ORDERS[0].charm});
 const receipt=pendingDelivery(normalizeSave(JSON.parse(JSON.stringify(save))));
 assert.equal(receipt.repeat,true);assert.equal(receipt.number,1);assert.equal(receipt.order.name,'再送妈妈一朵花');
 assert.equal(save.coins,before+receipt.order.reward);assert.deepEqual(save.collection,story);
 assert.equal(pendingDelivery({...save,deliveryReceipt:{id:'daisy',repeat:true,number:2}}),null);
});
