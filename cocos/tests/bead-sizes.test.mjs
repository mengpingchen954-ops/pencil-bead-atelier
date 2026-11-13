import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {load,Node,UITransform,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const rules=load(root+'/assets/scripts/model.ts');
const trade=load(root+'/assets/scripts/commerce.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const game=new AtelierGame(),actions=new Map();
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,fn){actions.set(name,fn);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true),draft:[0,0,1,...Array(9).fill(null)]};
 game.screen='craft';game.render();return {game,actions};
}
const widths=game=>game.slotNodes.slice(0,3).map(n=>n.children.find(n=>n.name.startsWith('bead-')).getComponent(UITransform).contentSize.width);

test('native ring selection and slider resize only that bead live, with one undo per gesture',()=>{
 const {game,actions}=fixture(),stock=plain(game.save.inventory),before=widths(game);let writes=0;game.persist=()=>writes++;
 const touch=(x,y=1077)=>({getUILocation:()=>({x,y:1280-y})});
 const meter=()=>game.page.children.find(n=>n.name==='Single bead size slider');
 assert.equal(meter(),undefined);assert.deepEqual(widths(game),before);assert.equal(game.undo.length,0);
 const p=game.slotPos(1),bead=game.slotNodes[1];bead.events.start(touch(p.x,p.y));bead.events.end(touch(p.x,p.y));assert.equal(game.slot,1);
 assert.ok(game.slotNodes[1].children.some(n=>n.name==='Selected groove'));
 const slider=meter();slider.events.start(touch(205));slider.events.move(touch(398));
 assert.deepEqual(plain(game.workingSizes.slice(0,3)),[8,10,8]);assert.ok(widths(game)[1]>before[1]);assert.equal(writes,0);
 slider.events.move(touch(720));slider.events.end(touch(720));assert.deepEqual(plain(game.workingSizes.slice(0,3)),[8,12,8]);
 assert.equal(widths(game)[0],widths(game)[2]);assert.ok(Math.abs(widths(game)[1]/widths(game)[0]-12/8)<1e-10);assert.equal(writes,1);assert.equal(game.undo.length,1);
 actions.get('撤销')();assert.deepEqual(plain(game.workingSizes.slice(0,3)),[8,8,8]);assert.deepEqual(plain(game.save.inventory),stock);
});

test('cancelled size drag restores the bead and unchanged slider taps do not add history',()=>{
 const {game,actions}=fixture();actions.get('第1槽：珍珠')();const before=widths(game),touch=x=>({getUILocation:()=>({x,y:203})});
 let slider=game.page.children.find(n=>n.name==='Single bead size slider');slider.events.start(touch(494));assert.equal(game.workingSizes[0],12);slider.events.cancel();
 assert.deepEqual(widths(game),before);assert.equal(game.undo.length,0);assert.equal(game.slot,0);
 slider=game.page.children.find(n=>n.name==='Single bead size slider');slider.events.start(touch(301));slider.events.end(touch(301));assert.equal(game.undo.length,0);
 actions.get('选中珠子设为6毫米')();assert.deepEqual(plain(game.workingSizes.slice(0,3)),[6,8,8]);
});

test('size controls affect only the selected instance, including equal materials, and undo restores it',()=>{
 const {game,actions}=fixture(),before=widths(game),stock=plain(game.save.inventory);
 assert.equal(actions.has('+'),false);assert.deepEqual(widths(game),before);assert.equal(game.undo.length,0);
 actions.get('第1槽：珍珠')();actions.get('+')();
 assert.deepEqual(plain(game.workingSizes.slice(0,3)),[9,8,8]);
 const after=widths(game);assert.ok(after[0]>before[0]);assert.equal(after[1],after[2]);assert.ok(Math.abs(after[0]/after[1]-9/8)<1e-10);
 for(const expected of [10,11,12]){actions.get('+')();assert.equal(game.workingSizes[0],expected);}const history=game.undo.length;actions.get('+')();assert.equal(game.undo.length,history);
 actions.get('第2槽：珍珠')();actions.get('−')();assert.deepEqual(plain(game.workingSizes.slice(0,3)),[12,7,8]);
 actions.get('撤销')();assert.deepEqual(plain(game.workingSizes.slice(0,3)),[12,8,8]);
 assert.deepEqual(plain(game.save.inventory),stock);assert.equal(game.save.beadSize,8);
 game.save=rules.normalizeSave(plain(game.save));assert.deepEqual(plain(game.save.draftSizes.slice(0,3)),[12,8,8]);
});

test('sizes travel with drag, survive replacement/removal undo, and persist through saving, listing, gallery and remake',()=>{
 const {game,actions}=fixture();game.save.draftSizes=[6,12,10,...Array(9).fill(8)];game.render();
 const touch=i=>{const p=game.slotPos(i);return {getUILocation:()=>({x:p.x,y:1280-p.y})};};
 const node=game.slotNodes[0];node.events.start(touch(0));node.events.move(touch(2));node.events.end(touch(2));
 assert.deepEqual(plain(game.workingSizes.slice(0,3)),[10,12,6]);assert.equal(game.save.draft[2],0);
 actions.get('放入翡翠')();assert.equal(game.save.draft[2],3);assert.equal(game.workingSizes[2],6);
 actions.get('第3槽：翡翠')();actions.get('移除')();actions.get('撤销')();assert.equal(game.workingSizes[2],6);
 actions.get('预览')();const preview=game.overlay.children.filter(n=>n.name.startsWith('bead-')).map(n=>n.getComponent(UITransform).contentSize.width);
 assert.ok(preview[1]>preview[0]&&preview[0]>preview[2]);actions.get('继续制作')();game.render();
 actions.get('完成制作')();actions.get('保存作品')();
 const work=game.save.commerce.works[0];assert.deepEqual(plain(work.beadSizes),[10,12,6]);
 const stock=plain(game.save.inventory),price=trade.suggestedPrice(work.beads);
 const listed=trade.listWork(game.save,work.id,price,1000),sold=trade.settleSales(rules.normalizeSave(plain(listed)),100000);
 assert.deepEqual(plain(sold.commerce.works[0].beadSizes),[10,12,6]);assert.deepEqual(plain(sold.inventory),stock);
 game.save=sold;game.freeWorkPreview(work.id);actions.get('再做一条')();
 assert.deepEqual(plain(game.workingSizes),[10,12,6]);assert.deepEqual(plain(game.save.inventory),stock);
});

test('old uniform sizes migrate per bead and malformed sizes fall back without altering materials',()=>{
 const old={...rules.freshSave(),beadSize:10,draft:[0,1,...Array(10).fill(null)]};delete old.draftSizes;
 const migrated=rules.normalizeSave(old);assert.deepEqual(plain(migrated.draftSizes),Array(12).fill(10));
 const malformed=rules.normalizeSave({...old,draftSizes:[6,999,NaN,-1,12,'10']});
 assert.deepEqual(plain(malformed.draftSizes.slice(0,6)),[6,10,10,10,12,10]);
 const {game}=fixture();const done=trade.finishWork({...game.save,draft:[0,null,1],draftSizes:[6,12,10]},1000);
 assert.deepEqual(plain(done.commerce.works[0].beadSizes),[6,10]);
 const legacy=plain(done);delete legacy.commerce.works[0].beadSizes;legacy.commerce.works[0].beadSize=12;
 assert.deepEqual(plain(rules.normalizeSave(legacy).commerce.works[0].beadSizes),[12,12]);
});

test('every integer millimeter works in the slider, buttons and saved works, with unchanged bounds',()=>{
 const {game,actions}=fixture(),stock=plain(game.save.inventory),touch=x=>({getUILocation:()=>({x,y:203})});
 actions.get('第1槽：珍珠')();
 for(const size of [6,7,8,9,10,11,12]){
  const slider=game.page.children.find(n=>n.name==='Single bead size slider'),event=touch(205+289*(size-6)/6);
  slider.events.start(event);slider.events.end(event);assert.equal(game.workingSizes[0],size);
  assert.deepEqual(plain(game.workingSizes.slice(1,3)),[8,8]);
  const work=trade.finishWork(game.save,1000),listed=trade.listWork(work,1,trade.suggestedPrice(work.commerce.works[0].beads),2000);
  assert.equal(rules.normalizeSave(plain(listed)).commerce.works[0].beadSizes[0],size);
 }
 const history=game.undo.length;actions.get('+')();assert.equal(game.workingSizes[0],12);assert.equal(game.undo.length,history);
 for(const size of [11,10,9,8,7,6]){actions.get('−')();assert.equal(game.workingSizes[0],size);}
 const minimumHistory=game.undo.length;actions.get('−')();assert.equal(game.workingSizes[0],6);assert.equal(game.undo.length,minimumHistory);
 const malformed=rules.normalizeSave({...game.save,beadSize:9,draftSizes:[7,9,11,5,13,8.5,'7']});
 assert.deepEqual(plain(malformed.draftSizes.slice(0,7)),[7,9,11,9,9,9,9]);
 assert.deepEqual(plain(game.save.inventory),stock);
});

test('contest size edits and undo remain isolated from the normal DIY draft',()=>{
 const {game,actions}=fixture(),normal=plain(game.save.draftSizes);
 game.save.competitions.draft={id:'spring',beads:[0,...Array(11).fill(null)],beadSizes:Array(12).fill(8),charm:'none'};
 game.screen='contestCraft';game.render();actions.get('第1槽：珍珠')();actions.get('+')();
 assert.equal(game.save.competitions.draft.beadSizes[0],9);assert.deepEqual(plain(game.save.draftSizes),normal);
 actions.get('撤销')();assert.equal(game.save.competitions.draft.beadSizes[0],8);assert.deepEqual(plain(game.save.draftSizes),normal);
});
