import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {ORDERS,BEADS,CHARMS} from '../cocos/assets/scripts/content.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:5217/cocos-web/',dir=process.env.UI_ARTIFACTS||'artifacts/ui-redesign';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'}};
 await page.addInitScript(save=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*s,b.y+b.height/2+(y-640)*s);};
 const fixture=async save=>{await page.evaluate(s=>{window.name='qa-save:'+JSON.stringify(s);},save);await page.reload({waitUntil:'networkidle'});await ready();};
 const shot=async name=>{
  await page.waitForTimeout(120);
  const overflow=await page.evaluate(async()=>{const cc=await System.import('cc'),game=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return [game.page,game.overlay].flatMap(root=>root.getComponentsInChildren(cc.Sprite).filter(s=>s.node.name==='Painted surface').flatMap(s=>{const size=s.node.getComponent(cc.UITransform).contentSize,parent=s.node.parent.getComponent(cc.UITransform).contentSize;return Math.abs(size.width-parent.width)>.01||Math.abs(size.height-parent.height)>.01?[s.node.parent.name]:[];}));});
  assert.deepEqual(overflow,[],name+' painted controls must fit their native hit areas');
  await page.screenshot({path:dir+'/'+name+'.png'});
 };
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 for(const [width,height] of [[360,740],[390,844],[540,960],[1440,900]]){
  await page.setViewportSize({width,height});await fixture(initial);const before=(await state()).save;
  await shot('home-'+width);
  await tap(142,1043);assert.equal((await state()).screen,'storyMap');await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');
  await tap(620,953);assert.equal((await state()).modal,'story');await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');assert.deepEqual((await state()).save,before);
  await tap(205,857);assert.equal((await state()).screen,'orderArrival');await action('返回小店');
  await tap(216,1230);assert.equal((await state()).screen,'orders');await shot('orders-'+width);
  await tap(550,707);assert.equal((await state()).screen,'orders');assert.deepEqual((await state()).save,before);
  await tap(550,1063);assert.equal(await page.getByRole('button',{name:'← 前三份',exact:true}).count(),1);await shot('orders-next-'+width);
  await tap(170,1063);await tap(550,470);assert.equal((await state()).incomingOrder.id,'daisy');await action('返回小店');
  await tap(360,1043);assert.equal((await state()).screen,'journal');await shot('journal-'+width);
  await tap(591,1126);await tap(591,1126);await shot('journal-last-'+width);
  await tap(129,1126);await tap(129,1126);
  await action('小店');await tap(576,1043);assert.equal((await state()).screen,'contest');await shot('contest-'+width);
  await action('装修');assert.equal((await state()).screen,'decor');await shot('decor-'+width);
  assert.deepEqual((await state()).save,before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.setViewportSize({width:540,height:960});
 for(let count=1;count<ORDERS.length;count++){
  const order=ORDERS[count];await fixture({...initial,completed:ORDERS.slice(0,count).map(o=>o.id),orderId:order.id,coins:217,inventory:[17,19,23,29,31,37]});
  const saved=(await state()).save;await shot('home-current-'+count);await action('委托');await shot('orders-current-'+count);
  const labels=await page.locator('#atelier-accessibility').textContent();
  assert.ok(labels.includes(order.name));assert.ok(labels.includes(`珠 ${saved.inventory.reduce((a,b)=>a+b,0)}`));assert.ok(labels.includes('金 217'));
  assert.ok(labels.includes(`${BEADS[order.main].short} ≥${order.mainNeed} · ${BEADS[order.accent].short} ≥${order.accentNeed} · ${CHARMS[order.charm]}`));
  await tap(550,470+237*((count%3+1)%3));assert.equal((await state()).screen,'orders');assert.deepEqual((await state()).save,saved);
  if(count===1){await tap(270,663);assert.equal((await state()).modal,'sea-chat');await action('把这份心意记住');assert.deepEqual((await state()).save,saved);}
  await tap(550,470+237*(count%3));assert.equal((await state()).incomingOrder.id,order.id);assert.deepEqual((await state()).save,saved);
 }
 await fixture(initial);await action('委托');
 for(const [x,y] of [[335,42],[582,42],[668,42]]){await tap(x,y);assert.ok((await state()).modal);await shot('shared-dialog-'+x);await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');assert.equal((await state()).screen,'orders');}
 for(const [x,screen] of [[72,'home'],[360,'craft'],[504,'decor'],[648,'album']]){await tap(x,1220);assert.equal((await state()).screen,screen);if(screen==='craft')await action('返回委托');else if(screen==='album'){await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');await action('委托');}else await action('委托');}
 await tap(45,42);assert.equal((await state()).screen,'home');
 await fixture({...initial,inventory:[0,0,0,0,0,0]});await shot('home-shortage');
 await tap(507,857);assert.equal((await state()).modal,'intro');await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');
 const completed={...initial,completed:ORDERS.map(o=>o.id),orderId:'sea',repeatOrders:4,coins:222,inventory:Array(6).fill(100),seenStories:['opening']};
 await fixture(completed);const saved=(await state()).save;await shot('home-returning');
 await action('委托');await shot('orders-returning');
 const name=await page.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.textContent).find(s=>/^按单制作 /.test(s)));
 assert.ok(name);await action(name);
 assert.equal((await state()).screen,'orderArrival');assert.deepEqual((await state()).save,saved);
 await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual({...((await state()).save),energyAt:0},{...saved,energyAt:0});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(dir+'/report.json',JSON.stringify({base,widths:[360,390,540,1440],nativeHomeAndNavigation:true,pagination:true,returningCustomer:true,stockRoutes:true,savesPreserved:true,errors},null,2));
 console.log('UI passed: four viewports, all six live commissions, native active/disabled card buttons, pagination/header/navigation, sea story, shortages, returning orders and exact saved progress.');
}finally{await browser.close();}
