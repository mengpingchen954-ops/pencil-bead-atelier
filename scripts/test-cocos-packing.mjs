import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,deliver,draftCounts} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';
import {askSea,chooseSeaGift} from '../cocos/assets/scripts/heart.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8320/';
fs.mkdirSync('artifacts/packing',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(100),draft:[...ORDERS[0].palette].reverse()};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const enter=async reward=>{await action('按单制作');await action('开始制作');await action('完成制作');assert.equal((await state()).screen,'packing');};
 const fixture=async s=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},s);await page.reload({waitUntil:'networkidle'});await ready();};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await enter(180);
 let s=await state();assert.deepEqual(s.packing.beads,initial.draft);assert.equal(s.packing.orderId,'daisy');assert.deepEqual(s.save.inventory,initial.inventory);assert.equal(s.save.coins,initial.coins);
 await page.screenshot({path:'artifacts/packing/daisy.png'});
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/packing/layout-${width}.png`});}
 await page.setViewportSize({width:540,height:960});await tap(627,68);assert.equal((await state()).screen,'craft');
 await action('完成制作');await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');s=await state();assert.equal(s.screen,'craft');assert.deepEqual(s.save.draft,initial.draft);assert.equal(s.save.coins,initial.coins);
 await action('完成制作');await tap(204,1171);s=await state();assert.equal(s.screen,'delivery');assert.equal(s.save.coins,initial.coins+180);assert.deepEqual(s.delivery.work.beads,initial.draft);assert.deepEqual(s.save.inventory,initial.inventory.map((n,i)=>n-draftCounts(initial.draft)[i]));
 await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.coins,s.save.coins);
 let sea=deliver(initial);sea.deliveryReceipt=null;sea={...sea,draft:[...ORDERS[1].palette].reverse(),charm:ORDERS[1].charm};sea=askSea(askSea(sea,'fear'),'sunrise');
 await fixture(sea);await enter(220);await action('挑选祝福与包装');
 const locked=page.getByRole('button',{name:/走得再远/});assert.equal(await locked.isDisabled(),true);
 await action('害怕的时候，也可以慢慢走。');await action('晨空蓝纸');await action('海风蓝丝带');await action('保存包装选择');
 s=await state();assert.equal(s.modal,'');assert.equal(s.screen,'packing');assert.deepEqual(s.packing.gift,{blessing:'slow',paper:'sky',ribbon:'blue'});assert.deepEqual(s.save.inventory,sea.inventory);assert.equal(s.save.coins,sea.coins);
 await page.screenshot({path:'artifacts/packing/sea-selected.png'});
 // Reopening after reload keeps the exact draft and selected wrapping; default resets no chat facts.
 await page.reload({waitUntil:'networkidle'});await ready();await enter(220);assert.equal((await state()).packing.gift.blessing,'slow');
 await tap(516,1171);s=await state();assert.equal(s.screen,'delivery');assert.deepEqual(s.delivery.work.gift,{blessing:'scenery',paper:'cream',ribbon:'sage'});assert.deepEqual(s.save.seaHeart.facts,sea.seaHeart.facts);assert.equal(s.save.coins,sea.coins+220);
 await action('继续营业');assert.equal((await state()).modal,'sea-response');
 for(const [field,id] of [['blessing','slow'],['paper','sky'],['ribbon','blue']])sea=chooseSeaGift(sea,field,id);
 await fixture(sea);await enter(220);await tap(204,1171);s=await state();assert.deepEqual(s.delivery.work.gift,sea.seaHeart.gift);assert.deepEqual(s.delivery.work.beads,sea.draft);assert.equal(s.save.coins,sea.coins+220);
 fs.writeFileSync('artifacts/packing/report.json',JSON.stringify({base,realDraft:true,cancel:true,nativeTouch:true,customAndDefaultGift:true,reload:true,threeViewports:true,errors},null,2));assert.deepEqual(errors,[]);
 console.log('Packing passed: real draft/charm, cancel and Escape, native confirm/default touches, locked choices, chosen/default saved gifts, exact single transaction, reload and three viewports.');
}finally{await browser.close();}
