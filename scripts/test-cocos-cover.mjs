import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/';
const dir=process.env.COVER_ARTIFACTS||'artifacts/cover';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const [width,height] of [[360,800],[390,844],[540,960],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},{...freshSave(),sound:false,music:{enabled:false,volume:.35,track:'glimmer'}});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  assert.equal((await state()).screen,'cover');
  const art=await page.evaluate(async()=>{const cc=await System.import('cc'),game=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame'),node=game.page.getChildByName('pencil-cover'),s=node.getComponent(cc.Sprite),t=node.getComponent(cc.UITransform);return {width:t.width,height:t.height,x:node.position.x,y:node.position.y,source:[s.spriteFrame.originalSize.width,s.spriteFrame.originalSize.height]};});
  assert.deepEqual(art.source,[1140,2040]);assert.ok(Math.abs(art.width/art.height-19/34)<.00001);assert.equal(art.height,1280);assert.ok(art.x>=0&&art.x+art.width<=720.01);
  await page.screenshot({path:`${dir}/cover-${width}.png`});
  const before=(await state()).save,b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);
  await page.touchscreen.tap(b.x+b.width/2+(360-360)*scale,b.y+b.height/2+(1084-640)*scale);
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).modal==='first-order');
  const after=(await state()).save;assert.equal(after.started,true);assert.deepEqual(after.inventory,before.inventory);assert.deepEqual(after.completed,before.completed);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  assert.equal((await state()).screen,'home');assert.equal((await state()).save.started,true);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Cover: complete art, four viewports, native painted-button taps, first order, saved progress and reload passed.');
} finally {await browser.close();}
