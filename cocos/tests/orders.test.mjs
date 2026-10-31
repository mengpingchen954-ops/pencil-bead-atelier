import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDERS, RETURN_ORDERS } from '../assets/scripts/content.ts';
import { freshSave, normalizeSave, currentOrder, checkOrder, deliver, draftCounts } from '../assets/scripts/model.ts';

function finishStoryOrders() {
  let save={...freshSave(),started:true,inventory:Array(6).fill(200)};
  for(const order of ORDERS)save=deliver({...save,draft:order.palette.slice(),charm:order.charm});
  return save;
}

test('all six story commissions lead straight to a returning-customer commission',()=>{
  const save=finishStoryOrders();
  assert.deepEqual(save.completed,ORDERS.map(o=>o.id));
  assert.equal(save.collection.length,6);
  assert.equal(save.repeatOrders,0);
  assert.equal(currentOrder(save).name,RETURN_ORDERS[0].name);
  assert.equal(save.orderId,'daisy');
  const old={...save,orderId:'promise',draft:Array(12).fill(4)};
  delete old.repeatOrders;delete old.repeatCollection;
  const migrated=normalizeSave(old);
  assert.equal(currentOrder(migrated).customer,'林阿姨');
  for(const key of ['coins','inventory','draft','completed','collection','competitions'])assert.deepEqual(migrated[key],old[key]);
});

test('returning commissions enforce recipes, consume stock and reward only a completed delivery',()=>{
  let save=finishStoryOrders();
  const history=structuredClone(save.collection),progress=structuredClone(save.completed);
  for(let i=0;i<8;i++){
    const order=currentOrder(save),before=save;
    assert.equal(order.id,RETURN_ORDERS[i%6].id);
    assert.equal(deliver(save),null);
    assert.equal(deliver({...save,draft:Array(12).fill(order.main),charm:order.charm}),null);
    const prepared={...save,draft:order.palette.slice(),charm:order.charm};
    assert.ok(Object.values(checkOrder(prepared)).every(Boolean));
    assert.equal(deliver({...prepared,inventory:Array(6).fill(0)}),null);
    assert.equal(deliver({...prepared,charm:order.charm==='heart'?'moon':'heart'}),null);
    save=deliver(prepared);
    assert.equal(save.coins,before.coins+order.reward);
    assert.deepEqual(save.inventory,before.inventory.map((n,j)=>n-draftCounts(order.palette)[j]));
    assert.equal(save.repeatOrders,i+1);
    assert.equal(deliver(save),null);
    assert.deepEqual(save.collection,history);assert.deepEqual(save.completed,progress);
    assert.equal(save.energy,before.energy);
    assert.equal(save.repeatCollection.at(-1).id,order.id);
  }
  assert.equal(save.repeatCollection.length,6);
  assert.deepEqual(save.repeatCollection.map(x=>x.number),[3,4,5,6,7,8]);
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(save))),save);
});

test('save migration bounds repeat progress and rejects invalid or premature repeat artwork',()=>{
  const work={id:'daisy',beads:ORDERS[0].palette,charm:'daisy',number:1};
  const early=normalizeSave({...freshSave(),repeatOrders:40,repeatCollection:[work]});
  assert.equal(early.repeatOrders,0);assert.deepEqual(early.repeatCollection,[]);
  const save=normalizeSave({...finishStoryOrders(),repeatOrders:1,repeatCollection:[null,{...work,beads:Array(12)},work,{...work,number:2},{...work,charm:'bad'}]});
  assert.deepEqual(save.repeatCollection,[work]);
  assert.equal(currentOrder(save).id,'sea');
  const invalid=normalizeSave({...finishStoryOrders(),repeatOrders:Infinity});
  assert.equal(invalid.repeatOrders,0);assert.equal(currentOrder(invalid).id,'daisy');
});
