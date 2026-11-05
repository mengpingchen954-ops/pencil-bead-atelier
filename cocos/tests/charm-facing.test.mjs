import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,UITransform,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts'),trade=load(root+'/assets/scripts/commerce.ts');
const {charmType,normalizeBeadFacings}=load(root+'/assets/scripts/materials.ts');
const plain=value=>JSON.parse(JSON.stringify(value)),leaf=charmType('leaf'),star=charmType('star');
function fixture(){
 const game=new AtelierGame(),actions=new Map();
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true),draft:[leaf,leaf,0,...Array(9).fill(null)]};
 game.screen='craft';game.render();return {game,actions};
}
const art=(game,index)=>game.slotNodes[index].children.find(n=>n.name.startsWith('charm-'));

test('all twelve charm holes stay on the circular wire at every slot, size and facing',()=>{
 const {game}=fixture();
 for(let type=36;type<48;type++)for(const facing of ['in','out'])for(const size of [6,8,10,12]){
  game.save.draft=Array(12).fill(type);game.save.draftSizes=Array(12).fill(size);game.save.draftFacings=Array(12).fill(facing);game.render();
  for(let i=0;i<12;i++){
   const image=art(game,i),t=image.getComponent(UITransform),half=game.craftSlotSize()/2;
   assert.equal(image.position.x,half);assert.equal(image.position.y,-half);
   assert.ok(t.anchorPoint.x>0&&t.anchorPoint.x<1&&t.anchorPoint.y>0&&t.anchorPoint.y<1);
   const pose=game.craftPose(i),p=game.slotPos(i),dot=pose.offsetX*(p.x-360)+pose.offsetY*(p.y-410);
   assert.ok(facing==='out'?dot>0:dot<0,'body must face '+facing);
   assert.ok(Number.isFinite(image.angle));
  }
 }
});

test('only the selected charm flips, no-op taps do not add history, and dragging preserves its facing',()=>{
 const {game,actions}=fixture(),stock=plain(game.save.inventory);
 assert.equal(actions.has('朝内'),false);actions.get('第1槽：叶子挂饰')();actions.get('朝内')();
 assert.deepEqual(plain(game.save.draftFacings.slice(0,3)),['in','out','out']);const history=game.undo.length;actions.get('朝内')();assert.equal(game.undo.length,history);
 actions.get('+')();assert.equal(game.save.draftFacings[0],'in');assert.equal(game.save.draftSizes[0],10);
 const touch=i=>{const p=game.slotPos(i);return {getUILocation:()=>({x:p.x,y:1280-p.y})};},node=game.slotNodes[0];
 node.events.start(touch(0));node.events.move(touch(3));node.events.end(touch(3));
 assert.equal(game.save.draft[3],leaf);assert.equal(game.save.draftFacings[3],'in');assert.equal(game.save.draftFacings[0],'out');
 actions.get('移除')();actions.get('撤销')();assert.equal(game.save.draftFacings[3],'in');
 actions.get('撤销')();assert.equal(game.save.draftFacings[0],'in');assert.equal(game.save.draft[0],leaf);
 assert.deepEqual(plain(game.save.inventory),stock);
});

test('facing compacts with actual materials and survives save, listing, reload, gallery and remake',()=>{
 const {game,actions}=fixture();game.save.draft=[leaf,null,0,star];game.save.draftSizes=[6,8,10,12];game.save.draftFacings=['in','out','in','out'];game.render();
 actions.get('完成制作')();actions.get('保存作品')();const work=game.save.commerce.works[0];
 assert.deepEqual(plain(work.beads),[leaf,0,star]);assert.deepEqual(plain(work.beadFacings),['in','out','out']);
 const price=trade.suggestedPrice(work.beads),listed=trade.listWork(game.save,1,price,1000),restored=rules.normalizeSave(plain(listed));
 assert.deepEqual(plain(restored.commerce),plain(listed.commerce));assert.equal(restored.commerce.works[0].sellAt,listed.commerce.works[0].sellAt);
 const sold=trade.settleSales(restored,100000);assert.equal(trade.settleSales(sold,200000),sold);game.save=sold;game.freeWorkPreview(1);actions.get('再做一条')();
 assert.deepEqual(plain(game.save.draftFacings),['in','out','out']);assert.deepEqual(plain(game.save.draftSizes),[6,10,12]);
});

test('old and malformed facings safely default outward without changing beads or pricing',()=>{
 assert.deepEqual(plain(normalizeBeadFacings([leaf,0,star,null],['in','in','wrong','in'])),['in','out','out','out']);
 const {game}=fixture(),old=plain(game.save);delete old.draftFacings;const restored=rules.normalizeSave(old);assert.ok(restored.draftFacings.every(f=>f==='out'));assert.deepEqual(plain(restored.draft),old.draft);
 const saved=trade.finishWork(old,1000),work=saved.commerce.works[0];delete work.beadFacings;
 const listed=trade.listWork(saved,1,trade.suggestedPrice(work.beads),2000),normalized=rules.normalizeSave(plain(listed));
 assert.deepEqual(plain(normalized.commerce.works[0].beadFacings),['out','out','out']);assert.equal(normalized.commerce.works[0].price,listed.commerce.works[0].price);
});

test('radial charm drags preview around the hole, commit only that instance and undo in one step',()=>{
 for(const index of [0,1,3,6,9])for(const facing of ['in','out']){
  const {game,actions}=fixture();game.save.draft=Array(12).fill(leaf);game.save.draftFacings=Array(12).fill(facing==='in'?'out':'in');game.render();
  const before=plain(game.save),p=game.slotPos(index),scale=facing==='in'?.65:1.28,end={x:360+(p.x-360)*scale,y:410+(p.y-410)*scale},touch=p=>({getUILocation:()=>({x:p.x,y:1280-p.y})}),node=game.slotNodes[index],image=art(game,index),angle=image.angle;
  image.events.start(touch(p));image.events.move(touch(end));assert.ok(Math.abs(Math.abs(image.angle-angle)-180)<.001);assert.equal(game.save.draftFacings[index],before.draftFacings[index]);assert.equal(node.position.x,p.x-game.craftSlotSize()/2);assert.equal(node.position.y,-p.y+game.craftSlotSize()/2);
  image.events.end(touch(end));assert.equal(game.save.draftFacings[index],facing);assert.deepEqual(plain(game.save.draft),before.draft);assert.deepEqual(plain(game.save.inventory),before.inventory);assert.equal(game.undo.length,1);
  const same=art(game,index);same.events.start(touch(p));same.events.move(touch(end));same.events.end(touch(end));assert.equal(game.undo.length,1);
  actions.get('撤销')();assert.deepEqual(plain(game.save),before);
 }
});

test('cancelled, reversed and small charm drags keep the saved facing; ordinary ring swaps still work',()=>{
 const {game}=fixture(),p=game.slotPos(0),touch=(x,y)=>({getUILocation:()=>({x,y:1280-y})});
 let image=art(game,0),before=image.angle;image.events.start(touch(p.x,p.y));image.events.move(touch(p.x,p.y+50));image.events.cancel();assert.equal(image.angle,before);assert.equal(game.workingFacings[0],'out');assert.equal(game.undo.length,0);
 image.events.start(touch(p.x,p.y));image.events.move(touch(p.x,p.y+50));image.events.move(touch(p.x,p.y));image.events.end(touch(p.x,p.y));assert.equal(game.workingFacings[0],'out');assert.equal(game.undo.length,0);
 image=art(game,0);image.events.start(touch(p.x,p.y));image.events.move(touch(p.x,p.y+16));image.events.end(touch(p.x,p.y+16));assert.equal(game.workingFacings[0],'out');assert.equal(game.undo.length,0);
 const node=game.slotNodes[0],to=game.slotPos(3);node.events.start(touch(p.x,p.y));node.events.move(touch(to.x,to.y));node.events.end(touch(to.x,to.y));assert.equal(game.save.draft[3],leaf);assert.equal(game.workingFacings[3],'out');
});

test('Creator outside-hit releases commit the gesture while genuine input cancellation restores it',()=>{
 for(const [y,code] of [[300,'touch-end'],[110,'touch-end'],[300,'touch-cancel']]){
  const {game}=fixture(),p=game.slotPos(0),image=art(game,0),touch=(x,y)=>({getUILocation:()=>({x,y:1280-y}),getEventCode:()=>code});
  image.events.start(touch(p.x,p.y));image.events.move(touch(p.x,y));image.events.cancel(touch(p.x,y));
  assert.equal(game.save.draft[0],y===110?null:leaf);assert.equal(game.workingFacings[0],y===300&&code==='touch-end'?'in':'out');assert.equal(game.undo.length,code==='touch-end'?1:0);
 }
});
