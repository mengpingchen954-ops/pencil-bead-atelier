import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MATERIALS} from '../assets/scripts/content.ts';
import {ringAngle,ringRadius,categoryMaterials,materialPalette} from '../assets/scripts/materials.ts';
import {freshSave,normalizeSave,canPlace} from '../assets/scripts/model.ts';
const {load,Node,root}=createRequire(import.meta.url)('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');

test('thin spacers in the supplied three-piece arrangement have four-pixel gaps without shrinking or crowding the round beads',()=>{
 for(const spacer of [67,106,107,119,126])for(let position=0;position<3;position++){
  const beads=[18,4];beads.splice(position,0,spacer);const sizes=[8,8,8],r=ringRadius(beads,sizes,76,40),points=beads.map((_,i)=>{const a=ringAngle(beads,i,sizes);return {x:r*Math.cos(a),y:r*Math.sin(a)};});
  for(let i=0;i<3;i++){
   const j=(i+1)%3,width=t=>t===spacer?MATERIALS[t].bounds[2]-MATERIALS[t].bounds[0]:1;
   const gap=Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)-76*(width(beads[i])+width(beads[j]))/2;
   assert.ok(Math.abs(gap-4)<.001,spacer+' gap '+gap);
  }
 }
 for(const n of [2,3,12,20]){
  const b=Array(n).fill(0),s=Array(n).fill(8),r=ringRadius(b,s,76,0),a=ringAngle(b,0,s),c=ringAngle(b,1,s);
  assert.ok(Math.abs(2*r*Math.sin((c-a)/2)-80)<.001,'ordinary bead spacing remains80');
 }
});
test('retired silver cap disappears from DIY, inventory and new match palettes, while existing saves and work IDs survive',()=>{
 const save={...freshSave(),started:true,reduced:true,inventory:Array(MATERIALS.length).fill(4),gatheredStock:Array(MATERIALS.length).fill(4),materialUnlocked:Array(MATERIALS.length).fill(true),draft:[18,105,4],draftSizes:[8,8,8]};
 assert.equal(MATERIALS[83].retired,true);assert.equal(MATERIALS[105].retired,true);
 const restored=normalizeSave(JSON.parse(JSON.stringify(save)));assert.deepEqual(restored.draft,save.draft);assert.equal(restored.inventory[105],4);assert.equal(canPlace(restored,105,3),false);assert.equal(canPlace(restored,83,3),false);assert.equal(canPlace(restored,107,3),true);
 for(let c=0;c<4;c++)assert.equal(categoryMaterials(c,false,restored).includes(105),false);
 for(let level=1;level<500;level++){assert.equal(materialPalette(level).includes(105),false);assert.equal(materialPalette(level).includes(83),false);}
 const g=new AtelierGame();g.node=new Node('AtelierGame');g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');g.save=restored;g.screen='craft';g.craftCategory=3;g.render();
 const list=g.page.getChildByName('Material viewport').getChildByName('Material content');assert.equal(list.getChildByName('Bead material 105'),null);assert.equal(g.snapshot().crafting.materials[105].visible,false);
 g.inventoryCategory=3;g.inventory();assert.equal(g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content').getChildByName('银花托'),null);
 assert.equal(g.save.draft[1],105);
});
