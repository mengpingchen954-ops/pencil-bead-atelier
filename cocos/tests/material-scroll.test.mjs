import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load,Node,UITransform,root}=createRequire(import.meta.url)('../tools/generate-editor-layouts.cjs');
const cc=load('cc'),{AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),{freshSave}=load(root+'/assets/scripts/model.ts'),{MATERIALS}=load(root+'/assets/scripts/content.ts');
const plain=v=>JSON.parse(JSON.stringify(v)),touch=(x,y,release=false)=>({getUILocation:()=>({x,y:1280-y}),getEventCode:()=>release?'touch-end':'touch-cancel'});
function fixture(mobile=false){
 const g=new AtelierGame(),actions=new Map(),timers=new Set();g.node=new Node('AtelierGame');g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');g.persist=()=>{};g.play=()=>{};g.toast=()=>{};
 g.scheduleOnce=fn=>timers.add(fn);g.unschedule=fn=>timers.delete(fn);
 g.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 g.save={...freshSave(),started:true,reduced:true,draft:[],draftSizes:[],draftFacings:[],inventory:Array(MATERIALS.length).fill(5),gatheredStock:Array(MATERIALS.length).fill(5),materialUnlocked:Array(MATERIALS.length).fill(true)};
 cc.sys.isMobile=mobile;g.navigate('craft');cc.sys.isMobile=false;
 const viewport=()=>g.page.getChildByName('Material viewport'),tile=()=>viewport().getChildByName('Material content').children.find(n=>n.name==='Bead material 0');
 return {g,actions,timers,viewport,tile};
}
test('native scrolling holds every category material under a fixed clip, with no page controls or save mutations',()=>{
 const {g,actions,viewport}=fixture(),save=plain(g.save);
 const note=g.guideNode.getChildByName('Guide note');assert.ok(-note.position.y+note.getComponent(UITransform).contentSize.height<=770);
 const old=viewport().getComponent(cc.ScrollView);g.craftCategory=1;old.scrollToOffset({y:80});assert.equal(g.craftScroll[0],80);assert.equal(g.craftScroll[1],0);
 for(let c=0;c<4;c++){
  g.craftCategory=c;g.render();const v=viewport(),scroll=v.getComponent(cc.ScrollView),content=v.getChildByName('Material content');
  assert.deepEqual(content.children.map(n=>Number(n.name.slice(14))).sort((a,b)=>a-b),plain(MATERIALS.flatMap((m,i)=>m.category===c?[i]:[])));
  assert.equal(v.getComponent(UITransform).contentSize.height,294);assert.ok(v.getComponent(cc.Mask));assert.equal(scroll.horizontal,false);assert.equal(scroll.vertical,true);assert.equal(scroll.inertia,false);
  scroll.scrollToOffset({y:100});assert.equal(g.guideNode,null);assert.equal(g.craftScroll[c],100);g.render();assert.equal(viewport().getChildByName('Material content').position.y,100);
  assert.equal(actions.has('下一页珠材'),false);assert.equal(actions.has('上一页珠材'),false);
 }assert.deepEqual(plain(g.save),save);
 g.inventory();assert.equal(g.overlay.children.some(n=>n.name==='Button: 下一页'),false);const v=g.overlay.getChildByName('Inventory material viewport');v.getComponent(cc.ScrollView).scrollToOffset({y:200});g.inventory();assert.equal(g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content').position.y,200);
 const previous=g.overlay.getChildByName('Inventory material viewport').getComponent(cc.ScrollView);g.inventoryCategory=1;previous.scrollToOffset({y:250});assert.equal(g.inventoryScroll[0],250);assert.equal(g.inventoryScroll[1],0);
});
test('a mobile swipe never selects or drags a material, and cancelling never changes stock',()=>{
 const {g,timers,viewport,tile}=fixture(true),save=plain(g.save),n=tile();n.events.start(touch(146,868));assert.equal(timers.size,1);n.events.move(touch(146,830));assert.equal(timers.size,0);
 viewport().getComponent(cc.ScrollView).scrollToOffset({y:100});n.events.cancel(touch(360,430,true));assert.deepEqual(plain(g.save),save);assert.equal(g.undo.length,0);assert.equal(g.page.children.some(n=>n.name==='Dragged material'),false);
});
test('a mobile hold reserves the gesture for dragging, preserves scroll, and undo restores the draft without consuming stock',()=>{
 const {g,actions,timers,viewport,tile}=fixture(true),save=plain(g.save),n=tile(),scroll=viewport().getComponent(cc.ScrollView);n.events.start(touch(146,868));for(const fn of timers)fn();assert.equal(scroll.enabled,false);
 n.events.move(touch(360,430));assert.equal(g.page.children.some(n=>n.name==='Dragged material'),true);n.events.cancel(touch(360,430,true));assert.equal(scroll.enabled,true);assert.deepEqual(plain(g.save.draft),[0]);assert.deepEqual(plain(g.save.inventory),save.inventory);assert.equal(g.undo.length,1);actions.get('撤销')();assert.deepEqual(plain(g.save),save);
});
test('short taps still place materials and native cancellation releases a held scroll lock',()=>{
 const {g,timers,viewport,tile}=fixture(true),n=tile(),scroll=viewport().getComponent(cc.ScrollView);n.events.start(touch(146,868));for(const fn of timers)fn();n.events.cancel(touch(360,430));assert.equal(scroll.enabled,true);assert.equal(timers.size,0);assert.deepEqual(plain(g.save.draft),[]);
 n.events.start(touch(146,868));n.events.end(touch(146,868));assert.deepEqual(plain(g.save.draft),[0]);assert.equal(timers.size,0);
});
