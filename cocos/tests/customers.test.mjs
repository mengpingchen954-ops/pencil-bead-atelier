import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {freshSave,normalizeSave} from '../assets/scripts/model.ts';
import {CUSTOM_STYLES,customerFit,updateCustomers,acceptCustomer,declineCustomer,deliverCustomer,finishWork,collectSale,settleSales,listWork,salesProgress} from '../assets/scripts/commerce.ts';
const stock=()=>({...freshSave(),started:true,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true)});
const request=(save=stock(),style='cream')=>({...save,customers:{nextId:2,nextAt:1000,lastStyle:'',active:{id:1,buyer:'林阿姨',style,status:'accepted',createdAt:1000}}});

test('random visits are scheduled and saved, select feasible styles, and never replace an outstanding wish',()=>{
 const original={...freshSave(),started:true,inventory:[6,...Array(47).fill(0)],gatheredStock:[6,...Array(47).fill(0)]},before=structuredClone(original);
 assert.equal(updateCustomers({...original,started:false},1000,()=>0).customers.active,null);
 const waiting=updateCustomers(original,1000,()=>0);assert.equal(waiting.customers.nextAt,16000);assert.equal(updateCustomers(waiting,15999),waiting);
 const guests=new Set(),styles=new Set();
 for(const r of [0,.3,.6,.99]){
  const arrival=updateCustomers(waiting,16000,()=>r),active=arrival.customers.active;guests.add(active.buyer);styles.add(active.style);
  assert.ok(['jewelry','cream'].includes(active.style));assert.equal(active.status,'offered');assert.equal(active.id,1);
  assert.equal(updateCustomers(arrival,999999,()=>0),arrival);assert.deepEqual(normalizeSave(arrival).customers,arrival.customers);
  const accepted=acceptCustomer(arrival,1);assert.equal(accepted.customers.active.status,'accepted');assert.equal(acceptCustomer(accepted,1),null);assert.equal(acceptCustomer(arrival,2),null);
 }
 assert.equal(guests.size,4);assert.equal(styles.size,2);assert.deepEqual(original,before);
 const next={...waiting,customers:{...waiting.customers,lastStyle:'cream'}};assert.equal(updateCustomers(next,16000,()=>.99).customers.active.style,'jewelry');
 const crafted=finishWork({...stock(),draft:Array(6).fill(24)},1000),noStock={...crafted,inventory:Array(48).fill(0),gatheredStock:Array(48).fill(0),customers:waiting.customers};
 assert.equal(updateCustomers(noStock,16000,()=>.99).customers.active.style,'forest');
});

test('five styles allow free arrangements, use exact halves and minimum size, and count optional charms once',()=>{
 const cases={jewelry:[0,1,2,12,13,24],cream:[0,7,8,12,13,24],crystal:[12,13,14,0,1,24],forest:[24,25,26,0,1,12],charm:[36,0,1,12,13,24]};
 for(const style of CUSTOM_STYLES){const beads=cases[style.id];assert.equal(customerFit(style.id,beads).ok,true);assert.equal(customerFit(style.id,beads.slice(0,5)).ok,false);assert.equal(customerFit(style.id,beads.toReversed()).ok,true);}
 assert.equal(customerFit('cream',[0,7,8,12,13,24,25]).ok,false);assert.equal(customerFit('cream',[0,7,8,9,12,13,24]).ok,true);
 assert.equal(customerFit('charm',[0,1,2,12,13],'heart').ok,true);assert.equal(customerFit('charm',[0,1,2,12,13]).ok,false);
 for(const beads of [Array(6),[0,0,0,0,0,-1],[0,0,0,0,0,48],[0,0,0,0,0,'0']])assert.equal(customerFit('jewelry',beads).ok,false);
 assert.equal(customerFit('unknown',Array(6).fill(0)).ok,false);
});

test('existing works deliver once for a fixed fee, retain artwork, enter the gallery and survive reload',()=>{
 let save=request({...stock(),draft:[0,7,8,12,13,24],draftSizes:[6,7,8,9,10,11],draftFacings:Array(6).fill('out'),draftName:'奶油小光'});
 save=finishWork(save,2000);const before=structuredClone(save),paid=deliverCustomer(save,1,1,3000,()=>0);
 assert.ok(paid);assert.equal(paid.coins,save.coins+220);assert.equal(paid.rep,save.rep+12);assert.equal(paid.customers.active,null);assert.equal(paid.customers.nextAt,63000);
 assert.deepEqual(paid.inventory,save.inventory);assert.deepEqual(paid.gatheredStock,save.gatheredStock);assert.deepEqual(paid.commerce.works[0].beads,save.commerce.works[0].beads);assert.deepEqual(paid.commerce.works[0].beadSizes,save.commerce.works[0].beadSizes);
 assert.equal(paid.commerce.works[0].claimed,true);assert.equal(paid.commerce.works[0].buyer,'林阿姨');assert.deepEqual(paid.commerce.works[0].commission,{id:1,style:'cream'});
 assert.equal(salesProgress(paid),1);assert.equal(collectSale(paid,1),null);assert.equal(deliverCustomer(paid,1,1,4000),null);assert.equal(listWork(paid,1,200,4000),null);assert.equal(settleSales(paid,999999),paid);
 assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(paid))),paid);assert.deepEqual(save,before);
 const duplicate={...paid,customers:save.customers,commerce:{...paid.commerce,works:[...paid.commerce.works,{...paid.commerce.works[0],id:2,status:'ready'}]}};
 assert.equal(deliverCustomer(duplicate,1,2,4000),null);
 const corrupted=structuredClone(paid);corrupted.commerce.works.push({...corrupted.commerce.works[0],id:2});assert.equal(normalizeSave(corrupted).commerce.works.length,1);
});

test('wrong styles, unaccepted requests and listed works cannot pay; cancellation preserves all property',()=>{
 const save=finishWork(request({...stock(),draft:Array(6).fill(24)}),2000);
 assert.equal(deliverCustomer(save,1,1,3000),null);assert.equal(deliverCustomer({...save,customers:{...save.customers,active:{...save.customers.active,status:'offered'}}},1,1,3000),null);
 const correct=finishWork(request({...stock(),draft:Array(6).fill(0)}),2000),listed=listWork(correct,1,100,3000);assert.ok(listed);assert.equal(deliverCustomer(listed,1,1,4000),null);
 assert.equal(deliverCustomer(correct,2,1,3000),null);assert.equal(deliverCustomer(correct,1,1,1000),null);
 const canceled=declineCustomer(save,1,3000,()=>0),{customers:old,...oldProperty}=save,{customers:next,...newProperty}=canceled;
 assert.deepEqual(newProperty,oldProperty);assert.equal(next.active,null);assert.equal(next.nextAt,63000);assert.equal(updateCustomers(canceled,62999),canceled);
 assert.equal(declineCustomer(canceled,1),null);assert.equal(declineCustomer(save,2),null);
 const legacy=stock();delete legacy.customers;assert.deepEqual(normalizeSave(legacy).customers,{nextId:1,nextAt:0,lastStyle:'',active:null});
 const malformed=normalizeSave({...stock(),customers:{nextId:-1,nextAt:-1,active:{id:1,style:'unknown',buyer:'林阿姨',status:'accepted',createdAt:1000}}});assert.equal(malformed.customers.active,null);
});

const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs'),{AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
function native(save){
 const game=new AtelierGame(),actions=new Map(),messages=[];game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');game.save={...save,reduced:true};game.screen='home';
 game.persist=()=>{};game.play=()=>{};game.toast=message=>messages.push(message);game.scheduleOnce=()=>{};
 game.accessibility={clear(modal){if(modal)actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},busy(){},showDialog(){actions.clear();},closeDialog(){},announce(){}};
 game.render();return {game,actions,messages};
}
test('native acceptance preserves the draft and direct craft delivery consumes and pays exactly once',()=>{
 const save=request({...stock(),draft:Array(6).fill(0)});save.customers.active.status='offered';const {game,actions}=native(save);
 actions.get('顾客定制')();assert.equal(game.modal,'customer');actions.get('接受定制')();assert.equal(game.screen,'craft');assert.deepEqual(Array.from(game.save.draft),Array(6).fill(0));
 game.confirmDelivery();assert.equal(game.screen,'packing');game.render();assert.ok(actions.has('保存并交付定制'));actions.get('保存并交付定制')();
 assert.equal(game.modal,'customer-receipt');assert.equal(game.save.coins,300);assert.equal(game.save.gatheredStock[0],14);assert.equal(game.save.commerce.works[0].status,'sold');const paid=JSON.stringify(game.save);
 game.completeCustomerPacking();game.customerConfirm(1);assert.equal(JSON.stringify(game.save),paid);
});

test('native existing-work confirmation, cancellation and storage rollback preserve inventory and receipts',()=>{
 const ready=finishWork(request({...stock(),draft:Array(6).fill(0)}),1000),{game,actions}=native(ready);
 game.customerDialog();actions.get('挑选已有作品')();assert.ok(actions.has('选这件 · 1'));actions.get('选这件 · 1')();assert.equal(game.modal,'customer-confirm');
 const before=JSON.stringify(game.save);game.persist=()=>{game.storageFailed=true;};actions.get('交付并收款')();assert.equal(JSON.stringify(game.save),before);assert.equal(game.modal,'customer-confirm');
 game.persist=()=>{game.storageFailed=false;};actions.get('交付并收款')();assert.equal(game.modal,'customer-receipt');assert.equal(game.save.coins,300);assert.deepEqual(Array.from(game.save.inventory),ready.inventory);
 const direct=native(request({...stock(),draft:Array(6).fill(0)}));direct.game.screen='packing';direct.game.render();const snapshot=JSON.stringify(direct.game.save);direct.game.persist=()=>{direct.game.storageFailed=true;};direct.actions.get('保存并交付定制')();assert.equal(JSON.stringify(direct.game.save),snapshot);assert.equal(direct.game.screen,'packing');
});


test('native arrival waits for a safe shop screen, announces once and leaves existing tasks undisturbed',()=>{
 const {game,messages}=native({...stock(),customers:{nextId:1,nextAt:1,lastStyle:'',active:null}});
 game.screen='match';const before=JSON.stringify(game.save);game.tickCustomers();assert.equal(JSON.stringify(game.save),before);
 game.screen='home';game.modal='daily';game.tickCustomers();assert.equal(JSON.stringify(game.save),before);
 game.modal='';game.tickCustomers();assert.ok(game.save.customers.active);assert.equal(messages.filter(m=>m.startsWith('叮铃')).length,1);assert.equal(game.modal,'');
 const arrived=JSON.stringify(game.save);game.tickCustomers();assert.equal(JSON.stringify(game.save),arrived);assert.equal(messages.filter(m=>m.startsWith('叮铃')).length,1);
});
