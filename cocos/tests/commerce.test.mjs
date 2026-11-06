import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSave,normalizeSave,newSession,bankEarlyCollection,sessionRewards,move,findMove} from '../assets/scripts/model.ts';
import {finishWork,listWork,withdrawWork,settleSales,collectSale,suggestedPrice,priceBounds,saleDuration,salesProgress} from '../assets/scripts/commerce.ts';
import {storyUnlocked,storyRoute} from '../assets/scripts/story.ts';
import {STORIES} from '../assets/scripts/content.ts';
import {beginCompetition} from '../assets/scripts/competition.ts';

const prepared=()=>({...freshSave(),inventory:Array(48).fill(40),gatheredStock:Array(48).fill(40),materialUnlocked:Array(48).fill(true),draft:Array(12).fill(5),charm:'heart'});
test('free DIY accepts a single color and any charm, reserves actual stock once, and pays nothing on save',()=>{
  const save=prepared(),snapshot=structuredClone(save),next=finishWork(save,1000);
  assert.ok(next);assert.deepEqual(save,snapshot);assert.equal(next.inventory[5],28);assert.equal(next.coins,save.coins);assert.equal(next.rep,save.rep);
  assert.deepEqual(next.commerce.works[0].beads,save.draft);assert.equal(next.commerce.works[0].charm,'heart');assert.equal(next.commerce.works[0].status,'ready');
  assert.equal(finishWork(next,1000),null);assert.equal(finishWork({...save,inventory:Array(6).fill(0)},1000),null);
  assert.ok(finishWork({...save,draft:Array(11).fill(1)},1000));
  for(const draft of [Array(12).fill(null),[],Array(12).fill(-1),Array(12),Array(12).fill(1.5)])assert.equal(finishWork({...save,draft},1000),null);
});

test('free DIY accepts every bead kind and arbitrary stock-backed counts',()=>{
  const save={...prepared(),draft:Array.from({length:36},(_,i)=>i),charm:'none'};
  const next=finishWork(save,1000);
  assert.ok(next);
  assert.equal(next.commerce.works[0].beads.length,36);
  assert.deepEqual(next.commerce.works[0].beads,Array.from({length:36},(_,i)=>i));
  assert.equal(next.inventory.reduce((sum,n)=>sum+(40-n),0),36);
});
test('listing, withdrawal and repeated settlement cannot duplicate materials, works or income',()=>{
  let save=finishWork(prepared(),1000),price=suggestedPrice(save.commerce.works[0].beads);const stock=[...save.inventory],coins=save.coins;
  save=listWork(save,1,price,2000);assert.equal(save.coins,coins);assert.deepEqual(save.inventory,stock);assert.equal(listWork(save,1,price,2000),null);
  assert.equal(settleSales(save,21999),save);const withdrawn=withdrawWork(save,1,21999);assert.equal(withdrawn.commerce.works[0].status,'ready');assert.deepEqual(withdrawn.inventory,stock);
  assert.equal(withdrawWork(save,1,22000),null);save=settleSales(save,22000);assert.equal(save.coins,coins);assert.equal(save.commerce.works[0].claimed,false);save=collectSale(save,1);assert.equal(save.coins,coins+price);assert.equal(collectSale(save,1),null);assert.equal(save.rep,10);assert.equal(save.commerce.works[0].status,'sold');
  assert.equal(settleSales(save,50000),save);assert.equal(withdrawWork(save,1,50000),null);assert.equal(listWork(save,1,price,50000),null);assert.deepEqual(save.inventory,stock);
});
test('prices are bounded by materials and higher prices take longer to sell',()=>{
  const save=finishWork(prepared(),1000),beads=save.commerce.works[0].beads,{min,max}=priceBounds(beads);
  assert.ok(saleDuration(beads,min)<saleDuration(beads,max));
  for(const price of [0,-1,1.5,min-1,max+1,Infinity,NaN,'200'])assert.equal(listWork(save,1,price,2000),null);
  assert.ok(listWork(save,1,min,2000));assert.ok(listWork(save,1,max,2000));
});
test('offline listings resume and settle exactly once across save normalization and reload',()=>{
  const ready=finishWork(prepared(),1000),listed=listWork(ready,1,suggestedPrice(ready.commerce.works[0].beads),2000);
  const restored=normalizeSave(JSON.parse(JSON.stringify(listed)));assert.deepEqual(restored,listed);
  const sold=settleSales(restored,50000),again=settleSales(normalizeSave(JSON.parse(JSON.stringify(sold))),60000);
  assert.deepEqual(again,sold);assert.equal(sold.coins,listed.coins);const paid=collectSale(again,1);assert.equal(paid.coins,listed.coins+listed.commerce.works[0].price);assert.equal(collectSale(normalizeSave(paid),1),null);
});
test('old saves retain progress and corrupt or duplicate commerce records never create extra sale income',()=>{
  const old=prepared();delete old.commerce;old.completed=['daisy'];old.orderId='sea';old.coins=1342;old.upgrades.chair=1;
  const normalized=normalizeSave(old);for(const key of ['coins','inventory','draft','completed','upgrades'])assert.deepEqual(normalized[key],old[key]);
  assert.deepEqual(normalized.commerce,{nextId:1,works:[]});
  const work=finishWork(prepared(),1000).commerce.works[0];const bad=normalizeSave({...old,commerce:{nextId:0,works:[null,work,{...work},{...work,id:2,beads:Array(12)},{...work,id:3,status:'sold',price:999999,listedAt:0,sellAt:0}]}});
  assert.equal(bad.commerce.works.length,1);assert.equal(bad.commerce.nextId,2);assert.equal(settleSales(bad,50000).coins,old.coins);
});
test('all gathering levels bank precisely the 10-for-1 exchanged materials, including failure, restart and repeated banking',()=>{
  for(const level of [1,4,15,16]){
    const save=freshSave(),session=newSession(124,level),result=move(session,...findMove(session.board));assert.ok(result.valid);assert.equal(session.freeGather,true);assert.equal(session.rewardOrder,null);
    const bank=bankEarlyCollection(save,result.session),again=bankEarlyCollection(bank.save,{...bank.session,status:'lost'});
    assert.deepEqual(bank.save.inventory,save.inventory.map((n,i)=>n+Math.floor((result.session.collected[result.session.materialTypes.indexOf(i)]||0)/10)));assert.deepEqual(again.save.inventory,bank.save.inventory);
    assert.deepEqual(sessionRewards({...bank.session,status:'won'},bank.save),result.session.collected.map(n=>Math.floor(n/10)));
  }
});
test('sold work unlocks story and competitions without creating fake legacy commissions',()=>{
  let save=prepared();
  for(let i=0;i<6;i++){save=finishWork({...save,draft:Array(12).fill(i),charm:'moon'},1000+i);const work=save.commerce.works.at(-1);save=listWork(save,work.id,suggestedPrice(work.beads),2000);}
  assert.equal(storyUnlocked(save,STORIES.find(s=>s.id==='first-receipt')),false);assert.equal(beginCompetition(save,'spring'),null);
  save=settleSales(save,50000);assert.equal(salesProgress(save),6);assert.deepEqual(save.completed,[]);assert.deepEqual(save.collection,[]);
  assert.ok(storyRoute(save).stops.every(s=>s.unlocked));assert.ok(beginCompetition(save,'spring'));assert.ok(beginCompetition(save,'light'));
  assert.deepEqual(normalizeSave(save).commerce,save.commerce);
  const migrated={...save,completed:['daisy','sea','rose','forest'],commerce:{...save.commerce,works:save.commerce.works.slice(0,1)}};
  assert.equal(salesProgress(migrated),5);assert.ok(storyUnlocked(migrated,STORIES.find(s=>s.id==='own-name')));
  assert.equal(storyUnlocked(freshSave(),{afterOrder:'unknown'}),false);
});
