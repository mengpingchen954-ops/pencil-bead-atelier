import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:5217/cocos-web/',dir='artifacts/ui-redesign';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'}};
 await page.addInitScript(save=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*s,b.y+b.height/2+(y-640)*s);};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();};
 const shot=async name=>{await page.waitForTimeout(120);await page.screenshot({path:dir+'/'+name+'.png'});};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 for(const [width,height] of [[360,740],[390,844],[540,960],[1440,900]]){
  await page.setViewportSize({width,height});await fixture(initial);const before=(await state()).save;
  await shot('home-'+width);
  await tap(205,928);assert.equal((await state()).screen,'orderArrival');await action('返回小店');
  await tap(216,1230);assert.equal((await state()).screen,'orders');await shot('orders-'+width);
  await tap(572,1125);assert.equal(await page.getByRole('button',{name:'← 前三份',exact:true}).count(),1);await shot('orders-next-'+width);
  await tap(148,1125);await action('按单制作 180金');assert.equal((await state()).incomingOrder.id,'daisy');await action('返回小店');
  await tap(360,1115);assert.equal((await state()).screen,'journal');await shot('journal-'+width);
  await tap(591,1126);await tap(591,1126);await shot('journal-last-'+width);
  await tap(129,1126);await tap(129,1126);
  await action('小店');await tap(576,1115);assert.equal((await state()).screen,'contest');await shot('contest-'+width);
  await action('装修');assert.equal((await state()).screen,'decor');await shot('decor-'+width);
  assert.deepEqual((await state()).save,before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.setViewportSize({width:540,height:960});
 await fixture({...initial,inventory:[0,0,0,0,0,0]});await shot('home-shortage');
 await tap(507,928);assert.equal((await state()).modal,'intro');await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');
 const completed={...initial,completed:ORDERS.map(o=>o.id),orderId:'sea',repeatOrders:4,coins:222,inventory:Array(6).fill(100),seenStories:['opening']};
 await fixture(completed);const saved=(await state()).save;await shot('home-returning');
 await action('委托');await shot('orders-returning');
 const name=await page.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.textContent).find(s=>/^按单制作 /.test(s)));
 assert.ok(name);await action(name);
 assert.equal((await state()).screen,'orderArrival');assert.deepEqual((await state()).save,saved);
 await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual({...((await state()).save),energyAt:0},{...saved,energyAt:0});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(dir+'/report.json',JSON.stringify({base,widths:[360,390,540,1440],nativeHomeAndNavigation:true,pagination:true,returningCustomer:true,stockRoutes:true,savesPreserved:true,errors},null,2));
 console.log('UI passed: four viewports, native main/secondary/navigation taps, both commission pages, shortages, returning orders and exact saved progress.');
}finally{await browser.close();}
