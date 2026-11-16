import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
import {categoryMaterials} from '../cocos/assets/scripts/materials.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.DIRECTION_ARTIFACTS||'artifacts/material-trim/browser';
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
  const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
  const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280),p={x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);};
  const button=async name=>{const p=await game((g,cc,name)=>{const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);};
  await button('自由 DIY');
  await game(g=>{g.save.draft=[64,0,64,0,128,0,85,0,104,0,138,0,0,0];g.save.draftSizes=Array(14).fill(8);g.save.draftFacings=Array(14).fill('out');g.craftCategory=3;g.render();});
  let s=await state();
  for(const type of [81,114,115])assert.equal(s.crafting.materials[type].visible,false);
  const active=await game(g=>g.page.getChildByName('Material viewport').getChildByName('Material content').children.map(n=>Number(n.name.slice(14))));for(const type of [81,114,115])assert.equal(active.includes(type),false);
  await game(g=>{g.inventoryCategory=3;g.inventory();});for(const name of ['银叶延长链','金链节','龙虾扣'])assert.equal(await game((g,cc,name)=>!!g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content').getChildByName(name),name),false);await game(g=>g.closeModal());
  s=await state();await tap(s.crafting.slots[0].x,s.crafting.slots[0].y);
  const pose=()=>game(g=>g.craftPose(0).angle),baseAngle=await pose();
  for(const [i,value] of ['turn90','turn180','turn270','out'].entries()){await button('旋转');assert.equal((await state()).save.draftFacings[0],value);assert.equal((await state()).save.draftFacings[1],'out');assert.ok(Math.abs(await pose()-(baseAngle-(i===3?0:(i+1)*90)))<.001);}
  await button('撤销');assert.equal((await state()).save.draftFacings[0],'turn270');s=await state();await tap(s.crafting.slots[0].x,s.crafting.slots[0].y);await button('旋转');await button('旋转');assert.equal((await state()).save.draftFacings[0],'turn90');
  await page.screenshot({path:dir+'/rotated-'+width+'.png'});
  for(const i of [4,6,8,10]){s=await state();await page.getByRole('button',{name:'第'+(i+1)+'槽：'+MATERIALS[s.save.draft[i]].name,exact:true}).dispatchEvent('click');await page.waitForTimeout(100);await button('旋转');assert.equal((await state()).save.draftFacings[i],'turn90');}
  await page.screenshot({path:dir+'/all-side-profiles-'+width+'.png'});
  // A native drag swaps the rectangle and its saved direction together.
  s=await state();const from=s.crafting.slots[0],to=s.crafting.slots[2],a=await xy(from.x,from.y),b=await xy(to.x,to.y);
  if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y}]});for(let j=1;j<=8;j++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*j/8,y:a.y+(b.y-a.y)*j/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}await page.waitForTimeout(800);
  s=await state();assert.equal(s.save.draftFacings[2],'turn90');assert.equal(s.save.draftFacings[0],'out');
  await button('撤销');s=await state();assert.equal(s.save.draftFacings[0],'turn90');
  await tap(s.crafting.slots[0].x,s.crafting.slots[0].y);if(mobile)await button('删除选中材质');else{await page.locator('#GameCanvas').focus();await page.keyboard.press('Delete');await page.waitForTimeout(200);}assert.equal((await state()).save.draft.length,13);await button('撤销');assert.equal((await state()).save.draftFacings[0],'turn90');
  const draft=(await state()).save.draft,facings=(await state()).save.draftFacings;
  await button('完成制作');assert.deepEqual((await state()).packing.beadFacings,facings);await page.screenshot({path:dir+'/packing-'+width+'.png'});await button('保存并上架');assert.equal((await state()).modal,'listing');assert.deepEqual((await state()).save.commerce.works[0].beadFacings,facings);await button('确认上架');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');s=await state();assert.deepEqual(s.save.commerce.works[0].beadFacings,facings);assert.deepEqual(s.save.commerce.works[0].beads,draft);assert.equal(s.save.inventory[114],10);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,widths:[390,1440],retiredHidden:true,threeSideProfiles:true,nativeQuarterTurns:true,nativeDragSwap:true,deleteUndo:true,saveListReload:true,errors},null,2));console.log('Material directions passed390/1440: removed choices hidden, side sprites, native rotation/drag/delete/undo, packing/list/reload.');
}finally{await browser.close();}
