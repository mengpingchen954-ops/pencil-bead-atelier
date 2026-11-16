import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load,Node,UITransform,root}=createRequire(import.meta.url)('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),{freshSave}=load(root+'/assets/scripts/model.ts'),{MATERIALS}=load(root+'/assets/scripts/content.ts');
function fixture(){
 const g=new AtelierGame();g.node=new Node('AtelierGame');g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');g.persist=()=>{};g.play=()=>{};g.toast=()=>{};
 g.save={...freshSave(),started:true,reduced:true,inventory:Array(MATERIALS.length).fill(50),gatheredStock:Array(MATERIALS.length).fill(50),materialUnlocked:Array(MATERIALS.length).fill(true)};g.screen='packing';return g;
}
function contained(g){
 const before=JSON.stringify(g.save);g.render();assert.equal(JSON.stringify(g.save),before);
 assert.equal(g.page.getChildByName('pencil-frame'),null);assert.ok(g.page.getChildByName('Packing border'));assert.ok(g.page.getChildByName('Packing border lining'));
 const work=g.page.getChildByName('Packed work');assert.ok(work);assert.equal(work.scale.x,work.scale.y);
 for(const n of work.children){
  const t=n.getComponent(UITransform),a=(n.angle||0)*Math.PI/180;
  for(const x of [-t.anchorPoint.x*t.contentSize.width,(1-t.anchorPoint.x)*t.contentSize.width])for(const y of [-t.anchorPoint.y*t.contentSize.height,(1-t.anchorPoint.y)*t.contentSize.height]){
   const px=work.position.x+(n.position.x+x*Math.cos(a)-y*Math.sin(a))*work.scale.x,py=-work.position.y-(n.position.y+x*Math.sin(a)+y*Math.cos(a))*work.scale.y;
   assert.ok(px>=245-1e-8&&px<=475+1e-8&&py>=447-1e-8&&py<=613+1e-8,n.name+' '+px+','+py);
  }
 }
 return work;
}
test('all 153 materials, both charm facings, sparse drafts and legacy charms fit the box without changing the saved work',()=>{
 const g=fixture();for(let type=0;type<MATERIALS.length;type++)for(const size of [6,12])for(const facing of ['in','out']){
  g.save.draft=[null,type,null];g.save.draftSizes=[8,size,8];g.save.draftFacings=['out',facing,'out'];g.save.charm=type%2?'heart':'none';contained(g);
 }
});
test('one to twenty mixed beads and long accessories stay within the cushion at their saved relative sizes',()=>{
 const g=fixture();for(let count=1;count<=20;count++){
  g.save.draft=Array.from({length:count},(_,i)=>(count*13+i*17)%MATERIALS.length);g.save.draftSizes=Array.from({length:count},(_,i)=>6+i%7);g.save.draftFacings=Array.from({length:count},(_,i)=>i%2?'in':'out');g.save.charm='none';contained(g);
 }
});
