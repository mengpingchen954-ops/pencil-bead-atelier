import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.MATERIAL_DRAG_ARTIFACTS||'artifacts/material-drag';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[];
const report={base,nativeInput:true},cancelling=new WeakSet(),cancellationWarnings=[];
async function fixture(save,viewport={width:390,height:844}){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
 await page.clock.setFixedTime(new Date());
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(cancelling.has(page)&&m.text().startsWith('Ignored attempt to cancel a touchcancel event with cancelable=false'))cancellationWarnings.push(m.text());else errors.push(m.text());}});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},save);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const ready=async()=>{await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await page.waitForTimeout(200);};
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);await page.waitForTimeout(90);};
 const button=async(name)=>{
   if(['撤销','移除','替换','预览','参考配色','采珠','评分规则'].includes(name)&&await page.getByRole('button',{name:'工具',exact:true}).count())await button('工具');
   const p=await page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
    const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const child of n.children){const result=find(child);if(result)return result;}return null;};
    const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('No native button '+name+' on '+g.screen+'/'+g.modal);
    const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);
 };
 const action=async name=>{await page.getByRole('button',{name,exact:true}).dispatchEvent('click');await page.waitForTimeout(100);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');await page.waitForTimeout(150);};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 return {context,page,state,ready,tap,button,action,escape};
}


async function drag(ui,from,to,{held,cancel=false,via}={}){
 const {page}=ui,box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/720,box.height/1280),xy=p=>({x:box.x+box.width/2+(p.x-360)*scale,y:box.y+box.height/2+(p.y-640)*scale});
 const a=xy(from),points=[...(via?[via]:[]),to].map(xy);
 if(page.viewportSize().width<1000){const cdp=await page.context().newCDPSession(page);try{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:0}]});let current=a;
  for(const b of points){for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:current.x+(b.x-current.x)*i/12,y:current.y+(b.y-current.y)*i/12,id:0}]});await page.waitForTimeout(16);}current=b;}
  await held?.();if(cancel)cancelling.add(page);await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
 }finally{await cdp.detach();}}
 else{await page.mouse.move(a.x,a.y);await page.mouse.down();for(const b of points)await page.mouse.move(b.x,b.y,{steps:12});await page.waitForTimeout(80);await held?.();await page.mouse.up();}
 await page.waitForTimeout(150);cancelling.delete(page);
}
const ghost=ui=>ui.page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame'),n=g.page.children.find(n=>n.name==='Dragged material');return n?{x:n.position.x+41,y:41-n.position.y}:null;});
try{
 const initial={...freshSave(),started:true,reduced:false,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true),draft:[1,...Array(11).fill(null)],draftSizes:[12,...Array(11).fill(8)],sound:false,music:{enabled:false,track:'glimmer',volume:0}};
 initial.materialUnlocked[2]=false;initial.inventory[2]=initial.gatheredStock[2]=0;initial.inventory[3]=initial.gatheredStock[3]=0;
 for(const [width,height] of [[360,740],[390,844],[1440,900]]){
  const ui=await fixture(initial,{width,height}),{page,state,button,tap,ready}=ui;await button('自由 DIY');
  for(const [category,type,index] of [[0,0,4],[1,12,7],[2,24,10],[3,43,2]]){
   await button(['珠宝','水晶','木质','饰品'][category]);let s=await state();const before=s.save,from=s.crafting.materials[type],to=s.crafting.slots[index];
   await tap(s.crafting.slots[0].x,s.crafting.slots[0].y);
   await drag(ui,from,to,{held:async()=>{assert.deepEqual((await state()).save,before);const p=await ghost(ui);assert.ok(p);assert.ok(Math.hypot(p.x-to.x,p.y-to.y)<3,JSON.stringify({p,to}));await page.screenshot({path:dir+'/held-'+category+'-'+width+'.png'});}});
   s=await state();assert.equal(s.save.draft[index],type);assert.equal(s.save.draft[0],1);assert.equal(s.save.draftSizes[0],12);assert.equal(s.save.draftSizes[index],8);assert.deepEqual(s.save.inventory,initial.inventory);assert.deepEqual(s.save.gatheredStock,initial.gatheredStock);assert.equal(await ghost(ui),null);assert.equal(s.crafting.flights.length,0);
   await button('撤销');assert.deepEqual((await state()).save,before);
  }
  await button('珠宝');let s=await state(),from=s.crafting.materials[0],before=s.save;
  await drag(ui,from,{x:35,y:100});assert.deepEqual((await state()).save,before);assert.equal(await ghost(ui),null);
  await drag(ui,from,from,{via:{x:360,y:410}});assert.deepEqual((await state()).save,before);
  if(width!==1440){await drag(ui,from,{x:360,y:410},{cancel:true});assert.deepEqual((await state()).save,before);assert.equal(await ghost(ui),null);}
  for(const type of [2,3]){const from=s.crafting.materials[type];await drag(ui,from,{x:360,y:410},{held:async()=>assert.equal(await ghost(ui),null)});assert.deepEqual((await state()).save,before);}
  // A normal tap still adds once with the existing flight animation.
  await tap(from.x,from.y);await page.waitForTimeout(1100);s=await state();assert.equal(s.save.draft.filter(t=>t===0).length,1);assert.equal(s.crafting.flights.length,0);
  await button('撤销');assert.deepEqual((await state()).save,before);
  await drag(ui,from,s.crafting.slots[5]);s=await state();assert.equal(s.save.draft[5],0);
  await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.draft[5],0);await button('自由 DIY');await button('完成制作');await button('保存作品');s=await state();assert.deepEqual(s.save.commerce.works[0].beads,[1,0]);assert.equal(s.save.inventory[0],19);assert.equal(s.save.inventory[1],19);
  await page.screenshot({path:dir+'/saved-'+width+'.png'});await ui.context.close();
  const full=await fixture({...initial,reduced:true,draft:Array(12).fill(1),draftSizes:Array(12).fill(10)},{width,height});await full.button('自由 DIY');let f=await full.state();
  await drag(full,f.crafting.materials[0],{x:360,y:410});f=await full.state();assert.equal(f.save.draft.length,13);assert.equal(f.save.draft[12],0);assert.equal(f.save.draftSizes[12],8);assert.deepEqual(f.save.inventory,initial.inventory);
  await full.page.screenshot({path:dir+'/full-ring-'+width+'.png'});await full.button('撤销');assert.equal((await full.state()).save.draft.length,12);await full.context.close();
 }
 assert.deepEqual(errors,[]);Object.assign(report,{widths:[360,390,1440],nativeTouchAndMouse:true,fourCategories:true,livePreview:true,nearestEmptyNoReplacement:true,outsideReturnCancel:true,lockAndStockGuards:true,clickAnimation:true,fullRingGrowth:true,undoReloadSave:true,syntheticCancelDiagnostics:cancellationWarnings.length,errors});fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Material drag passed: native touch/mouse, all four categories, held preview, empty-target placement, outside/return/cancel, locked/exhausted, click animation, full-ring growth, undo/reload/save at360/390/1440 widths.');
}finally{await browser.close();}
