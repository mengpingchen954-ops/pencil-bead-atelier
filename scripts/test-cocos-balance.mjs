import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,gatheredMaterials,findMove,total} from '../cocos/assets/scripts/model.ts';
import {finishWork,priceBounds,suggestedPrice,saleDuration} from '../cocos/assets/scripts/commerce.ts';
import {CLEAN_SPOTS,REPAIRS,ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/';
const dir=process.env.BALANCE_ARTIFACTS||'artifacts/balance-browser',errors=[],cases=[];
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true});
const defaults=()=>({...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,track:'glimmer',volume:0}});
async function fixture(save,width=390){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(s=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},save);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const game=async(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return new Function('g','arg','return ('+source+')(g,arg)')(g,arg);},{source:fn.toString(),arg});
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);const p={x:b.x+b.width/2+(x-360)*scale,y:b.y+b.height/2+(y-640)*scale};if(width===390)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);};
 const button=async name=>{
  if(['参考配色','评分规则'].includes(name)&&await page.getByRole('button',{name:'工具',exact:true}).count())await button('工具');
  const p=await page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};
   const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name+' on '+g.screen+'/'+g.modal);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};},name);
  await tap(p.x,p.y);await page.waitForTimeout(50);
 };
 await page.goto(base,{waitUntil:'networkidle'});await ready();return {page,context,state,game,tap,button,ready};
}
try{
 for(const width of [390,1440]){
  for(const rep of [0,300]){
   const save=finishWork({...defaults(),rep,draft:Array(5).fill(0),inventory:Array(48).fill(10),gatheredStock:Array(48).fill(10)},Date.now()-1000);
   const ui=await fixture(save,width),beads=save.commerce.works[0].beads,max=priceBounds(beads,rep).max;
   await ui.tap(360,720);await ui.button('上架橱窗 · 1');
   for(let price=suggestedPrice(beads);price<max;price+=10)await ui.button('加价 10');
   await ui.page.screenshot({path:`${dir}/price-${rep}-${width}.png`});await ui.button('确认上架');
   const work=(await ui.state()).save.commerce.works[0];assert.equal(work.price,max);assert.equal(work.sellAt-work.listedAt,saleDuration(beads,max));
   await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.equal((await ui.state()).save.commerce.works[0].sellAt,work.sellAt);
   cases.push({width,rep,price:max,duration:work.sellAt-work.listedAt});await ui.context.close();
  }
  const full={...defaults(),coins:2100,upgrades:{chair:2,display:2,desk:2},renovation:{cleared:CLEAN_SPOTS.map(s=>s.id),repairs:Object.fromEntries(REPAIRS.map(r=>[r.id,true]))}};
  const ui=await fixture(full,width);await ui.tap(504,1210);await ui.page.screenshot({path:`${dir}/furniture-before-${width}.png`});
  for(const price of [600,700,800]){await ui.button('升级 '+price+' 金');assert.equal((await ui.state()).modal,'renovation');await ui.button('看看我们的新角落');}
  let s=await ui.state();assert.equal(s.save.coins,0);assert.deepEqual(s.save.upgrades,{chair:3,display:3,desk:3});
  assert.equal(await ui.game(g=>g.page.children.filter(n=>['Cabinet gilded trim','Desk lamp shade','Chair embroidered cushion'].includes(n.name)).length),3);
  await ui.page.screenshot({path:`${dir}/furniture-after-${width}.png`});await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.deepEqual((await ui.state()).save.upgrades,s.save.upgrades);await ui.context.close();
 }
 const listedAt=Date.now(),beads=Array(5).fill(0),price=135;
 const old=finishWork({...defaults(),draft:beads,inventory:Array(48).fill(10),gatheredStock:Array(48).fill(10)},listedAt-1000);
 const listing={...old.commerce.works[0],status:'listing',price,listedAt,sellAt:listedAt+45000};
 const legacy=await fixture({...old,commerce:{nextId:2,works:[listing]}});
 assert.deepEqual((await legacy.state()).save.commerce.works,[listing]);await legacy.page.reload({waitUntil:'networkidle'});await legacy.ready();assert.deepEqual((await legacy.state()).save.commerce.works,[listing]);await legacy.context.close();
 for(const [level,status]of [[6,'won'],[15,'lost']]){
  const ui=await fixture({...defaults(),level,energy:5,energyAt:Date.now()});
  const clock=Date.now()-120000;await ui.game((g,clock)=>{g.save.energyAt=clock;},clock);
  await ui.button('消除采珠');const label=await ui.page.getByRole('button',{name:/^开始采珠 · /}).textContent();await ui.button(label);
  let s=await ui.state();assert.equal(s.save.energy,4);assert.equal(s.save.energyAt,clock);assert.deepEqual(s.session.tools,level===6?{hammer:2,shuffle:2,bloom:2}:{hammer:3,shuffle:2,bloom:2});
  await ui.game((g,status)=>{g.session.moves=1;g.session.target=status==='won'?1:100000;g.session.objectives=[{kind:'total',target:g.session.target}];g.render();},status);
  s=await ui.state();const pair=findMove(s.session.board,s.session.specials);for(const i of pair)await ui.tap(84+i%8*78,376+Math.floor(i/8)*78);
  await ui.page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return !s.busy&&s.modal==='result';});s=await ui.state();assert.equal(s.session.status,status);
  const reward=gatheredMaterials(s.session),expected=Array(48).fill(0);reward.forEach((n,i)=>expected[s.session.materialTypes[i]]=n);assert.deepEqual(s.save.inventory,expected);
  assert.ok(status==='won'?[15,16].includes(total(reward)):[10].includes(total(reward)));
  await ui.page.screenshot({path:`${dir}/reward-${status}.png`});await ui.button(status==='won'?'去串手串':'带着珠材回制作');
  assert.deepEqual((await ui.state()).save.inventory,expected);await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.deepEqual((await ui.state()).save.inventory,expected);await ui.context.close();
 }
 const contest=await fixture({...defaults(),completed:[ORDERS[0].id]});await contest.button('参加比赛');await contest.button('报名参加');await contest.button('参考配色');await contest.button('显示参考虚影');
 for(let i=0;i<12;i++)for(const name of ['Slot '+i,'Bead material '+(i<8?3:5)]){
  const point=await contest.page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');const walk=n=>{if(!n.active)return null;if(n.name===name)return n;for(const c of n.children){const f=walk(c);if(f)return f;}return null;};const n=walk(g.page);if(!n)throw Error(name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return{x:p.x+360,y:640-p.y};},name);await contest.tap(point.x,point.y);
 }
 await contest.button('提交参赛作品');await contest.button('提交评审');
 const awarded=await contest.state();assert.equal(awarded.save.competitions.entries[0].score,83);assert.equal(awarded.save.coins,164);await contest.page.screenshot({path:dir+'/silver-contest.png'});
 await contest.page.reload({waitUntil:'networkidle'});await contest.ready();assert.equal((await contest.state()).save.coins,164);assert.equal((await contest.state()).save.competitions.entries[0].reward,84);await contest.context.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,cases,legacyListingPreserved:true,thirdFurnitureTiers:true,actualRewardBanking:true,energyClockPreserved:true,silverReferenceAndNoDoubleAward:true,errors},null,2));console.log('Balance browser passed: reputation pricing, cubic waits, old listing, level win/loss rewards, tools, energy clock, third furniture tiers and silver reference with persistent one-time rewards.');
}finally{await browser.close();}
