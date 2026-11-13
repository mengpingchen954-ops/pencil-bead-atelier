import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,findMove} from '../cocos/assets/scripts/model.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/';
const dir=process.env.UI_ARTIFACTS||'artifacts/ui-cleanup';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],results=[];
try{
 for(const width of [390,540,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:960},hasTouch:true,isMobile:width<1000});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const initial={...freshSave(),started:true,level:19,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},
   firstSteps:{firstGather:1,craft:1},inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true),
   draft:[7,30,6,13,39,24,15,41,0,16,29,26,8],draftSizes:Array(13).fill(8)};
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
  const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
  const action=async name=>{await page.getByRole('button',{name,exact:true}).dispatchEvent('click');await page.waitForTimeout(150);};
  const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);await page.waitForTimeout(180);};
  const nativeButton=async name=>{
   const p=await page.evaluate(async name=>{
    const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
    const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name||n.name==='Navigate '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};
    const n=find(g.modal?g.overlay:g.page);assertNode(n);
    function assertNode(n){if(!n)throw Error('Missing native control '+name);}
    const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};
   },name);await tap(p.x,p.y);
  };
  const screenshot=async name=>page.screenshot({path:`${dir}/${name}-${width}.png`});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  assert.equal((await state()).screen,'home');await screenshot('home');
  for(const name of ['查看售珠橱窗','作品展示','自由 DIY','消除采珠','故事与手账','顾客定制','参加比赛','每日签到'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1,name);
  await nativeButton('orders');assert.equal((await state()).screen,'orders');await screenshot('orders');
  await nativeButton('album');assert.equal((await state()).screen,'album');await screenshot('album');
  await nativeButton('decor');assert.equal((await state()).screen,'decor');await screenshot('decor');
  await nativeButton('home');await nativeButton('自由 DIY');let s=await state();assert.equal(s.screen,'craft');
  const radii=s.crafting.slots.map(p=>Math.hypot(p.x-360,p.y-410));assert.ok(radii.every(r=>Math.abs(r-150)<.01));
  assert.deepEqual(s.save.draft,initial.draft);assert.deepEqual(s.save.draftSizes,initial.draftSizes);await screenshot('craft');
  await nativeButton('菜单');assert.equal((await state()).modal,'pause');await screenshot('pause');
  const singleSurface=await page.evaluate(async()=>{
   const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   const stage=g.overlay.children.find(n=>n.name==='Pause menu');
   return stage.children.filter(n=>['Button: 清空本件','Button: 返回店铺','Button: 切歌 / 音量'].includes(n.name)).every(n=>n.getComponentsInChildren(cc.Sprite).length===1&&n.getComponent(cc.Graphics).impl.paths.length===0);
  });assert.equal(singleSurface,true);
  await nativeButton('继续游戏');assert.equal((await state()).modal,'');assert.deepEqual((await state()).save.draft,initial.draft);
  await nativeButton('返回小店');await nativeButton('消除采珠');
  await nativeButton(await page.getByRole('button',{name:/^开始采珠 · /}).textContent());
  s=await state();assert.equal(s.screen,'match');assert.ok(!s.session.obstacles.includes('thread'));assert.ok(s.session.objectives.every(g=>g.kind!=='thread'));
  const cleanCells=await page.evaluate(async()=>{
   const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   return g.boardNodes.length===64&&g.boardNodes.every(n=>!n.getComponent(cc.Graphics)&&!n.children.some(c=>['Material marker','Bead grounding'].includes(c.name)));
  });assert.equal(cleanCells,true);await screenshot('match');
  const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);
  for(const i of pair)await tap(48+i%8*78+36,340+Math.floor(i/8)*78+36);
  await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy);
  assert.equal((await state()).session.moves,s.session.moves-1);
  await nativeButton('暂停');await screenshot('match-pause');await nativeButton('继续游戏');
  assert.equal((await state()).modal,'');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  assert.deepEqual((await state()).save.draft,initial.draft);
  results.push({width,nativeNavigation:true,compactBracelet:true,singleButtonSurface:true,plainBeads:true,legalSwap:true,savedDraft:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results,errors},null,2));
 console.log('Reference UI passed at 390, 540 and 1440px: native navigation, compact bracelet, single button surfaces, plain match beads, swaps and saved drafts.');
}finally{await browser.close();}
