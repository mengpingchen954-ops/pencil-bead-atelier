import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,deliver} from '../cocos/assets/scripts/model.ts';
import {ORDERS,STORIES} from '../cocos/assets/scripts/content.ts';
import {finishStory} from '../cocos/assets/scripts/story.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/';
fs.mkdirSync('artifacts/story-route',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url);});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(1000)};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const esc=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();await action('故事解锁');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('故事解锁');
 let s=await state();assert.equal(s.screen,'storyMap');assert.equal(s.storyRoute.currentId,'family');assert.equal(s.storyRoute.read,0);assert.deepEqual(s.storyRoute.stops.filter(s=>s.unlocked).map(s=>s.id),['family']);
 await page.screenshot({path:'artifacts/story-route/fresh.png'});
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/story-route/layout-${width}.png`});}
 await page.setViewportSize({width:540,height:960});const untouched=s.save;await tap(211,621);s=await state();assert.equal(s.modal,'');assert.deepEqual(s.save,untouched);
 await tap(360,1151);s=await state();assert.equal(s.story.id,'old-table');await action('跳过');s=await state();assert.equal(s.screen,'storyMap');assert.equal(s.storyRoute.read,1);assert.equal(s.save.coins,initial.coins);
 await action('制作手串 · 解锁故事');s=await state();assert.equal(s.screen,'craft');assert.equal(s.save.orderId,'daisy');assert.deepEqual(s.save.inventory,initial.inventory);
 let earned=finishStory(initial,'old-table');const stages=[];
 for(let index=0;index<ORDERS.length;index++){
  const order=ORDERS[index];earned=deliver({...earned,draft:[...order.palette].reverse(),charm:order.charm});earned.deliveryReceipt=null;
  await fixture(earned);s=await state();const scene=STORIES.find(s=>s.afterOrder===order.id),saved=s.save;
  assert.equal(s.storyRoute.nextStoryId,scene.id);assert.equal(s.storyRoute.currentId,['workshop','workshop','shop','shop','name','tomorrow'][index]);
  if(index===0){await tap(524,447);assert.equal((await state()).modal,'route-chapter');assert.equal(await page.getByRole('button',{name:'阅读 · 待解锁',exact:true}).isDisabled(),true);await esc();}
  await page.screenshot({path:`artifacts/story-route/after-${order.id}.png`});
  await action('继续故事');assert.equal((await state()).story.id,scene.id);await action('跳过');s=await state();assert.equal(s.screen,'storyMap');assert.equal(s.storyRoute.read,index+2);
  assert.equal(s.save.coins,saved.coins);assert.deepEqual(s.save.inventory,saved.inventory);assert.deepEqual(s.save.collection,saved.collection);assert.deepEqual(s.save.draft,saved.draft);
  stages.push({order:order.id,current:s.storyRoute.currentId,read:s.storyRoute.read});earned=s.save;
 }
 assert.ok(s.storyRoute.stops.every(s=>s.unlocked&&s.read));assert.equal(s.storyRoute.nextStoryId,'');
 await action('查看章节 · 旧工作间');await action('重温 · 第一张收据，我自己收着');await action('跳过');assert.deepEqual((await state()).save,earned);
 await action('背包');assert.equal((await state()).modal,'inventory');await esc();await action('设置');assert.equal((await state()).modal,'settings');await esc();
 await action('回忆手账');assert.equal((await state()).screen,'journal');await action('人物故事 · 回忆');assert.equal((await state()).screen,'memories');
 await page.reload({waitUntil:'networkidle'});await ready();await action('故事解锁');s=await state();assert.equal(s.storyRoute.read,7);assert.equal(s.save.coins,earned.coins);await page.screenshot({path:'artifacts/story-route/completed.png'});
 await action('图鉴');assert.equal((await state()).screen,'album');
 fs.writeFileSync('artifacts/story-route/report.json',JSON.stringify({base,stages,nativeTouch:true,locks:true,replay:true,unchangedEconomy:true,reload:true,threeViewports:true,errors},null,2));assert.deepEqual(errors,[]);
 console.log('Story route passed: five earned milestones, seven existing stories, locked hints, native chapter/continue touches, no replay rewards, exact commission/economy, backpack/settings/album/memories, reload and three viewports.');
}finally{await browser.close();}
