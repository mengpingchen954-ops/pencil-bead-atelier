import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {MATERIALS} from '../assets/scripts/content.ts';
import {materialPage,materialPages,materialPalette,materialPlacement,ringAngle} from '../assets/scripts/materials.ts';
import {freshSave,normalizeSave,newSession,bankEarlyCollection,canPlace} from '../assets/scripts/model.ts';
import {finishWork,listWork,suggestedPrice,customerFit} from '../assets/scripts/commerce.ts';
const plain=v=>JSON.parse(JSON.stringify(v)),count=MATERIALS.length;
const {load,Node,UITransform,root}=createRequire(import.meta.url)('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
function fixture(){
 const g=new AtelierGame(),actions=new Map();g.node=new Node('AtelierGame');g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');
 g.persist=()=>{};g.toast=()=>{};g.play=()=>{};
 g.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 g.save={...freshSave(),started:true,reduced:true,draft:[],inventory:Array(count).fill(4),gatheredStock:Array(count).fill(4),materialUnlocked:Array(count).fill(true)};g.navigate('craft');return {g,actions};
}
test('the distinct supplied crops have unique names, assets, transparency metadata and complete category pages',()=>{
 const records=JSON.parse(fs.readFileSync(root+'/assets/resources/art/extra-material-sources.json','utf8'));
 assert.equal(records.length,105);assert.equal(new Set(MATERIALS.map(m=>m.name)).size,count);assert.equal(new Set(records.map(r=>r.asset)).size,105);
 for(const r of records){const m=MATERIALS[r.type],file=root+'/assets/resources/'+(m.id?'art/':'beads/')+r.asset;
  assert.equal(m.name,r.name);assert.ok(fs.existsSync(file));const meta=JSON.parse(fs.readFileSync(file+'.meta','utf8'));assert.equal(meta.userData.hasAlpha,true);
  assert.ok(m.bounds.every(v=>v>=0&&v<=1));assert.ok(m.bounds[2]>m.bounds[0]&&m.bounds[3]>m.bounds[1]);
 }
 for(let category=0;category<4;category++){
  const ids=[];for(let page=0;page<materialPages(category);page++){const items=materialPage(category,page);assert.ok(items.length>0&&items.length<=12);ids.push(...items);assert.equal(new Set(items.map(i=>MATERIALS[i].cell%12)).size,items.length);}
  assert.deepEqual(ids,MATERIALS.flatMap((m,i)=>m.category===category?[i]:[]).sort((a,b)=>MATERIALS[a].cell-MATERIALS[b].cell));
  assert.equal(materialPages(category,true),1);assert.ok(materialPage(category,0,true).every(i=>i<48));
 }
});
test('old inventory, draft and listed works keep their original IDs while new materials start locked',()=>{
 const old={...freshSave(),inventory:Array(48).fill(8),gatheredStock:Array(48).fill(8),materialUnlocked:Array(48).fill(true),draft:[0,14,35,47],draftSizes:[6,8,10,12],draftFacings:['out','out','out','in']};
 const listed=listWork(finishWork(old,1000),1,suggestedPrice(old.draft),2000),restored=normalizeSave(plain(listed));
 assert.deepEqual(restored.inventory.slice(0,48),listed.inventory.slice(0,48));assert.deepEqual(restored.commerce,listed.commerce);
 assert.equal(restored.inventory.length,count);assert.ok(restored.inventory.slice(48).every(n=>n===0));assert.ok(restored.materialUnlocked.slice(48).every(n=>n===false));
 assert.equal(canPlace(restored,48,0),false);
});
test('every new material is earned at its actual ID once and can complete and reload a listed DIY work',()=>{
 const reached=new Set();for(let level=1;level<=count*2;level++)for(let slot=0;slot<6;slot++){
  const collected=Array(6).fill(30);collected[slot]=1000;
  const session={...newSession(42,level),freeGather:true,collected,status:'lost',moves:0},bank=bankEarlyCollection(freshSave(),session);
  [session.materialTypes[slot]].filter(t=>t>=48).forEach(t=>{
   reached.add(t);assert.ok(bank.save.gatheredStock[t]>0);assert.equal(bank.save.materialUnlocked[t],true);assert.equal(canPlace(bank.save,t,0),true);
   const save={...bank.save,draft:[t],draftSizes:[12],draftFacings:[MATERIALS[t].id?'in':'out']},done=finishWork(save,1000);assert.ok(done);assert.equal(done.inventory[t],save.inventory[t]-1);
   const listed=listWork(done,1,suggestedPrice([t]),2000);assert.deepEqual(normalizeSave(plain(listed)).commerce,listed.commerce);
  });assert.deepEqual(bankEarlyCollection(bank.save,bank.session).save,bank.save);
 }assert.equal(reached.size,105);
 const pale=MATERIALS.findIndex((m,i)=>i>=48&&m.category===0&&m.pale);assert.equal(customerFit('cream',Array(6).fill(pale),'none').ok,true);
});
test('native DIY pagination selects new beads and accessories, preserves dimensions on deletion and undo',()=>{
 const {g,actions}=fixture(),seen=new Set();
 for(let category=0;category<4;category++){
  g.craftCategory=category;g.craftPages[category]=0;g.render();
  for(let page=0;page<materialPages(category);page++){
   const ids=g.page.children.filter(n=>n.name.startsWith('Bead material ')).map(n=>Number(n.name.slice(14)));assert.deepEqual(ids,materialPage(category,page));ids.forEach(id=>seen.add(id));
   if(page+1<materialPages(category))actions.get('下一页珠材')();
  }
 }assert.equal(seen.size,count);
 for(const type of [52,64,112,142]){
  const m=MATERIALS[type];g.slot=-1;g.craftCategory=m.category;g.craftPages[m.category]=Math.floor(m.cell/12);g.render();actions.get((m.id?'选择':'放入')+m.name)();assert.equal(g.save.draft.at(-1),type);
 }
 const stock=plain(g.save.inventory);g.save.draftSizes=[6,8,10,12];g.save.draftFacings=['out','out','in','out'];g.slot=2;g.render();actions.get('移除')();assert.deepEqual(plain(g.save.draft),[52,64,142]);assert.deepEqual(plain(g.save.draftSizes),[6,8,12]);
 actions.get('撤销')();assert.deepEqual(plain(g.save.draft),[52,64,112,142]);assert.deepEqual(plain(g.save.draftSizes),[6,8,10,12]);assert.equal(g.save.draftFacings[2],'in');assert.deepEqual(plain(g.save.inventory),stock);
});
test('new asymmetric artwork stays inside the second plate line at both facings and mixed sizes',()=>{
 const {g}=fixture();for(let type=48;type<count;type++)for(const facing of ['in','out']){
  g.save.draft=Array(19).fill(48).concat(type);g.save.draftSizes=Array(19).fill(8).concat(12);g.save.draftFacings=Array(19).fill('out').concat(facing);
  const radius=g.craftRadius(),boundary=g.craftPlateRadius()*.89,m=MATERIALS[type],d=g.craftDiameter(19),a=ringAngle(g.save.draft,19,g.save.draftSizes),p=materialPlacement(type,a,facing),r=p.angle*Math.PI/180;
  if(!m.id&&!m.threaded){assert.ok(radius+d/2<=boundary-5);continue;}
  const b=m.bounds;for(const x of [(b[0]-p.anchorX)*d,(b[2]-p.anchorX)*d])for(const y of [(1-b[3]-p.anchorY)*d,(1-b[1]-p.anchorY)*d])assert.ok(Math.hypot(Math.cos(a)*radius+x*Math.cos(r)-y*Math.sin(r),-Math.sin(a)*radius+x*Math.sin(r)+y*Math.cos(r))<=boundary-5,m.name+' '+facing);
 }
});
