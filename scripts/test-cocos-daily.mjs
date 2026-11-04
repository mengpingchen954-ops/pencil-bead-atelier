import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,normalizeSave,findMove,total,draftCounts,deliver} from '../cocos/assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice,priceBounds} from '../cocos/assets/scripts/commerce.ts';
import {ORDERS,MATERIALS} from '../cocos/assets/scripts/content.ts';
import {materialPalette,charmType} from '../cocos/assets/scripts/materials.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.DAILY_ARTIFACTS||'artifacts/daily';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[];
const report={base,nativeInput:true};
async function fixture(save,viewport={width:390,height:844},time=Date.parse("2026-11-04T02:00:00Z")){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage();await page.clock.setFixedTime(new Date(time));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},save);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const ready=async()=>{await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await page.waitForTimeout(200);};
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);await page.waitForTimeout(90);};
 const button=async(name)=>{
   if(name==='每日签到'||name==='今日已签到')name=await page.getByRole('button',{name:/^(每日签到|今日已签到)$/}).textContent();
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
const DAY=86400000,now=Date.parse('2026-11-04T02:00:00Z');
const initial={...freshSave(),started:true,energy:5,energyAt:now,sound:false,music:{enabled:false,track:'glimmer',volume:0}};
try{
 const ui=await fixture(initial),{page,state,button,tap,ready}=ui;
 const before=(await state()).save;await button('每日签到');assert.equal((await state()).modal,'daily');assert.deepEqual((await state()).save,before);
 await page.screenshot({path:dir+'/rewards.png'});
 const claimPoint=await page.getByRole('button',{name:'领取今日奖励',exact:true}).count();assert.equal(claimPoint,1);await button('领取今日奖励');let s=await state();
 assert.equal(s.save.coins,before.coins+30);assert.equal(s.save.energy,6);assert.equal(s.save.daily.streak,1);assert.equal(s.daily.canClaim,false);assert.equal(await page.getByRole('button',{name:'今日已领取',exact:true}).isDisabled(),true);
 await tap(360,991);assert.equal((await state()).save.coins,s.save.coins);await button('×');await button('今日已签到');assert.equal((await state()).daily.canClaim,false);await button('×');
 await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.coins,s.save.coins);assert.equal((await state()).save.daily.streak,1);
 const materials=['inventory','gatheredStock','materialUnlocked'];for(const key of materials)assert.deepEqual((await state()).save[key],before[key]);
 for(const width of [360,390,540,1440]){await page.setViewportSize({width,height:width===1440?900:844});await page.waitForTimeout(100);await button('今日已签到');await page.screenshot({path:dir+'/daily-'+width+'.png'});assert.equal((await state()).modal,'daily');await button('×');}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:dir+'/home-claimed.png'});report.sameDayAndReload=true;
 await page.clock.setFixedTime(new Date(now+DAY));await button('今日已签到');assert.equal((await state()).daily.day,2);await button('领取今日奖励');assert.equal((await state()).save.daily.streak,2);await button('×');
 await page.clock.setFixedTime(new Date(now+3*DAY));await button('今日已签到');assert.equal((await state()).daily.day,1);await button('领取今日奖励');assert.equal((await state()).save.daily.streak,1);await button('×');report.nextDayAndMissedDay=true;
 // A backward clock never makes a previously claimed date available.
 await page.clock.setFixedTime(new Date(now));await button('今日已签到');assert.equal((await state()).daily.canClaim,false);await ui.context.close();report.rollbackBlocked=true;
 // Seven-day bonus, exact overflow conversion, and continuation into the next cycle.
 const seventh=await fixture({...initial,energy:9,daily:{lastDay:Math.floor((now+8*3600000)/DAY)-1,streak:6}});await seventh.button('每日签到');assert.equal((await seventh.state()).daily.day,7);await seventh.page.screenshot({path:dir+'/seventh-day.png'});await seventh.button('领取今日奖励');const earned=(await seventh.state()).save;assert.equal(earned.coins,initial.coins+140);assert.equal(earned.energy,10);assert.equal(earned.daily.streak,7);await seventh.button('×');
 await seventh.page.clock.setFixedTime(new Date(now+DAY));await seventh.button('今日已签到');assert.equal((await seventh.state()).daily.day,1);await seventh.button('领取今日奖励');assert.equal((await seventh.state()).save.daily.streak,8);await seventh.context.close();report.sevenDayCycleAndOverflow=true;
 // A storage failure leaves rewards claimable, with no unsaved grant.
 const failed=await fixture(initial);await failed.button('每日签到');await failed.page.evaluate(()=>{window.restoreStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='pencil-bead-atelier-v1')throw new DOMException('Test quota','QuotaExceededError');return window.restoreStorage.call(this,key,value);};});
 await failed.button('领取今日奖励');assert.equal((await failed.state()).save.coins,initial.coins);assert.equal((await failed.state()).daily.canClaim,true);await failed.page.evaluate(()=>{Storage.prototype.setItem=window.restoreStorage;});await failed.button('领取今日奖励');assert.equal((await failed.state()).save.coins,initial.coins+30);await failed.context.close();report.storageFailureNoGrant=true;
 // A legacy save keeps its property and acquires a fresh daily calendar without a gift on opening.
 const old={...initial,coins:1342};delete old.daily;const legacy=await fixture(old);assert.equal((await legacy.state()).save.coins,1342);await legacy.button('每日签到');assert.equal((await legacy.state()).save.coins,1342);await legacy.context.close();report.legacyPreserved=true;
 assert.deepEqual(errors,[]);report.errors=errors;report.widths=[360,390,540,1440];fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Daily check-in passed: native rewards preview, claim/repeat/reload, day rollover, missed day, seven-day cycle, overflow, rollback, save failure and four widths.');
}finally{await browser.close();}
