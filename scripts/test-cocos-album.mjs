import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,deliver} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/';
fs.mkdirSync('artifacts/album',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log(e.stack);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(100)};
 let partial=structuredClone(initial);
 for(const o of ORDERS.slice(0,4))partial=deliver({...partial,draft:[...o.palette].reverse(),charm:o.charm});
 partial.deliveryReceipt=null;partial.draft=[0,3,...Array(10).fill(null)];partial.charm='heart';partial.seaHeart.visited=true;partial.seaHeart.travelCharm='heart';partial.seaHeart.facts=['fear','sunrise'];partial.collection[1].gift={blessing:'slow',paper:'sky',ribbon:'blue'};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},partial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const sameSave=(actual,expected)=>assert.deepEqual({...actual,energyAt:0},{...expected,energyAt:0});
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();await action('图鉴');};
 const search=async text=>{await page.getByRole('searchbox',{name:'搜索收藏名称或顾客'}).fill(text);await action('搜索');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('图鉴');let s=await state(),before=s.save;
 assert.equal(s.album.percent,67);assert.equal(s.album.items.length,6);assert.deepEqual(s.album.items[0].work.beads,[...ORDERS[0].palette].reverse());assert.equal(s.album.items[1].work.travelCharm,'heart');
 await page.screenshot({path:'artifacts/album/partial.png'});
 await tap(217,350);assert.equal((await state()).modal,'collection');await page.screenshot({path:'artifacts/album/preview.png'});await escape();
 await action('欣赏把海风戴在手上');assert.ok((await page.locator('#atelier-accessibility').textContent()).includes('害怕的时候，也可以慢慢走。'));await page.screenshot({path:'artifacts/album/sea-gift.png'});await escape();
 await tap(503,850);assert.equal((await state()).modal,'info');sameSave((await state()).save,before);await escape();
 await tap(443,100);assert.equal((await state()).modal,'album-filter');await action('第二章');s=await state();assert.equal(s.album.total,2);assert.equal(s.album.percent,100);assert.equal(s.album.items.length,2);
 await search('小满');s=await state();assert.equal(s.album.items.length,0);assert.equal(s.album.percent,100);await page.screenshot({path:'artifacts/album/no-results.png'});await action('清空搜索');assert.equal((await state()).album.items.length,2);
 await action('系列筛选 ▾');await action('全部剧情');
 // Use Cocos' visible input overlay after a native touch, including Enter submission.
 await tap(220,100);const nativeInput=page.locator('input:not([aria-label])').last();await nativeInput.waitFor({state:'visible'});await nativeInput.fill('林阿姨');await nativeInput.press('Enter');
 s=await state();assert.equal(s.album.query,'林阿姨');assert.equal(s.album.items.length,2);assert.equal(s.album.percent,67);await page.screenshot({path:'artifacts/album/search.png'});
 await search('  不存在的作品  ');assert.equal((await state()).album.items.length,0);await action('清空搜索');
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/album/layout-${width}.png`});await tap(217,350);assert.equal((await state()).modal,'collection');await escape();}
 await page.setViewportSize({width:540,height:960});await page.waitForTimeout(120);sameSave((await state()).save,before);
 for(const [x,target] of [[72,'home'],[216,'orders'],[360,'craft'],[504,'decor'],[648,'album']]){await tap(x,1230);assert.equal((await state()).screen,target);sameSave((await state()).save,before);if(target==='craft')await action('返回委托');await action('图鉴');}
 await action('我们的故事与回忆手账');assert.equal((await state()).screen,'journal');await escape();await action('图鉴');
 await tap(360,1074);s=await state();assert.equal(s.screen,'orderArrival');assert.equal(s.incomingOrder.id,before.orderId);sameSave(s.save,before);await escape();await action('图鉴');
 await page.reload({waitUntil:'networkidle'});await ready();sameSave((await state()).save,before);await action('图鉴');assert.equal((await state()).album.query,'');
 await fixture(initial);s=await state();assert.equal(s.album.percent,0);assert.equal(s.album.items.filter(o=>o.work).length,0);await page.screenshot({path:'artifacts/album/empty.png'});
 await action('系列筛选 ▾');await action('回头客 · 近六单');assert.equal((await state()).album.percent,0);assert.equal((await state()).album.items.length,6);
 let complete=structuredClone(initial);for(const o of ORDERS)complete=deliver({...complete,draft:[...o.palette].reverse(),charm:o.charm});
 for(let i=0;i<8;i++){const o=ORDERS[i%6];complete=deliver({...complete,draft:[...o.palette].reverse(),charm:o.charm});}complete.deliveryReceipt=null;
 await fixture(complete);s=await state();assert.equal(s.album.percent,100);const completed=s.save;await action('查看回头客作品');s=await state();assert.equal(s.album.percent,100);assert.equal(s.album.items[1].work.number,8);assert.deepEqual(s.album.items[0].work.beads,[...ORDERS[0].palette].reverse());await page.screenshot({path:'artifacts/album/returning.png'});
 await action('欣赏送给旅途中的朋友');assert.equal((await state()).modal,'collection');await escape();await action('查看剧情作品');sameSave((await state()).save,completed);
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/album/report.json',JSON.stringify({base,actualBraceletsAndCharms:true,seaBlessingAndTravelCharm:true,lockedCards:true,realSeriesProgress:true,nativeSearchAndEnter:true,semanticSearch:true,emptyAndNoResults:true,recentReturningWorks:true,commissionEntry:true,nativeFiveTabs:true,noSaveChanges:true,reload:true,threeViewports:true,errors},null,2));
 console.log('Collection album passed: real custom bracelets/charms/blessings, locks, truthful chapter progress, native input/Enter and semantic search, empty states, recent returning works, commissioned crafting, five touch tabs, unchanged saves, reload and three widths.');
} finally {await browser.close();}
