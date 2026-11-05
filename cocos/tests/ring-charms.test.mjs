import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {load,Node,UITransform,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const rules=load(root+'/assets/scripts/model.ts'),trade=load(root+'/assets/scripts/commerce.ts');
const {charmType,ringMaterials}=load(root+'/assets/scripts/materials.ts');
const plain=value=>JSON.parse(JSON.stringify(value)),leaf=charmType('leaf'),bell=charmType('bell');
function fixture(){
 const game=new AtelierGame(),actions=new Map();
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(3),gatheredStock:Array(48).fill(3),materialUnlocked:Array(48).fill(true)};
 game.navigate('craft');return {game,actions};
}
test('charms use ordinary ring slots, size, drag, replacement, removal and undo without spending stock',()=>{
 const {game,actions}=fixture(),stock=plain(game.save.inventory);game.slot=0;game.render();actions.get('饰品')();actions.get('选择叶子挂饰')();
 assert.equal(game.save.draft[0],leaf);assert.equal(game.save.charm,'none');assert.ok(game.slotNodes[0].children.some(n=>n.name==='charm-leaf'));
 assert.equal(game.page.children.some(n=>n.name==='charm-leaf'),false);
 actions.get('第1槽：叶子挂饰')();actions.get('+')();assert.equal(game.save.draftSizes[0],10);
 const node=game.slotNodes[0],touch=i=>{const p=game.slotPos(i);return {getUILocation:()=>({x:p.x,y:1280-p.y})};};
 node.events.start(touch(0));node.events.move(touch(3));node.events.end(touch(3));assert.equal(game.save.draft[3],leaf);assert.equal(game.save.draftSizes[3],10);
 actions.get('选择风铃')();assert.equal(game.save.draft[3],bell);assert.equal(game.save.draftSizes[3],10);
 actions.get('撤销')();assert.equal(game.save.draft[3],leaf);assert.equal(game.save.draftSizes[3],10);
 actions.get('第4槽：叶子挂饰')();actions.get('移除')();assert.equal(game.save.draft[3],null);actions.get('撤销')();assert.equal(game.save.draft[3],leaf);
 assert.deepEqual(plain(game.save.inventory),stock);assert.deepEqual(plain(game.save.gatheredStock),stock);
});
test('multiple charms reserve exact earned stock and locked or exhausted materials cannot be added',()=>{
 const {game,actions}=fixture();game.save.materialUnlocked[leaf]=false;game.save.inventory[leaf]=game.save.gatheredStock[leaf]=0;actions.get('饰品')();actions.get('选择叶子挂饰')();assert.ok(game.save.draft.every(n=>n===null));
 game.save.materialUnlocked[leaf]=true;game.save.inventory[leaf]=game.save.gatheredStock[leaf]=2;game.render();actions.get('选择叶子挂饰')();actions.get('选择叶子挂饰')();actions.get('选择叶子挂饰')();
 assert.equal(game.save.draft.filter(n=>n===leaf).length,2);assert.equal(game.save.inventory[leaf],2);assert.equal(trade.craftChecks(game.save).stock,true);
 const saved=trade.finishWork(game.save,1000);assert.ok(saved);assert.deepEqual(plain(saved.commerce.works[0].beads),[leaf,leaf]);assert.equal(saved.inventory[leaf],0);assert.equal(saved.gatheredStock[leaf],0);
 assert.equal(trade.finishWork(saved,1001),null);assert.equal(trade.finishWork({...game.save,charm:'leaf'},1001),null);
});
test('all 48 materials and their per-slot sizes survive save, listing, settlement and remake',()=>{
 const {game,actions}=fixture();game.save.draft=Array.from({length:48},(_,i)=>i);game.save.draftSizes=Array.from({length:48},(_,i)=>[6,8,10,12][i%4]);
 const save=trade.finishWork(game.save,1000),work=save.commerce.works[0];assert.equal(work.charm,'none');assert.equal(work.beads.length,48);assert.ok(save.inventory.every(n=>n===2));
 const listed=trade.listWork(save,work.id,trade.suggestedPrice(work.beads),2000),restored=rules.normalizeSave(plain(listed));assert.deepEqual(plain(restored.commerce),plain(listed.commerce));
 const sold=trade.settleSales(restored,50000);assert.equal(trade.settleSales(sold,60000),sold);game.save=sold;game.freeWorkPreview(work.id);
 assert.equal(game.overlay.children.filter(n=>n.name.startsWith('charm-')).length,12);actions.get('再做一条')();assert.deepEqual(plain(game.save.draft),plain(work.beads));assert.deepEqual(plain(game.save.draftSizes),plain(work.beadSizes));assert.ok(game.save.inventory.every(n=>n===2));
});
test('old central charm moves to a ring slot once without losing beads, sizes, stock or listings',()=>{
 const {game,actions}=fixture();game.save.inventory[0]=game.save.gatheredStock[0]=30;game.save.draft=Array(12).fill(0);game.save.draftSizes=Array(12).fill(12);game.save.charm='leaf';
 const original=plain(game.save);game.navigate('craft');assert.deepEqual(plain(game.save.draft),[...original.draft,leaf]);assert.deepEqual(plain(game.save.draftSizes),[...original.draftSizes,8]);assert.equal(game.save.charm,'none');
 const migrated=plain(game.save);game.navigate('home');game.navigate('craft');assert.deepEqual(plain(game.save),migrated);assert.deepEqual(plain(game.save.inventory),original.inventory);
 assert.deepEqual(plain(rules.normalizeSave(migrated).draft),migrated.draft);
 const partial=ringMaterials([0,null,1],[6,8,12],'leaf');assert.deepEqual(plain(partial),{beads:[0,leaf,1],sizes:[6,8,12],facings:['out','out','out']});
 const oldWork=trade.finishWork(original,1000),listed=trade.listWork(oldWork,1,trade.suggestedPrice(oldWork.commerce.works[0].beads),2000);assert.deepEqual(plain(rules.normalizeSave(plain(listed)).commerce),plain(listed.commerce));
 game.save=listed;game.freeWorkPreview(1);const icon=game.overlay.children.find(n=>n.name==='charm-leaf');assert.ok(Math.abs(Math.hypot(icon.position.x-360,(-icon.position.y-504)/.95)-150)<.001);
 game.save.inventory[leaf]=game.save.gatheredStock[leaf]=0;actions.get('再做一条')();assert.equal(game.save.draft.at(-1),leaf);assert.equal(game.save.inventory[leaf],0);assert.equal(trade.craftChecks(game.save).stock,false);
});
