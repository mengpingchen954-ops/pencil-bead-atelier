import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts');
const {charmType}=load(root+'/assets/scripts/materials.ts'),leaf=charmType('leaf');
const plain=value=>JSON.parse(JSON.stringify(value)),touch=(x,y)=>({getUILocation:()=>({x,y:1280-y})});
function fixture(){
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true),draft:[0,leaf,1,...Array(9).fill(null)],draftSizes:[12,10,6,...Array(9).fill(8)],draftFacings:['out','in',...Array(10).fill('out')]};game.screen='craft';game.render();return {game,actions};
}
test('beads and charm bodies drop outside every side of the tray without consuming stock, with one-step undo',()=>{
 for(const index of [0,1])for(const [x,y] of [[35,410],[685,410],[360,115],[360,705],[125,175]]){
  const {game,actions}=fixture(),before=plain(game.save),p=game.slotPos(index),slot=game.slotNodes[index],hit=index===1?slot.children.find(n=>n.name==='charm-leaf'):slot;
  hit.events.start(touch(p.x,p.y));hit.events.move(touch(x,y));assert.equal(game.save.draft[index],before.draft[index]);hit.events.end(touch(x,y));
  assert.equal(game.save.draft[index],null);assert.equal(game.undo.length,1);assert.equal(game.slot,-1);assert.deepEqual(plain(game.save.inventory),before.inventory);assert.deepEqual(plain(game.save.gatheredStock),before.gatheredStock);
  actions.get('撤销')();assert.deepEqual(plain(game.save),before);
 }
});
test('inside/rim drops, returning inside and cancelled drags do not remove materials',()=>{
 for(const [x,y] of [[360,410],[100,410],[190,240]]){
  const {game}=fixture(),p=game.slotPos(0),node=game.slotNodes[0];node.events.start(touch(p.x,p.y));node.events.move(touch(20,410));node.events.move(touch(x,y));node.events.end(touch(x,y));
  assert.equal(game.save.draft.filter(t=>t!==null).length,3);assert.ok(game.save.draft.includes(0));
 }
 const {game}=fixture(),before=plain(game.save),p=game.slotPos(1),node=game.slotNodes[1];node.events.start(touch(p.x,p.y));node.events.move(touch(10,410));node.events.cancel();assert.deepEqual(plain(game.save),before);assert.equal(game.undo.length,0);assert.equal(node.position.x,p.x-game.craftSlotSize()/2);
});
test('outward removal persists and keeps contest drafts isolated from normal DIY',()=>{
 const {game,actions}=fixture(),normal=plain(game.save.draft);game.save.competitions.draft={id:'spring',beads:[0,...Array(11).fill(null)],beadSizes:Array(12).fill(8),charm:'none'};game.screen='contestCraft';game.render();
 const node=game.slotNodes[0],p=game.slotPos(0);node.events.start(touch(p.x,p.y));node.events.move(touch(20,410));node.events.end(touch(20,410));assert.equal(game.save.competitions.draft.beads[0],null);assert.deepEqual(plain(game.save.draft),normal);actions.get('撤销')();assert.equal(game.save.competitions.draft.beads[0],0);
 game.screen='craft';game.render();const bead=game.slotNodes[0];bead.events.start(touch(p.x,p.y));bead.events.move(touch(20,410));bead.events.end(touch(20,410));assert.equal(rules.normalizeSave(plain(game.save)).draft[0],null);
});
