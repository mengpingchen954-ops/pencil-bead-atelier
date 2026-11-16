import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load,Node,root}=createRequire(import.meta.url)('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),{MATERIALS}=load(root+'/assets/scripts/content.ts');
const {freshSave,normalizeSave,canPlace}=load(root+'/assets/scripts/model.ts'),{finishWork,listWork,suggestedPrice}=load(root+'/assets/scripts/commerce.ts');
const {canRotateMaterial,materialPlacement,normalizeBeadFacings,categoryMaterials,materialPalette}=load(root+'/assets/scripts/materials.ts');
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(){const g=new AtelierGame(),actions=new Map();g.node=new Node('AtelierGame');g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');g.persist=()=>{};g.toast=()=>{};g.play=()=>{};g.accessibility={clear(){actions.clear();},text(){},button(n,fn,modal,enabled){if(enabled)actions.set(n,fn);},showDialog(){},closeDialog(){}};g.save={...freshSave(),started:true,reduced:true,inventory:Array(MATERIALS.length).fill(20),gatheredStock:Array(MATERIALS.length).fill(20),materialUnlocked:Array(MATERIALS.length).fill(true),draft:[64,64,0],draftSizes:[8,10,8]};g.screen='craft';g.render();return {g,actions};}
test('removed chains and clasp are hidden and cannot be newly placed or earned; historical saves survive',()=>{
 const {g}=fixture();for(const type of [81,114,115]){
  assert.equal(MATERIALS[type].retired,true);assert.equal(canPlace(g.save,type,3),false);
  for(let c=0;c<4;c++)assert.equal(categoryMaterials(c,false,g.save).includes(type),false);
  for(let level=1;level<=500;level++)assert.equal(materialPalette(level).includes(type),false);
  g.craftCategory=3;g.render();assert.equal(g.snapshot().crafting.materials[type].visible,false);assert.equal(g.page.getChildByName('Material viewport').getChildByName('Material content').getChildByName('Bead material '+type),null);
  g.inventoryCategory=3;g.inventory();assert.equal(g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content').getChildByName(MATERIALS[type].name),null);g.closeModal();
  const old=normalizeSave({...plain(g.save),draft:[type],draftFacings:['out']});assert.deepEqual(plain(old.draft),[type]);assert.equal(old.inventory[type],20);assert.deepEqual(plain(normalizeSave(finishWork(old,1000)).commerce.works[0].beads),[type]);
 }
});
test('only the selected rectangular piece rotates, four quarter turns return exactly, and undo restores direction',()=>{
 const {g,actions}=fixture(),stock=plain(g.save.inventory);assert.equal(canRotateMaterial(64),true);assert.equal(canRotateMaterial(0),false);assert.equal(actions.has('旋转'),false);
 actions.get('第1槽：流霞琉璃管')();assert.equal(g.overlay.getChildByName('First steps guide'),null);const base=g.craftPose(0).angle;
 for(const [i,value] of ['turn90','turn180','turn270','out'].entries()){actions.get('旋转')();assert.equal(g.workingFacings[0],value);assert.equal(g.workingFacings[1],'out');assert.equal(g.craftPose(0).angle,base-(i===3?0:(i+1)*90));}
 actions.get('撤销')();assert.equal(g.workingFacings[0],'turn270');assert.deepEqual(plain(g.save.inventory),stock);
 actions.get('第1槽：流霞琉璃管')();actions.get('移除')();assert.deepEqual(plain(g.save.draft),[64,0]);assert.deepEqual(plain(g.workingFacings),['out','out']);actions.get('撤销')();assert.equal(g.workingFacings[0],'turn270');
 actions.get('第3槽：珍珠')();assert.equal(actions.has('旋转'),false);
});
test('directions normalize safely and survive actual save, listing, reload and remake',()=>{
 const {g,actions}=fixture();assert.deepEqual(plain(normalizeBeadFacings([64,64,64,0,43],['turn90','turn180','turn270','turn90','turn90'])),['turn90','turn180','turn270','out','out']);
 actions.get('第1槽：流霞琉璃管')();actions.get('旋转')();actions.get('+')();assert.equal(g.workingFacings[0],'turn90');assert.equal(g.workingSizes[0],9);
 const done=finishWork(normalizeSave(plain(g.save)),1000),listed=listWork(done,1,suggestedPrice(done.commerce.works[0].beads),2000),loaded=normalizeSave(plain(listed)),work=loaded.commerce.works[0];assert.equal(work.beadFacings[0],'turn90');assert.equal(work.beadSizes[0],9);
 g.save=loaded;g.freeWorkPreview(1);actions.get('再做一条')();assert.equal(g.workingFacings[0],'turn90');assert.equal(g.workingFacings[1],'out');
 const base=materialPlacement(64,Math.PI/5);assert.equal(materialPlacement(64,Math.PI/5,'turn90').angle,base.angle-90);
});
test('all three rotations of elongated materials remain inside the second plate line at maximum size',()=>{
 const {g}=fixture();for(let type=0;type<MATERIALS.length;type++)if(canRotateMaterial(type))for(const turn of ['turn90','turn180','turn270']){
  g.save.draft=Array(19).fill(0).concat(type);g.save.draftSizes=Array(19).fill(8).concat(12);g.save.draftFacings=Array(19).fill('out').concat(turn);
  const p=g.craftPose(19),pos=g.slotPos(19),d=g.craftDiameter(19),b=MATERIALS[type].bounds,r=p.angle*Math.PI/180,boundary=g.craftPlateRadius()*.89;
  for(const x of [(b[0]-p.anchorX)*d,(b[2]-p.anchorX)*d])for(const y of [(1-b[3]-p.anchorY)*d,(1-b[1]-p.anchorY)*d])assert.ok(Math.hypot(pos.x-360+x*Math.cos(r)-y*Math.sin(r),-pos.y+g.craftCenterY()+x*Math.sin(r)+y*Math.cos(r))<=boundary-5,MATERIALS[type].name+' '+turn);
 }
});
