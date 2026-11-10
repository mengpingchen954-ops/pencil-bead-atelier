import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/';
const dir=process.env.WELCOME_ARTIFACTS||'artifacts/welcome';
const key='pencil-bead-atelier-v1',errors=[],cases=[];
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
async function fixture(save,width=390){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key,save});
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const button=async name=>{
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const p=await page.evaluate(async name=>{
   const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const child of n.children){const result=find(child);if(result)return result;}return null;};
   const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing native button '+name);
   const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};
  },name);
  const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);
  const x=b.x+b.width/2+(p.x-360)*scale,y=b.y+b.height/2+(p.y-640)*scale;
  if(width===390)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 };
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 return {context,page,state,button,escape,ready};
}
try{
 for(const width of [390,1440])for(const existing of [false,true])for(const route of ['close','escape','free']){
  const initial={...freshSave(),sound:false,music:{enabled:false,track:'glimmer',volume:0},firstSteps:existing?{craft:100}:{}};
  const ui=await fixture(initial,width),{page,state,button,escape}=ui;
  assert.equal((await state()).screen,'cover');await button('打开小店  →');assert.equal((await state()).modal,'welcome-diy');
  const before=(await state()).save;
  if(!existing&&route==='close')await page.screenshot({path:`${dir}/welcome-${width}.png`});
  if(route==='escape')await escape();else await button(route==='close'?'×':'自由做一条');
  const s=await state();assert.equal(s.screen,'craft');assert.equal(s.modal,'');assert.ok(s.save.firstSteps.craft);
  assert.equal(s.save.firstSteps.secondOrder,undefined);assert.deepEqual({...s.save,firstSteps:{}},{...before,firstSteps:{}});
  if(existing)assert.equal(s.save.firstSteps.craft,100);
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(stored.firstSteps.craft,s.save.firstSteps.craft);
  if(!existing)await page.screenshot({path:`${dir}/craft-${route}-${width}.png`});
  await page.reload({waitUntil:'networkidle'});await ui.ready();assert.equal((await state()).save.firstSteps.craft,s.save.firstSteps.craft);
  cases.push({width,existing,route,craft:s.save.firstSteps.craft,persistedAfterReload:true});await ui.context.close();
 }
 // Gathering remains a separate firstGather milestone; entering its intro grants nothing.
 const ui=await fixture({...freshSave(),sound:false,music:{enabled:false,track:'glimmer',volume:0}});
 await ui.button('打开小店  →');const before=(await ui.state()).save;await ui.button('先去三消采珠');
 assert.equal((await ui.state()).modal,'intro');assert.deepEqual((await ui.state()).save,before);
 await ui.page.getByRole('button',{name:/^开始采珠/}).dispatchEvent('click');
 const gathered=await ui.state();assert.equal(gathered.screen,'match');assert.ok(gathered.save.firstSteps.firstGather);assert.equal(gathered.save.firstSteps.craft,undefined);
 await ui.escape();assert.equal((await ui.state()).modal,'pause');await ui.context.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,cases,gatheringUnchanged:true,errors},null,2));
 console.log('Welcome passed: native close, Escape and free-craft, fresh/old saves, first timestamp, persisted reload, mobile/desktop and gathering regression.');
}finally{await browser.close();}
