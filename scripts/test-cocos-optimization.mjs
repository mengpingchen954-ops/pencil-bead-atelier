import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/';
const dir=process.env.OPTIMIZATION_ARTIFACTS||'artifacts/optimization';
const key='pencil-bead-atelier-v1',errors=[],cases=[];
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
async function fixture(save,width=390){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key,save});
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const button=async name=>{
  const p=await page.evaluate(async name=>{
   const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const child of n.children){const result=find(child);if(result)return result;}return null;};
   const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing native button '+name);
   const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};
  },name);
  const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);
  const x=b.x+b.width/2+(p.x-360)*scale,y=b.y+b.height/2+(p.y-640)*scale;
  if(width===390)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 };
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 return {context,page,state,button,escape,ready};
}
async function tapNode(ui,name){
 const p=await native(ui.page,"const walk=n=>{if(!n.active)return null;if(n.name===arg)return n;for(const c of n.children){const f=walk(c);if(f)return f;}return null;};const n=walk(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+arg);const t=n.getComponent(cc.UITransform),v=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:v.x+360,y:640-v.y};",name);
 const b=await ui.page.locator('#GameCanvas').boundingBox(),k=Math.min(b.width/720,b.height/1280),x=b.x+b.width/2+(p.x-360)*k,y=b.y+b.height/2+(p.y-640)*k;
 if(ui.page.viewportSize().width===390)await ui.page.touchscreen.tap(x,y);else await ui.page.mouse.click(x,y);await ui.page.waitForTimeout(60);
}
async function native(page,fn,arg){return page.evaluate(async ({fn,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return Function('g','cc','arg',fn)(g,cc,arg);},{fn,arg});}
try{
 for(const width of [390,1440]){
  const ui=await fixture({...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0}},width);
  await ui.button('自由 DIY');assert.equal((await ui.state()).screen,'craft');await ui.button('返回小店');assert.equal((await ui.state()).screen,'home');
  await native(ui.page,"g.info('体力','每三分钟恢复一点。')");await ui.page.waitForTimeout(100);
  const compact=await native(ui.page,"return g.overlay.children.find(n=>n.name==='Dialog paper').getComponent(cc.UITransform).height");assert.ok(compact<400);
  await ui.page.screenshot({path:dir+'/compact-'+width+'.png'});await ui.button('×');
  await native(ui.page,'g.settings()');await ui.button('导出 / 导入存档');await ui.page.waitForTimeout(100);
  const labels=await native(ui.page,"return g.overlay.getComponentsInChildren(cc.Label).map(l=>l.string)");assert.equal(labels.includes('label'),false);
  await ui.page.screenshot({path:dir+'/export-'+width+'.png'});await ui.button('×');
  await native(ui.page,"g.navigate('album')");assert.equal(await ui.page.getByRole('button',{name:'后页 →',exact:true}).count(),0);
  cases.push({width,compact,noDefaultLabel:true,sourceReturn:true});await ui.context.close();
 }
 for(const width of [390,1440]){
  const ui=await fixture({...freshSave(),started:true,sound:false,reduced:true,completed:['daisy'],music:{enabled:false,track:'glimmer',volume:0}},width);
  await ui.button('参加比赛');await ui.button('报名参加');await ui.page.getByRole('button',{name:'参考配色',exact:true}).dispatchEvent('click');await ui.button('显示参考虚影');
  assert.ok((await ui.state()).save.competitions.draft.beads.every(t=>t===null));await ui.page.screenshot({path:dir+'/ghost-'+width+'.png'});
  for(let i=0;i<12;i++){await tapNode(ui,'Slot '+i);await tapNode(ui,'Bead material '+(i<8?3:5));}
  assert.equal((await ui.state()).save.competitions.draft.beads.filter(t=>t===3).length,8);await ui.page.screenshot({path:dir+'/predicted-'+width+'.png'});
  await ui.button('提交参赛作品');await ui.button('提交评审');const won=await ui.state();assert.equal(won.save.competitions.entries[0].score,83);assert.equal(won.save.competitions.entries[0].scoringVersion,2);assert.equal(won.save.coins,164);await ui.page.screenshot({path:dir+'/silver-'+width+'.png'});
  await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.equal((await ui.state()).save.coins,164);await ui.context.close();
  const game=await fixture({...freshSave(),started:true,sound:false,reduced:true,music:{enabled:false,track:'glimmer',volume:0}},width);
  await game.button('消除采珠');const start=await game.page.getByRole('button',{name:/^开始采珠/}).textContent();await game.button(start);await game.page.screenshot({path:dir+'/first-match-'+width+'.png'});
  assert.ok((await game.state()).session.board.length===64);await game.button('暂停');await game.button('继续游戏');assert.equal((await game.state()).modal,'');await game.context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({cases,errors},null,2));console.log('Optimization native controls and screenshots passed.');
}finally{await browser.close();}
