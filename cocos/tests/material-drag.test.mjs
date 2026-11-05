import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts');
const {MATERIALS}=load(root+'/assets/scripts/content.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const touch=(x,y,release=false)=>({getUILocation:()=>({x,y:1280-y}),getEventCode:()=>release?'touch-end':'touch-cancel'});
function fixture(type=0){
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 let message='';game.persist=()=>{};game.toast=value=>{message=value;};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true),draft:[1,...Array(11).fill(null)],draftSizes:[12,...Array(11).fill(8)]};
 game.screen='craft';game.craftCategory=MATERIALS[type].category;game.render();
 const tile=()=>game.page.children.find(n=>n.name==='Bead material '+type);
 const start=()=>{const m=MATERIALS[type];tile().events.start(touch(146+m.cell%4*140,805+Math.floor(m.cell/4)*92));};
 return {game,actions,tile,start,message:()=>message};
}
test('all 48 materials drag into the nearest free groove, retain stock and support one-step undo',()=>{
 for(let type=0;type<48;type++){
  const {game,actions,tile,start}=fixture(type),before=plain(game.save),p=game.slotPos(4);game.slot=0;
  start();tile().events.move(touch(p.x,p.y));assert.deepEqual(plain(game.save),before);assert.equal(game.undo.length,0);
  const ghost=game.page.children.find(n=>n.name==='Dragged material');assert.ok(ghost);assert.equal(ghost.position.x,p.x-41);
  tile().events.cancel(touch(p.x,p.y,true));assert.equal(game.save.draft[4],type);assert.equal(game.save.draft[0],1);
  assert.equal(game.save.draftSizes[4],8);assert.equal(game.save.draftSizes[0],12);assert.equal(game.save.draftFacings[4],'out');
  assert.equal(game.undo.length,1);assert.deepEqual(plain(game.save.inventory),before.inventory);assert.deepEqual(plain(game.save.gatheredStock),before.gatheredStock);
  assert.equal(game.page.children.some(n=>n.name==='Dragged material'),false);assert.equal(game.craftFlights.size,0);
  actions.get('撤销')();assert.deepEqual(plain(game.save),before);
 }
});
test('outside drops, returns to material grid and genuine cancellations never add or consume a material',()=>{
 for(const end of ['outside','return','cancel']){
  const {game,tile,start}=fixture(),before=plain(game.save);start();tile().events.move(touch(360,410));
  if(end==='cancel')tile().events.cancel(touch(360,410));else{const p=end==='return'?touch(146,805):touch(30,100);tile().events.move(p);tile().events.cancel({...p,getEventCode:()=> 'touch-end'});}
  assert.deepEqual(plain(game.save),before);assert.equal(game.undo.length,0);assert.equal(game.page.children.some(n=>n.name==='Dragged material'),false);
 }
});
test('locked and exhausted materials cannot be dragged in, including when a matching piece is selected',()=>{
 for(const locked of [true,false]){
  const {game,tile,start,message}=fixture(1);game.save.materialUnlocked[1]=!locked;
  game.save.gatheredStock[1]=game.save.inventory[1]=1;game.slot=0;game.render();const before=plain(game.save);
  start();tile().events.move(touch(360,410));assert.equal(game.page.children.some(n=>n.name==='Dragged material'),false);
  tile().events.cancel(touch(360,410,true));assert.deepEqual(plain(game.save),before);assert.equal(game.undo.length,0);
  assert.match(message(),locked?/未解锁/:/不足/);
 }
});
test('a full free DIY ring grows, while a full competition ring and its separate draft stay bounded',()=>{
 const {game,tile,start,actions}=fixture();game.save.draft=Array(12).fill(1);game.save.draftSizes=Array(12).fill(10);game.render();
 start();tile().events.move(touch(360,410));tile().events.cancel(touch(360,410,true));
 assert.equal(game.save.draft.length,13);assert.equal(game.save.draft[12],0);assert.equal(game.save.draftSizes[12],8);assert.equal(game.undo.length,1);
 actions.get('撤销')();assert.equal(game.save.draft.length,12);
 const normal=plain(game.save.draft);game.save.competitions.draft={id:'spring',beads:Array(12).fill(1),beadSizes:Array(12).fill(8),charm:'none'};game.screen='contestCraft';game.render();
 start();tile().events.move(touch(360,410));tile().events.cancel(touch(360,410,true));assert.equal(game.save.competitions.draft.beads.length,12);assert.deepEqual(plain(game.save.draft),normal);assert.equal(game.contestUndo.length,0);
 game.save.competitions.draft.beads[3]=null;game.render();const p=game.slotPos(3);start();tile().events.move(touch(p.x,p.y));tile().events.cancel(touch(p.x,p.y,true));
 assert.equal(game.save.competitions.draft.beads[3],0);assert.deepEqual(plain(game.save.draft),normal);assert.equal(game.contestUndo.length,1);
});
test('a tap retains normal click-to-add behavior and drag previews disappear when leaving the page',()=>{
 const {game,tile,start}=fixture();start();tile().events.end(touch(146,805));assert.equal(game.save.draft.filter(n=>n===0).length,1);
 start();tile().events.move(touch(360,410));assert.ok(game.page.children.some(n=>n.name==='Dragged material'));
 const before=plain(game.save);game.navigate('orders');assert.equal(game.page.children.some(n=>n.name==='Dragged material'),false);assert.deepEqual(plain(game.save),before);
});
