import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {freshSave,normalizeSave} from '../assets/scripts/model.ts';
import {finishWork,listWork,settleSales,collectSale,suggestedPrice,renameWork} from '../assets/scripts/commerce.ts';

function listed(){
 let save={...freshSave(),started:true,reduced:true,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20)};
 for(let i=0;i<4;i++){save=finishWork({...save,draft:[i]},1000+i);save=listWork(save,i+1,suggestedPrice([i]),2000);}
 return save;
}
test('online/offline sales wait for an explicit per-work claim and cannot pay twice',()=>{
 const initial=listed(),before=structuredClone(initial),sold=settleSales(initial,100000);
 assert.deepEqual(initial,before);assert.equal(sold.coins,initial.coins);assert.equal(sold.rep,40);assert.ok(sold.commerce.works.every(w=>w.status==='sold'&&w.claimed===false));
 let save=normalizeSave(JSON.parse(JSON.stringify(sold))),coins=save.coins;
 assert.equal(settleSales(save,200000),save);
 for(const id of [3,1,4,2]){
  const work=save.commerce.works.find(w=>w.id===id),snapshot=structuredClone(save);
  const paid=collectSale(save,id);coins+=work.price;assert.equal(paid.coins,coins);assert.deepEqual(save,snapshot);
  assert.deepEqual(paid.inventory,initial.inventory);assert.deepEqual(paid.gatheredStock,initial.gatheredStock);assert.equal(paid.rep,40);
  assert.deepEqual({...paid.commerce.works.find(w=>w.id===id),claimed:false},work);
  save=normalizeSave(JSON.parse(JSON.stringify(paid)));assert.equal(collectSale(save,id),null);assert.equal(settleSales(save,300000),save);
 }
 assert.equal(collectSale(save,999),null);assert.equal(collectSale(initial,1),null);
});
test('previously auto-paid sold works migrate as claimed while new unclaimed receipts and renames survive reload',()=>{
 const sold=settleSales(listed(),100000),legacy=structuredClone(sold);
 for(const work of legacy.commerce.works){delete work.claimed;legacy.coins+=work.price;}
 const old=normalizeSave(legacy);assert.equal(old.coins,legacy.coins);assert.ok(old.commerce.works.every(w=>w.claimed===true));assert.equal(collectSale(old,1),null);
 const pending=normalizeSave(renameWork(sold,1,'月光小梦'));assert.equal(pending.commerce.works[0].claimed,false);assert.equal(collectSale(pending,1).commerce.works[0].name,'月光小梦');
 for(const invalid of [undefined,null,'false',0]){const raw=structuredClone(sold);raw.commerce.works[0].claimed=invalid;assert.equal(normalizeSave(raw).commerce.works[0].claimed,true);}
});

const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
test('native claim button pays once, remains paid through tabs, and rolls back when persistence fails',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 game.save=settleSales(listed(),100000);game.screen='orders';game.salesTab='sold';game.render();
 const before=plain(game.save),claim=actions.get('收钱 · 4');assert.ok(claim);
 game.persist=()=>{game.storageFailed=true;};claim();assert.deepEqual(plain(game.save),before);assert.ok(actions.has('收钱 · 4'));
 game.persist=()=>{game.storageFailed=false;};actions.get('收钱 · 4')();assert.equal(game.save.coins,before.coins+before.commerce.works[3].price);
 assert.equal(actions.has('收钱 · 4'),false);const paid=plain(game.save);claim();assert.deepEqual(plain(game.save),paid);
 actions.get('在售 0')();actions.get('已售 4')();assert.equal(actions.has('收钱 · 4'),false);assert.ok(actions.has('收钱 · 3'));
 assert.equal(game.coinEffects,undefined);
});
