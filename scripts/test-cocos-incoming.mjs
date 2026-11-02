import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {ORDERS,RETURN_ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/';
fs.mkdirSync('artifacts/incoming',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(100),draft:[0,3,...Array(10).fill(null)],charm:'heart'};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 // Energy's recovery timestamp is refreshed by the existing load/timer lifecycle.
 const sameSave=(actual,expected)=>assert.deepEqual({...actual,energyAt:0},{...expected,energyAt:0});
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 const orders=[];
 for(let i=0;i<=ORDERS.length;i++){
  const o=i===ORDERS.length?RETURN_ORDERS[0]:ORDERS[i];
  await fixture({...initial,completed:ORDERS.slice(0,i).map(o=>o.id),orderId:o.id});
  const before=(await state()).save;await tap(360,938);let s=await state();
  assert.equal(s.screen,'orderArrival');assert.equal(s.incomingOrder.id,o.id);assert.equal(s.incomingOrder.customer,o.customer);assert.equal(s.incomingOrder.name,o.name);
  assert.equal(s.incomingOrder.mainNeed,o.mainNeed);assert.equal(s.incomingOrder.accentNeed,o.accentNeed);assert.equal(s.incomingOrder.charm,o.charm);assert.equal(s.incomingOrder.repeatNumber,i===ORDERS.length?1:null);sameSave(s.save,before);
  await page.screenshot({path:'artifacts/incoming/'+(i===ORDERS.length?'repeat-':'order-')+o.id+'.png'});
  await tap(617,68);s=await state();assert.equal(s.incomingOrder.guide,false);assert.equal(await page.getByRole('button',{name:'跳过引导',exact:true}).count(),0);sameSave(s.save,before);
  if(i===0)await page.screenshot({path:'artifacts/incoming/skipped.png'});
  await tap(360,1093);s=await state();assert.equal(s.screen,'craft');sameSave(s.save,before);
  await escape();await action('返回店铺');await action('按单制作');assert.equal((await state()).incomingOrder.guide,true);
  await tap(360,560);assert.equal((await state()).screen,'craft');sameSave((await state()).save,before);
  orders.push(o.id);
 }
 await fixture(initial);await action('委托');await action('按单制作 180金');assert.equal((await state()).screen,'orderArrival');await escape();assert.equal((await state()).screen,'home');
 await action('按单制作');
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/incoming/layout-${width}.png`});await tap(360,1093);assert.equal((await state()).screen,'craft');await escape();await action('返回店铺');await action('按单制作');
 }
 await page.setViewportSize({width:540,height:960});await action('跳过引导');const saved=(await state()).save;
 await page.reload({waitUntil:'networkidle'});await ready();sameSave((await state()).save,saved);await action('按单制作');assert.equal((await state()).incomingOrder.guide,true);
 const empty={...initial,inventory:Array(6).fill(0)};await fixture(empty);await action('按单制作');let s=await state();assert.equal(s.incomingOrder.deficits[0],6);assert.equal(s.incomingOrder.deficits[3],3);
 await page.screenshot({path:'artifacts/incoming/shortage.png'});await tap(360,1174);assert.equal((await state()).modal,'intro');sameSave((await state()).save,empty);await escape();assert.equal((await state()).screen,'orderArrival');await escape();assert.equal((await state()).screen,'home');sameSave((await state()).save,empty);
 await action('按单制作');await action('去采珠');await page.getByRole('button',{name:/^开始采珠 · /}).dispatchEvent('click');s=await state();assert.equal(s.screen,'match');assert.equal(s.save.energy,empty.energy-1);assert.deepEqual(s.save.inventory,empty.inventory);
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/incoming/report.json',JSON.stringify({base,orders,nativeCardAndButtons:true,guideSkip:true,trueRequirementsAndStock:true,noPreviewCharges:true,draftAndCharmPreserved:true,shortageHarvest:true,reload:true,threeViewports:true,errors},null,2));
 console.log('Incoming orders passed: six commissions and returning order, native card/start/skip, exact requirements/stock, unchanged saves/drafts, shortage to harvest, return/Escape, reload and three widths.');
} finally {await browser.close();}
