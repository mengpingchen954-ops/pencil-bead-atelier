import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,draftCounts} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8320/';
fs.mkdirSync('artifacts/delivery',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const draft=[...ORDERS[0].palette].reverse();
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},
  {...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:.35,track:'glimmer'},inventory:Array(6).fill(100),draft});
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const tap=async(x,y)=>{const box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/720,box.height/1280);await page.touchscreen.tap(box.x+box.width/2+(x-360)*scale,box.y+box.height/2+(y-640)*scale);};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 const deliveries=[];
 for(let index=0;index<6;index++){
  const order=ORDERS[index];await action('按单制作');
  if(index){await action('参考配色');await action('按参考排珠');}
  if(index===1){await action('听故事');await action('有什么让你担心的吗？');await action('把这份心意记住');}
  const before=(await state()).save;
  await action('包装交付  ·  '+order.reward+' 金币');
  if(index===1){await action('害怕的时候，也可以慢慢走。');await action('确认包装交付');}
  else await action('确认交付');
  let s=await state();assert.equal(s.screen,'delivery');assert.equal(s.modal,'');assert.equal(s.save.coins,before.coins+order.reward);assert.equal(s.save.rep,before.rep+order.rep);
  assert.deepEqual(s.delivery.work.beads,before.draft);assert.equal(s.delivery.order.id,order.id);
  assert.deepEqual(s.save.inventory,before.inventory.map((n,i)=>n-draftCounts(before.draft)[i]));assert.equal(s.save.collection.length,index+1);
  assert.equal(await page.getByRole('button',{name:'继续营业',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'确认交付',exact:true}).count(),0);
  await page.screenshot({path:'artifacts/delivery/order-'+order.id+'.png'});
  if(index===0){
   for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/delivery/receipt-${width}.png`});}
   await page.setViewportSize({width:540,height:960});
   const paid=s.save.coins,stock=s.save.inventory;
   for(let reload=0;reload<2;reload++){await page.reload({waitUntil:'networkidle'});await ready();s=await state();assert.equal(s.screen,'delivery');assert.equal(s.save.coins,paid);assert.deepEqual(s.save.inventory,stock);assert.deepEqual(s.delivery.work.beads,draft);}
   // Activate the real visible continuation button, not only its accessibility mirror.
   await tap(360,1202);
  }else await action('继续营业');
  s=await state();assert.equal(s.save.deliveryReceipt,null);assert.equal(s.save.coins,before.coins+order.reward);
  if(index===1){assert.equal(s.modal,'sea-response');assert.equal(s.save.collection[1].gift.blessing,'slow');await action('目送她出发');}
  assert.equal((await state()).modal,'story');await page.keyboard.press('Escape');
  assert.equal((await state()).screen,'home');deliveries.push({id:order.id,reward:order.reward,rep:order.rep});
 }
 const story=structuredClone((await state()).save.collection);
 await action('按单制作');await action('参考配色');await action('按参考排珠');const before=(await state()).save;
 await action('包装交付  ·  180 金币');await action('确认交付');let s=await state();
 assert.equal(s.screen,'delivery');assert.equal(s.delivery.repeat,true);assert.equal(s.delivery.order.name,'再送妈妈一朵花');assert.equal(s.delivery.number,1);assert.deepEqual(s.save.collection,story);
 assert.equal(s.save.coins,before.coins+180);await page.screenshot({path:'artifacts/delivery/repeat-receipt.png'});
 await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).delivery.repeat,true);
 await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');s=await state();assert.equal(s.screen,'home');assert.equal(s.modal,'');assert.equal(s.save.repeatOrders,1);assert.equal(s.save.deliveryReceipt,null);
 await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).screen,'home');assert.equal((await state()).save.coins,s.save.coins);
 fs.writeFileSync('artifacts/delivery/report.json',JSON.stringify({base,deliveries,repeat:true,errors},null,2));assert.deepEqual(errors,[]);
 console.log('Delivery UI passed: six exact works/rewards/unlocks, customized draft, persisted receipt without repeat payout, sea blessing response, returning order, real touch continuation, Escape and three widths.');
}finally{await browser.close();}
