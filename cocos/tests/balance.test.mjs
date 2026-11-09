import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSave,normalizeSave,newSession,gatheredMaterials,total,purchase,shopProgress} from '../assets/scripts/model.ts';
import {OPENING_LEVELS} from '../assets/scripts/levels.ts';
import {CLEAN_SPOTS,REPAIRS,FURNITURE,ORDERS} from '../assets/scripts/content.ts';
import {finishWork,listWork,priceBounds,suggestedPrice,saleDuration,settleSales,collectSale} from '../assets/scripts/commerce.ts';
import {COMPETITIONS,competitionPalette,evaluateCompetition,beginCompetition,submitCompetition} from '../assets/scripts/competition.ts';

test('opening moves never fall, final bags shrink to eight, and tools match obstacles without changing early supply',()=>{
 assert.deepEqual(OPENING_LEVELS.map(l=>l.moves),[16,17,18,19,19,19,20,20,20,23,23,23,23,24,26]);
 assert.equal(OPENING_LEVELS[13].paper.length,8);
 for(let level=1;level<=30;level++){
  const s=newSession(27,level);
  assert.deepEqual(s.tools,{hammer:s.obstacles.includes('thread')?3:2,shuffle:2,bloom:s.obstacles.includes('paper')?2:1});
 }
 for(let level=1;level<=3;level++){
  const s=newSession(27,level,ORDERS[0],freshSave());assert.equal(s.supplyOnly,true);
  assert.deepEqual(s.tools,{hammer:2,shuffle:2,bloom:1});assert.ok(s.obstacles.every(x=>!x));
  assert.equal(total(gatheredMaterials({...s,status:'won',collected:[40,30,20,10,0,0]})),14);
 }
});

test('wins scale over five-stage bands, losses keep 60 percent rounded down, and the second chapter repeats',()=>{
 for(const [level,win,loss]of [[1,13,7],[5,13,7],[6,15,9],[10,15,9],[11,17,10],[15,17,10],[16,13,7],[26,17,10]]){
  const s={...newSession(4,level),collected:[60,50,40,30,20,10],moves:0};
  assert.equal(total(gatheredMaterials({...s,status:'won'})),win);
  assert.equal(total(gatheredMaterials({...s,status:'lost'})),loss);
 }
});

test('reputation controls new prices and cubic waits, while old high-price listings and receipts keep their deadlines',()=>{
 const ready=finishWork({...freshSave(),draft:Array(5).fill(0),inventory:Array(48).fill(10),gatheredStock:Array(48).fill(10)},1000);
 const beads=ready.commerce.works[0].beads,price=suggestedPrice(beads);assert.equal(price,90);
 for(const [rep,cap]of [[0,1.2],[100,1.3],[300,1.5],[999,1.5],[-2,1.2],[NaN,1.2]]){
  const max=Math.floor(price*cap);assert.equal(priceBounds(beads,rep).max,max);
  assert.ok(listWork({...ready,rep},1,max,2000));assert.equal(listWork({...ready,rep},1,max+1,2000),null);
 }
 assert.equal(saleDuration(beads,108),34560);assert.equal(saleDuration(beads,135),67500);
 const listing={...ready.commerce.works[0],status:'listing',price:135,listedAt:2000,sellAt:47000};
 const old={...ready,commerce:{nextId:4,works:[listing,{...listing,id:2,status:'sold',claimed:false,buyer:'花店小满'},{...listing,id:3,status:'sold',claimed:true,buyer:'许老师'}]}};
 const migrated=normalizeSave(old);assert.deepEqual(migrated.commerce,old.commerce);assert.equal(migrated.rep,0);
 assert.deepEqual(normalizeSave(migrated).commerce,old.commerce);assert.equal(settleSales(migrated,46999),migrated);
 const sold=settleSales(migrated,47000);assert.equal(sold.rep,10);const paid=collectSale(sold,1);
 assert.equal(paid.coins,old.coins+135);assert.equal(collectSale(paid,1),null);assert.equal(collectSale(paid,3),null);
 assert.equal(collectSale(paid,2).coins,old.coins+270);
 assert.equal(normalizeSave({...old,commerce:{works:[{...listing,sellAt:47001}]}}).commerce.works.length,0);
});

test('reference designs earn silver, rearranged designs can earn gold, and historical paid awards remain unchanged',()=>{
 assert.deepEqual(COMPETITIONS.map(e=>e.reward),[120,160,200]);
 for(const e of COMPETITIONS){
  const reference=evaluateCompetition(e.id,competitionPalette(e.id),e.charm);
  assert.equal(reference.score,83);assert.equal(reference.echo,8);assert.equal(reference.medal,'银色巧思奖');
  const goldBeads=Array.from({length:12},(_,i)=>i%2?e.accent:e.main),gold=evaluateCompetition(e.id,goldBeads,e.charm);
  assert.equal(gold.score,100);assert.equal(gold.reward,e.reward);
  const base={...freshSave(),completed:ORDERS.map(o=>o.id),competitions:{draft:null,entries:[{id:e.id,beads:goldBeads,charm:e.charm,...gold,reward:e.reward/2}]}};
  const restored=normalizeSave(base);assert.equal(restored.competitions.entries[0].reward,e.reward/2);assert.equal(restored.coins,base.coins);
  assert.equal(beginCompetition(restored,e.id),null);assert.equal(submitCompetition(restored),null);
 }
});

test('three furniture tiers cost 3900 total with repairs, persist, and cannot skip or spend twice',()=>{
 let s={...freshSave(),coins:3900,renovation:{cleared:CLEAN_SPOTS.map(x=>x.id),repairs:Object.fromEntries(REPAIRS.map(x=>[x.id,true]))}};
 // Repairs cost120; allocate the remaining3780 to the nine furniture purchases.
 s.coins-=120;
 for(const f of FURNITURE){
  assert.equal(purchase(s,f.id,3),null);
  for(let tier=1;tier<=3;tier++){
   const before=s;s=purchase(s,f.id,tier);assert.ok(s);assert.equal(s.coins,before.coins-f.prices[tier]);
   assert.equal(purchase(s,f.id,tier).coins,s.coins);assert.equal(normalizeSave(s).upgrades[f.id],tier);
  }
  assert.equal(purchase(s,f.id,4),null);
 }
 assert.equal(s.coins,0);assert.equal(shopProgress(s).percent,100);assert.equal(shopProgress(s).furnished,9);
 const legacy=normalizeSave({...s,upgrades:{chair:2,display:2,desk:2},coins:150});assert.equal(legacy.coins,150);
 assert.deepEqual(legacy.upgrades,{chair:2,display:2,desk:2});assert.equal(purchase(legacy,'chair',3),null);
});
