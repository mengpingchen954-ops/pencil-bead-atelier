import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,deliver,draftCounts} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/';
const dir='artifacts/collection-detail';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 let complete={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(100)};
 const sea=[2,2,0,2,1,0,2,3,0,2,5,2];
 for(const o of ORDERS)complete=deliver({...complete,draft:o.id==='sea'?sea:[...o.palette].reverse(),charm:o.charm});
 complete.deliveryReceipt=null;complete.draft=[1,...Array(11).fill(null)];complete.charm='heart';
 complete.seaHeart.visited=true;complete.seaHeart.travelCharm='heart';complete.seaHeart.facts=['fear','sunrise'];complete.collection[1].gift={blessing:'slow',paper:'sky',ribbon:'blue'};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},complete);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const sameSave=(a,b)=>assert.deepEqual({...a,energyAt:0},{...b,energyAt:0});
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();await action('图鉴');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('图鉴');const before=(await state()).save;
 for(const order of ORDERS){
   await action('欣赏'+order.name);const s=await state(),detail=s.collectionDetail,work=s.save.collection.find(w=>w.id===order.id);
   assert.equal(s.modal,'collection');assert.equal(detail.id,order.id);assert.deepEqual(detail.work,work);
   const actual=Array(6).fill(0);for(const m of detail.materials)if(m.art.startsWith('bead-'))actual[Number(m.art.slice(5))]=m.count;
   assert.deepEqual(actual,draftCounts(work.beads));assert.ok(detail.materials.some(m=>m.art==='charm-'+work.charm));assert.equal(detail.customer,order.customer);assert.equal(detail.repeat,false);
   if(order.id==='sea'){assert.equal(detail.blessing,'害怕的时候，也可以慢慢走。');assert.equal(detail.work.travelCharm,'heart');assert.equal(detail.materials.length,7);await page.screenshot({path:dir+'/sea-full-materials.png'});}
   else await page.screenshot({path:dir+'/'+order.id+'.png'});
   await action('查看订单故事');let story=await state();assert.equal(story.modal,'collection-story');assert.equal(story.dialogue.text,order.text);
   await action('记录');await escape();assert.equal((await state()).modal,'collection-story');
   let lines=0;while(await page.getByRole('button',{name:'下一句  →',exact:true}).count()){assert.ok(++lines<30);await action('下一句  →');}
   await action('返回珍藏');assert.equal((await state()).collectionDetail.id,order.id);sameSave((await state()).save,before);
   await action('返回收藏');assert.equal((await state()).modal,'');
 }
 // Search/chapter state is browsing state and survives detail and nested actions.
 await action('系列筛选 ▾');await action('第一章');await page.getByRole('searchbox',{name:'搜索收藏名称或顾客'}).fill('小满');await action('搜索');
 await action('欣赏把海风戴在手上');await tap(220,1130);assert.equal((await state()).modal,'collection-remake');await page.screenshot({path:dir+'/remake-confirm.png'});
 await action('保留当前草稿');sameSave((await state()).save,before);await action('查看订单故事');await escape();assert.equal((await state()).modal,'collection');
 await escape();let s=await state();assert.equal(s.album.query,'小满');assert.equal(s.album.series,'第一章');assert.equal(s.album.items.length,1);sameSave(s.save,before);
 await action('欣赏把海风戴在手上');
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(180);await page.screenshot({path:dir+`/layout-${width}.png`});
   await tap(500,1130);assert.equal((await state()).modal,'collection-story');await escape();await tap(360,72);assert.equal((await state()).modal,'');await action('欣赏把海风戴在手上');
 }
 await page.setViewportSize({width:540,height:960});await page.waitForTimeout(180);
 await action('再做一条');await action('按此配色继续委托');s=await state();assert.equal(s.screen,'craft');assert.equal(s.crafting.orderId,before.orderId);assert.deepEqual(s.save.draft,sea);assert.equal(s.save.charm,'moon');
 sameSave({...s.save,draft:before.draft,charm:before.charm},before);await action('撤销');sameSave((await state()).save,before);
 await page.reload({waitUntil:'networkidle'});await ready();sameSave((await state()).save,before);
 let returning=structuredClone(complete);for(let i=0;i<8;i++){const o=ORDERS[i%6];returning=deliver({...returning,draft:[...o.palette].reverse(),charm:o.charm});}returning.deliveryReceipt=null;
 await fixture(returning);await action('查看回头客作品');const returningBefore=(await state()).save;await action('欣赏送给旅途中的朋友');s=await state();assert.equal(s.collectionDetail.repeat,true);assert.equal(s.collectionDetail.work.number,8);assert.equal(s.collectionDetail.series,'回头客 · 第 8 单');assert.equal(s.collectionDetail.blessing,null);await page.screenshot({path:dir+'/returning.png'});
 await action('查看订单故事');assert.equal((await state()).dialogue.text,(await state()).collectionDetail.text);await action('返回珍藏');await escape();sameSave((await state()).save,returningBefore);
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,sixActualBracelets:true,actualMaterialCounts:true,seaBlessingWrappingAndTravelCharm:true,sevenMaterialsLayout:true,readOnlyMatchingStories:true,recordAndEscapeReturn:true,remakeCancelAndUndo:true,currentCommissionPreserved:true,searchAndChapterPreserved:true,returningNumber:true,reload:true,nativeTouchThreeWidths:true,errors},null,2));
 console.log('Enlarged collection passed: six real works, exact materials, sea gifts/travel charm, archive stories, nested return, commission remake/cancel/undo, saved drafts, returning works, touch and three widths.');
} finally {await browser.close();}
