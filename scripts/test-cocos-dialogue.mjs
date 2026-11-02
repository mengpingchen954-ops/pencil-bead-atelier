import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,deliver} from '../cocos/assets/scripts/model.ts';
import {STORIES,ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8320/';
fs.mkdirSync('artifacts/dialogue',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'}};
 await page.addInitScript(s=>{
  if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}
  if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));
 },initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('打开小店  →');
 let s=await state();assert.equal(s.modal,'story');assert.equal(s.dialogue.speaker,'往事');
 await action('记录');assert.equal((await state()).modal,'dialogue-record');assert.equal(await page.getByText(STORIES[0].lines[1][1],{exact:true}).count(),0);await action('返回对话');
 for(let i=0;i<4;i++)await action('下一句  →');
 s=await state();assert.equal(s.dialogue.speaker,'奶奶');assert.equal(s.dialogue.text,STORIES[0].lines[4][1]);
 await page.screenshot({path:'artifacts/dialogue/grandma.png'});
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/dialogue/layout-${width}.png`});}
 await page.setViewportSize({width:540,height:960});
 await tap(586,68);s=await state();assert.equal(s.modal,'dialogue-record');await page.screenshot({path:'artifacts/dialogue/record.png'});
 assert.equal(await page.getByText(STORIES[0].lines[5][1],{exact:true}).count(),0);
 await action('上一页');assert.equal(await page.getByText(STORIES[0].lines[2][1],{exact:true}).count(),1);
 await page.keyboard.press('Escape');s=await state();assert.equal(s.modal,'story');assert.equal(s.story.line,4);
 await tap(516,1208);s=await state();assert.equal(s.story.line,5);assert.equal(s.dialogue.speaker,'阿禾');await page.screenshot({path:'artifacts/dialogue/ahe.png'});
 await tap(673,68);s=await state();assert.equal(s.modal,'');assert.deepEqual(s.save.seenStories,['old-table']);assert.equal(s.save.coins,initial.coins);assert.deepEqual(s.save.inventory,initial.inventory);
 await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.seenStories,['old-table']);
 // Every authored story, including offscreen speakers, uses the live dialogue stage.
 const unlocked={...initial,started:true,completed:ORDERS.map(o=>o.id),orderId:'promise',upgrades:{chair:1,desk:1,display:1},seenStories:[]};
 await fixture(unlocked);await action('手账');const read=[];
 for(let i=0;i<STORIES.length;i++){
  if(i===5)await action('后五段 →');
  await page.getByRole('button',{name:'阅读 / 重温',exact:true}).nth(i%5).dispatchEvent('click');
  const story=STORIES[i];
  for(let j=0;j<story.lines.length;j++){
   s=await state();assert.equal(s.modal,'story');assert.equal(s.story.id,story.id);assert.equal(s.dialogue.speaker,story.lines[j][0]);assert.equal(s.dialogue.text,story.lines[j][1]);
   await action(j===story.lines.length-1?'收好这一页':'下一句  →');
  }
  read.push(story.id);assert.ok((await state()).save.seenStories.includes(story.id));
 }
 s=await state();assert.equal(s.save.seenStories.length,10);assert.equal(s.save.coins,initial.coins);assert.deepEqual(s.save.inventory,initial.inventory);
 // Chat choices and their transcript preserve learned details and the active commission.
 const first=deliver({...initial,started:true,inventory:Array(6).fill(100),draft:ORDERS[0].palette});first.deliveryReceipt=null;
 await fixture(first);await action('按单制作');await action('听故事');
 await action('有什么让你担心的吗？');s=await state();assert.equal(s.modal,'sea-chat');assert.equal(s.dialogue.speaker,'小满');assert.deepEqual(s.save.seaHeart.facts,['fear']);await page.screenshot({path:'artifacts/dialogue/sea-chat.png'});
 await action('记录');assert.equal((await state()).modal,'dialogue-record');await action('返回对话');assert.equal((await state()).save.orderId,'sea');
 await action('把这份心意记住');await action('参考配色');await action('按参考排珠');await action('包装交付  ·  220 金币');
 await action('害怕的时候，也可以慢慢走。');await action('确认包装交付');await action('继续营业');
 s=await state();assert.equal(s.modal,'sea-response');assert.equal(s.dialogue.speaker,'小满');await page.screenshot({path:'artifacts/dialogue/sea-response.png'});
 const paid=s.save.coins;await action('记录');await action('返回对话');assert.equal((await state()).save.coins,paid);
 await action('目送她出发');assert.equal((await state()).modal,'story');await action('跳过');assert.equal((await state()).save.coins,paid);
 fs.writeFileSync('artifacts/dialogue/report.json',JSON.stringify({base,read,records:true,nativeTouch:true,seaChatAndResponse:true,errors},null,2));assert.deepEqual(errors,[]);
 console.log('Dialogue UI passed: all ten stories, exact live speakers/lines, read-only paged records, native touch continue/skip, saved completion, no repeated rewards, sea choices/response and three viewports.');
}finally{await browser.close();}
