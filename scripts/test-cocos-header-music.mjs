import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {MUSIC_TRACKS} from '../cocos/assets/scripts/music-settings.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/',dir=process.env.MUSIC_ARTIFACTS||'artifacts/header-music';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,completed:['daisy'],orderId:'sea',sound:false,coins:1342,inventory:[200,200,200,200,200,218],music:{enabled:false,track:'glimmer',volume:.35}};
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const point=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
 const tap=async(x=674,y=42)=>{const p=await point(x,y);await page.touchscreen.tap(p.x,p.y);};
 const double=async()=>{await tap();await page.waitForTimeout(80);await tap();await page.waitForTimeout(400);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 const next=id=>MUSIC_TRACKS[(MUSIC_TRACKS.findIndex(t=>t.id===id)+1)%MUSIC_TRACKS.length].id;
 const audioReady=()=>page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).music.playing,{},{timeout:20000});
 const withoutMusic=s=>({...s,music:null,energyAt:0});
 await page.goto(base,{waitUntil:'networkidle'});await ready();const saved=(await state()).save;
 for(const [width,height] of [[360,740],[390,844],[540,960],[1440,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(180);
  const track=(await state()).save.music.track;await tap();await page.waitForTimeout(420);
  assert.equal((await state()).save.music.track,next(track));await audioReady();
  const selected=(await state()).save.music.track;await double();assert.equal((await state()).modal,'music');assert.equal((await state()).save.music.track,selected,'Double tap must not switch track');
  await tap(455,834);assert.equal((await state()).save.music.volume,.75);assert.equal((await state()).music.volume,.75);await escape();
  await page.screenshot({path:dir+'/home-'+width+'.png'});
  const labels=await page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return g.page.children.filter(n=>n.position.y>-84).flatMap(n=>n.getComponentsInChildren(cc.Label).map(l=>l.string));});
  assert.ok(labels.includes('1218'));assert.ok(labels.includes('1342'));assert.ok(!labels.includes('珠 1218')&&!labels.includes('金 1342'));
  assert.deepEqual(withoutMusic((await state()).save),withoutMusic(saved));
 }
 await page.setViewportSize({width:540,height:960});await page.waitForTimeout(180);
 for(let i=0;i<MUSIC_TRACKS.length;i++){const t=(await state()).save.music.track;await tap();await page.waitForTimeout(420);assert.equal((await state()).save.music.track,next(t));await audioReady();}
 for(const source of ['委托','装修','手账','参加比赛']){
  await action('小店');await action(source);const t=(await state()).save.music.track;await tap();await page.waitForTimeout(420);assert.equal((await state()).save.music.track,next(t));
  await double();assert.equal((await state()).modal,'music');await escape();await page.screenshot({path:dir+'/page-'+(await state()).screen+'.png'});
 }
 await action('小店');let t=(await state()).save.music.track;await tap();await tap(607,42);await page.waitForTimeout(450);assert.equal((await state()).modal,'settings');assert.equal((await state()).save.music.track,t);await escape();
 await tap();await action('委托');await page.waitForTimeout(450);assert.equal((await state()).save.music.track,t,'Leaving must cancel a pending single tap');
 // A mouse double-click follows the same native touch gesture path.
 const p=await point(674,42);await page.mouse.dblclick(p.x,p.y,{delay:80});await page.waitForTimeout(420);assert.equal((await state()).modal,'music');assert.equal((await state()).save.music.track,t);
 await page.screenshot({path:dir+'/volume.png'});await action('−');assert.equal((await state()).save.music.volume,.65);await action('+');assert.equal((await state()).save.music.volume,.75);
 const slider=page.getByRole('slider',{name:'背景音乐音量'});await slider.fill('0');await slider.dispatchEvent('input');assert.equal((await state()).music.playing,false);
 await slider.fill('100');await slider.dispatchEvent('input');await audioReady();assert.equal((await state()).save.music.volume,1);await escape();
 const persisted=(await state()).save;await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.music,persisted.music);assert.deepEqual(withoutMusic((await state()).save),withoutMusic(saved));
 await action('调整背景音乐音量');assert.equal((await state()).modal,'music');await escape();t=(await state()).save.music.track;await action('下一首背景音乐');assert.equal((await state()).save.music.track,next(t));await audioReady();
 await action('消除采珠');await action('再采一些备用');assert.equal((await state()).screen,'match');const session=(await state()).session;
 await double();assert.equal((await state()).modal,'music');await page.waitForTimeout(500);assert.deepEqual((await state()).session,session);await escape();assert.equal((await state()).screen,'match');
 await page.screenshot({path:dir+'/match.png'});assert.deepEqual(errors,[]);
 fs.writeFileSync(dir+'/report.json',JSON.stringify({base,singleTapNext:true,doubleTapVolumeWithoutSwitch:true,allSixSongsPlay:true,volumeZeroToFull:true,mouseDoubleClick:true,sixSharedHeaders:true,cancelPendingOnLeaveOrModal:true,semanticControls:true,savedPreferences:true,progressUnchanged:true,matchPreserved:true,widths:[360,390,540,1440],errors},null,2));
 console.log('Header music passed: numeric resource labels, native single/double taps and mouse double-click, all six songs play, volume 0–100%, shared headers, cancellation, accessible controls, reload, exact progress and paused match, four widths.');
}finally{await browser.close();}
