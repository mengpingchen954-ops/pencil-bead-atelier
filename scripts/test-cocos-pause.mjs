import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,move} from '../cocos/assets/scripts/model.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/';
fs.mkdirSync('artifacts/pause',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,completed:['daisy'],orderId:'sea',reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(100),draft:[0,3,...Array(10).fill(null)]};
 await page.addInitScript(s=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();};
 const startMatch=async()=>{await action('消除采珠');await action('再采一些备用');assert.equal((await state()).screen,'match');};
 const audioReady=()=>page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).music.playing,{},{timeout:15000});
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('按单制作');await action('开始制作');await tap(650,42);
 let s=await state();assert.equal(s.modal,'pause');assert.equal(s.pause.context,'craft');assert.deepEqual(s.save.draft,initial.draft);
 await page.screenshot({path:'artifacts/pause/craft.png'});
 await tap(90,1040);assert.deepEqual((await state()).save.draft,initial.draft);
 await tap(477,453);s=await state();assert.equal(s.pause.music,true);await audioReady();assert.equal((await state()).music.playing,true);
 await tap(477,531);assert.equal((await state()).save.sound,true);await tap(477,609);assert.equal((await state()).save.reduced,false);
 await tap(360,680);assert.equal((await state()).modal,'music');await tap(455,834);assert.equal((await state()).save.music.volume,.75);
 const track=(await state()).music.track;await tap(492,916);await audioReady();assert.notEqual((await state()).music.track,track);assert.equal((await state()).music.playing,true);
 await escape();assert.equal((await state()).modal,'pause');await tap(360,770);s=await state();assert.equal(s.modal,'');assert.deepEqual(s.save.draft,initial.draft);assert.deepEqual(s.save.inventory,initial.inventory);assert.equal(s.save.energy,initial.energy);
 // Escape opens the same menu. Toggling and returning from music preserve editor bindings.
 await escape();assert.equal((await state()).modal,'pause');await tap(477,453);assert.equal((await state()).music.playing,false);
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/pause/layout-${width}.png`});await tap(477,531);await tap(477,531);assert.equal((await state()).save.sound,true);}
 await page.setViewportSize({width:540,height:960});await tap(240,890);assert.equal((await state()).modal,'pause-restart');await escape();assert.equal((await state()).modal,'pause');assert.deepEqual((await state()).save.draft,initial.draft);
 await tap(240,890);await tap(360,844);assert.ok((await state()).save.draft.every(n=>n===null));await action('撤销');assert.deepEqual((await state()).save.draft,initial.draft);
 await escape();await tap(480,890);s=await state();assert.equal(s.screen,'home');assert.deepEqual(s.save.draft,initial.draft);
 const prefs={music:s.save.music,sound:s.save.sound,reduced:s.save.reduced};await page.reload({waitUntil:'networkidle'});await ready();s=await state();assert.deepEqual(s.save.music,prefs.music);assert.equal(s.save.sound,prefs.sound);assert.equal(s.save.reduced,prefs.reduced);
 // Exercise actual board input before pausing so resume must retain played progress.
 await startMatch();s=await state();let choice;
 for(let i=0;i<64&&!choice;i++)for(const j of [i+1,i+8]){const r=move(s.session,i,j);if(r.valid&&r.session.status==='playing'){choice=[i,j];break;}}
 assert.ok(choice);for(const i of choice)await tap(84+(i%8)*78,376+Math.floor(i/8)*78);
 await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy);s=await state();const played=s.session,stock=s.save.inventory,energy=s.save.energy;
 await tap(360,1234);assert.equal((await state()).modal,'pause');await tap(84,376);assert.deepEqual((await state()).session,played);await page.screenshot({path:'artifacts/pause/match.png'});
 await tap(360,770);assert.deepEqual((await state()).session,played);await escape();await tap(240,890);await tap(360,744);assert.equal((await state()).modal,'pause');assert.deepEqual((await state()).session,played);
 await tap(240,890);await tap(360,844);s=await state();assert.equal(s.modal,'');assert.equal(s.save.energy,energy-1);assert.equal(s.session.level,played.level);assert.equal(s.session.moves,played.moves+1);assert.deepEqual(s.save.inventory,stock);assert.deepEqual(s.save.draft,initial.draft);
 await escape();await tap(480,890);assert.equal((await state()).modal,'pause-leave');await escape();assert.equal((await state()).modal,'pause');await tap(480,890);await tap(360,844);s=await state();assert.equal(s.screen,'home');assert.equal(s.session,null);assert.equal(s.save.energy,energy-1);assert.deepEqual(s.save.inventory,stock);
 // A spent final energy cannot restart or lose the paused board.
 await fixture({...initial,energy:1,energyAt:Date.now()});await startMatch();const final=(await state()).session;await escape();await tap(240,890);await tap(360,844);s=await state();assert.equal(s.modal,'pause-restart');assert.equal(s.save.energy,0);assert.deepEqual(s.session,final);await escape();await tap(360,770);assert.deepEqual((await state()).session,final);
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/pause/report.json',JSON.stringify({base,craftAndMatch:true,nativeSwitches:true,realMusicAndVolume:true,pausedInputBlocked:true,resumeExactBoard:true,confirmedRestartAndLeave:true,zeroEnergy:true,draftUndo:true,reloadPreferences:true,threeViewports:true,errors},null,2));
 console.log('Pause passed: reference overlay, native toggles, real music/switch/volume, blocked underlying input, exact board resume, confirmed restart/leave with correct energy/stock, undoable draft restart, zero energy, reload and three widths.');
} finally {await browser.close();}
