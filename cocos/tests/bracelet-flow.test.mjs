import {MATERIALS as TEST_MATERIALS} from '../assets/scripts/content.ts';
const MATERIAL_COUNT=TEST_MATERIALS.length;
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,UITransform,Label,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts');
function fixture(){
 const game=new AtelierGame();game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.save={...rules.freshSave(),started:true,reduced:false,draft:Array(12).fill(0),inventory:Array(MATERIAL_COUNT).fill(30),gatheredStock:Array(MATERIAL_COUNT).fill(30)};
 game.screen='craft';game.render();
 game.slotNodes.forEach(n=>n.children.forEach(c=>{c.isValid=true;}));return game;
}
const positions=nodes=>nodes.map(n=>({...n.position}));
const step=(game,n)=>{for(let i=0;i<n;i++)game.update(1/60);};
test('adding beads expands their centers, retains every bead diameter, and leaves the tray below the ring',()=>{
 const game=fixture();game.save.reduced=true;let previous=0;
 for(const count of [12,14,16,18,20]){
  game.save.draft=Array(count).fill(0);game.save.draftSizes=Array(count).fill(8);game.render();
  const radius=game.craftRadius();assert.ok(radius>previous);previous=radius;
  assert.equal(game.craftDiameter(0),76);assert.ok(radius+38+5<=game.craftPlateRadius()*.89);
  const bottom=game.craftCenterY()+radius+38;assert.ok(bottom<770);
  assert.ok(game.slotNodes.every(n=>n.children.find(c=>c.name.startsWith('bead-')).getComponent(UITransform).contentSize.width===76));
 }
 const tiles=game.page.children.filter(n=>n.name.startsWith('Bead material ')),last=tiles.at(-1),tray=game.page.getChildByName('Material tray');
 const rows=[...new Set(tiles.map(n=>-n.position.y))].sort((a,b)=>a-b);assert.deepEqual(rows,[834,934,1034]);
 assert.ok(-tray.position.y+tray.getComponent(UITransform).contentSize.height-Math.max(...tiles.map(n=>-n.position.y+n.getComponent(UITransform).contentSize.height))<10);
 game.screen='storyMap';game.render();
 assert.equal(game.page.children.flatMap(n=>n.components.filter(c=>c instanceof Label)).filter(c=>c.string==='我们的故事').length,1);
 assert.equal(game.page.children.some(n=>n.name==='Button: 制作手串'),false);
});
test('neighbors flow visually during drag and return exactly without moving slots or changing saves',()=>{
 const game=fixture(),saved=JSON.stringify(game.save),slots=positions(game.slotNodes);
 const art=game.slotNodes.map(n=>n.children.find(c=>c.name.startsWith('bead-'))),rest=positions(art);
 game.dragCraftNeighbors(0,60,30);step(game,18);
 assert.deepEqual({...art[0].position},rest[0]);assert.ok(art[1].position.x-rest[1].x>art[5].position.x-rest[5].x);
 assert.deepEqual(positions(game.slotNodes),slots);assert.equal(JSON.stringify(game.save),saved);
 game.releaseCraftFlow();step(game,180);assert.equal(game.craftFlows.size,0);assert.deepEqual(positions(art),rest);
 game.bumpCraftNeighbors(0);step(game,6);assert.notDeepEqual(positions(art),rest);
 step(game,180);assert.deepEqual(positions(art),rest);assert.equal(JSON.stringify(game.save),saved);
});
test('the full artwork of every bead and charm stays inside the second plate line, including mixed sizes and facings',()=>{
 const game=fixture();game.save.reduced=true;
 for(let type=0;type<48;type++)for(const facing of ['in','out']){
  game.save.draft=Array(19).fill(0).concat(type);game.save.draftSizes=Array(19).fill(8).concat(12);game.save.draftFacings=Array(19).fill('out').concat(facing);game.render();
  const boundary=game.craftPlateRadius()*.89,cy=-game.craftCenterY();
  game.slotNodes.forEach(slot=>slot.children.filter(n=>/^(bead-|charm-)/.test(n.name)).forEach(art=>{
   const t=art.getComponent(UITransform),{width:w,height:h}=t.contentSize,a=t.anchorPoint,r=art.angle*Math.PI/180||0;
   if(type<36&&art.name.startsWith('bead-')){
    const x=slot.position.x+art.position.x,y=slot.position.y+art.position.y;
    assert.ok(Math.hypot(x-360,y-cy)+w/2<=boundary-5);return;
   }
   for(const x of [-a.x*w,(1-a.x)*w])for(const y of [-a.y*h,(1-a.y)*h]){
    const px=slot.position.x+art.position.x+x*Math.cos(r)-y*Math.sin(r),py=slot.position.y+art.position.y+x*Math.sin(r)+y*Math.cos(r);
    // Round bead texture corners are transparent; only charm bounds need the rectangular check.
    if(art.name.startsWith('charm-'))assert.ok(Math.hypot(px-360,py-cy)<=boundary-5);
   }
  }));
 }
});
test('flow survives a redraw, ends on navigation, and respects reduced motion',()=>{
 const game=fixture();game.dragCraftNeighbors(0,60,0);step(game,12);game.releaseCraftFlow();
 const previous=game.slotNodes[1].children.find(c=>c.name.startsWith('bead-')).position.x;game.render();
 assert.equal(game.slotNodes[1].children.find(c=>c.name.startsWith('bead-')).position.x,previous);
 game.navigate('home');assert.equal(game.craftFlows.size,0);
 game.screen='craft';game.save.reduced=true;game.render();game.dragCraftNeighbors(0,60,30);game.bumpCraftNeighbors(0);
 assert.equal(game.craftFlows.size,0);
});

test('deletion preserves each survivor visual position then springs into a smaller gap-free ring',()=>{
 const game=fixture();game.persist=()=>{};game.save.draft=Array.from({length:12},(_,i)=>i);game.save.draftSizes=Array(12).fill(8);game.render();
 const old=game.slotNodes.map(slot=>{const art=slot.children.find(n=>n.name.startsWith('bead-'));return {x:slot.position.x+art.position.x,y:slot.position.y+art.position.y};}),radius=game.craftRadius();
 game.slot=5;game.removeCraftBead();assert.equal(game.save.draft.length,11);assert.ok(game.craftRadius()<radius);assert.ok(game.craftFlows.size>0);
 const art=game.slotNodes.map((slot,i)=>{const n=slot.children.find(n=>n.name.startsWith('bead-')),before=old[i<5?i:i+1];n.isValid=true;
  assert.ok(Math.abs(slot.position.x+n.position.x-before.x)<.001);assert.ok(Math.abs(slot.position.y+n.position.y-before.y)<.001);assert.equal(n.getComponent(UITransform).contentSize.width,76);return n;});
 const initial=positions(art);step(game,12);assert.notDeepEqual(positions(art),initial);step(game,180);assert.equal(game.craftFlows.size,0);
 game.slotNodes.forEach((slot,i)=>{const next=game.slotNodes[(i+1)%11];assert.ok(Math.abs(Math.hypot(slot.position.x-next.position.x,slot.position.y-next.position.y)-80)<.001);});
});


test('deleting down to two ordinary beads keeps the same close spacing and full size',()=>{
 const game=fixture();game.persist=()=>{};game.save.reduced=true;
 for(let count=12;count>=2;count--){
  game.save.draft=Array(count).fill(0);game.save.draftSizes=Array(count).fill(8);game.render();
  const a=game.slotPos(0),b=game.slotPos(1);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-80)<.001);assert.equal(game.craftDiameter(0),76);
  game.slot=0;game.removeCraftBead();assert.equal(game.save.draft.length,count-1);
 }
});
