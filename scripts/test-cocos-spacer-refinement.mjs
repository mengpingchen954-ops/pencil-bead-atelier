import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
import {categoryMaterials} from '../cocos/assets/scripts/materials.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.SPACER_ARTIFACTS||'artifacts/spacer-refinement/browser';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const width of [390,1440]){
  const mobile=width<600,context=await browser.newContext({viewport:{width,height:mobile?960:900},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const initial={...freshSave(),started:true,draft:[18,107,4],draftSizes:[8,8,8],inventory:Array(MATERIALS.length).fill(10),gatheredStock:Array(MATERIALS.length).fill(10),materialUnlocked:Array(MATERIALS.length).fill(true),sound:false,music:{enabled:false,track:'glimmer',volume:0},firstSteps:{craft:1,firstGather:1}};
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280),p={x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);};
  const button=async name=>{const p=await game((g,cc,name)=>{const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);};
  const closeGap=async()=>{
   const s=await state(),beads=s.save.draft,points=s.crafting.slots;
   assert.equal(beads.length,3);assert.deepEqual(s.save.draftSizes,[8,8,8]);
   for(let i=0;i<3;i++){
    const j=(i+1)%3,w=t=>MATERIALS[t].threaded?MATERIALS[t].bounds[2]-MATERIALS[t].bounds[0]:1;
    const gap=Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)-76*(w(beads[i])+w(beads[j]))/2;assert.ok(Math.abs(gap-4)<.02,'gap '+gap);
   }
   assert.deepEqual(await game(g=>g.workingDraft.map((_,i)=>g.craftDiameter(i))),[76,76,76]);
  };
  await button('自由 DIY');await closeGap();await page.screenshot({path:dir+'/tight-spacer-'+width+'.png'});
  let s=await state(),p=s.crafting.slots[1];await tap(p.x,p.y);if(mobile)await button('删除选中材质');else{await page.locator('#GameCanvas').focus();await page.keyboard.press('Delete');await page.waitForTimeout(200);}
  assert.deepEqual((await state()).save.draft,[18,4]);await game(g=>{g.slot=-1;g.render();});await button('饰品');s=await state();
  assert.equal(s.crafting.materials[105].visible,false);const expected=categoryMaterials(3,false,s.save);
  assert.deepEqual(await game(g=>g.page.getChildByName('Material viewport').getChildByName('Material content').children.map(n=>Number(n.name.slice(14)))),expected);
  const cell=expected.indexOf(67);await game((g,cc,offset)=>g.page.getChildByName('Material viewport').getComponent(cc.ScrollView).scrollToOffset(new cc.Vec2(0,offset),.02),Math.min(s.crafting.maxScroll,Math.floor(cell/4)*100));await page.waitForTimeout(150);
  s=await state();assert.equal(s.crafting.materials[67].visible,true);await tap(s.crafting.materials[67].x,s.crafting.materials[67].y);await page.waitForTimeout(1000);await closeGap();assert.ok((await state()).save.draft.includes(67));await page.screenshot({path:dir+'/flower-spacer-'+width+'.png'});
  await button('撤销');assert.deepEqual((await state()).save.draft,[18,4]);
  await game(g=>{g.save.draft=[123];g.save.draftSizes=[8];g.save.draftFacings=['out'];g.slot=-1;g.craftCategory=2;g.render();});await page.screenshot({path:dir+'/whole-wood-'+width+'.png'});
  const wood=await game((g,cc)=>{const n=g.slotNodes[0].children.find(n=>n.name==='bead-123'),t=n.getComponent(cc.UITransform);return {size:[t.width,t.height],masked:!!n.getComponent(cc.Mask),source:n.getComponent(cc.Sprite).spriteFrame.originalSize};});assert.deepEqual(wood.size,[76,76]);assert.equal(wood.masked,false);assert.equal(wood.source.width,192);
  await game(g=>{g.craftCategory=0;g.render();});assert.equal((await state()).crafting.materials[83].visible,false);assert.equal(await game(g=>g.page.getChildByName('Material viewport').getChildByName('Material content').children.some(n=>n.name==='Bead material 83')),false);
  await game(g=>{g.inventoryCategory=3;g.inventory();});assert.equal(await game(g=>!!g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content').getChildByName('银花托')),false);
  await game(g=>{g.inventoryCategory=0;g.inventory();});assert.equal(await game(g=>!!g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content').getChildByName('橄榄切面桶珠')),false);await game(g=>{g.closeModal();g.persist();});
  const before=(await state()).save;assert.deepEqual(before.inventory,initial.inventory);await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');s=await state();assert.deepEqual(s.save.inventory,initial.inventory);assert.deepEqual(s.save.draft,[123]);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,widths:[390,1440],fourPixelSpacerGaps:true,normalBeadSizes:true,wholeWood:true,retiredChoicesHidden:true,nativeSelectionAndDeletion:true,undoAndReload:true,errors},null,2));console.log('Spacer refinement passed390/1440: four-pixel gaps, full-size beads, full wood, retired choices hidden, native select/delete/undo and reload.');
}finally{await browser.close();}
