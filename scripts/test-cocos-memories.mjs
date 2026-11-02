import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,deliver,normalizeSave} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';
import {finishStory} from '../cocos/assets/scripts/story.ts';
import {askSea,finishSeaVisit} from '../cocos/assets/scripts/heart.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8320/';
fs.mkdirSync('artifacts/memories',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url);});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'}};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const enter=async()=>{await action('手账');await action('人物故事 · 回忆');};
 const fixture=async s=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},s);await page.reload({waitUntil:'networkidle'});await ready();await enter();};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await enter();
 let s=await state();assert.equal(s.screen,'memories');assert.equal(s.memory.id,'grandma');assert.equal(s.memory.count,1);assert.deepEqual(s.memory.people.filter(p=>p.unlocked).map(p=>p.id),['grandma','ahe']);
 await action('未相识的人物 3');assert.equal((await state()).memory.id,'grandma');await action('回忆阿禾');assert.equal((await state()).memory.id,'ahe');
 await action('开始制作 · 当前委托');s=await state();assert.equal(s.screen,'craft');assert.equal(s.save.orderId,'daisy');assert.equal(s.save.coins,initial.coins);
 // A read memory can be paged and replayed with no changes to the paid game state.
 let progress=finishStory({...initial,inventory:Array(6).fill(1000)},'old-table');
 for(const o of ORDERS.slice(0,3))progress=deliver({...progress,draft:[...o.palette].reverse(),charm:o.charm});
 progress=askSea(progress,'fear');progress=finishSeaVisit(progress,'heart');progress.deliveryReceipt=null;
 progress=finishStory(progress,'first-receipt');progress=finishStory(progress,'stolen-design');progress=finishStory(progress,'design-record');progress=normalizeSave(progress);
 await fixture(progress);s=await state();const coins=s.save.coins,stock=s.save.inventory,draft=s.save.draft,collection=s.save.collection;
 assert.ok(s.memory.count>1);assert.equal(s.memory.entry.storyId,'design-record');
 await page.screenshot({path:'artifacts/memories/grandma.png'});
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/memories/layout-${width}.png`});}
 await page.setViewportSize({width:540,height:960});
 await action('上一段经历');const entry=(await state()).memory.entry;assert.notEqual(entry.storyId,'design-record');await action('下一段经历');
 await action('重温这段回忆');assert.equal((await state()).story.id,'design-record');await action('跳过');s=await state();assert.equal(s.screen,'memories');assert.equal(s.save.coins,coins);
 // Activate the real person tile through the visible Cocos canvas.
 await tap(362,1085);s=await state();assert.equal(s.memory.id,'xiaoman');assert.ok(s.memory.entry.text.includes('海边日出'));await page.screenshot({path:'artifacts/memories/xiaoman.png'});
 await action('查看相关作品 · 把海风戴在手上');s=await state();assert.equal(s.modal,'collection');assert.deepEqual(s.save.collection,collection);await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');
 for(const [name,id] of [['林阿姨','lin'],['许老师','teacher'],['阿禾','ahe']]){await action('回忆'+name);assert.equal((await state()).memory.id,id);await page.screenshot({path:`artifacts/memories/${id}.png`});}
 s=await state();assert.deepEqual(s.save.inventory,stock);assert.equal(s.save.coins,coins);assert.deepEqual(s.save.draft,draft);
 await action('开始制作 · 当前委托');s=await state();assert.equal(s.screen,'craft');assert.equal(s.save.orderId,'forest');assert.deepEqual(s.save.inventory,stock);
 await page.reload({waitUntil:'networkidle'});await ready();await enter();s=await state();assert.ok(s.memory.people.every(p=>p.unlocked));assert.equal(s.save.coins,coins);assert.deepEqual(s.save.collection,collection);
 fs.writeFileSync('artifacts/memories/report.json',JSON.stringify({base,people:5,history:true,replay:true,realWorks:true,nativeTouch:true,currentCommission:true,errors},null,2));assert.deepEqual(errors,[]);
 console.log('Character memories passed: five people, earned locks/stages/history, paged replay without rewards, exact related works, native touch switching, unchanged commission/stock/saves and three viewports.');
}finally{await browser.close();}
