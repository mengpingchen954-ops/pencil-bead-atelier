import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,move,activateSpecial,goalProgress,draftCounts,total} from '../cocos/assets/scripts/model.ts';
import {ORDERS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/',dir='artifacts/first-session';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),sound:false,music:{enabled:false,volume:.35,track:'glimmer'}};
 await page.addInitScript(s=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(s));},initial);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const point=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*scale,y:b.y+b.height/2+(y-640)*scale};};
 const tap=async(x,y)=>{const p=await point(x,y);await page.touchscreen.tap(p.x,p.y);};
 const groove=async i=>{const p=(await state()).crafting.slots[i];await tap(p.x,p.y);};
 const material=async i=>{const p=(await state()).crafting.materials[i];await tap(p.x,p.y);};
 const addAt=async(type,index)=>{
  const selected=(await state()).slot;if(selected>=0)await groove(selected);
  const before=(await state()).save.draft.slice();await material(type);let s=await state();
  const from=s.save.draft.findIndex((n,i)=>n!==before[i]);assert.ok(from>=0);
  await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).crafting.flights.length);
  if(from!==index){const a=await point(s.crafting.slots[from].x,s.crafting.slots[from].y),b=await point(s.crafting.slots[index].x,s.crafting.slots[index].y);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();}
 };
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('打开小店  →');assert.equal((await state()).modal,'first-order');
 await page.screenshot({path:dir+'/one-line-order.png'});await tap(528,1085);let s=await state();assert.equal(s.screen,'craft');assert.ok(s.save.firstSteps.craft);assert.equal(s.save.level,1);
 const initialStock=s.save.inventory,energy=s.save.energy;assert.ok(initialStock[0]>=8&&initialStock[3]>=3);
 await page.screenshot({path:dir+'/large-workshop.png'});
 await addAt(0,0);await addAt(3,1);assert.equal((await state()).save.draft[1],3);
 // Existing bead selection is non-destructive; replacement and removal are explicit.
 await material(4);await action('撤销');await groove(0);await tap(374,1092);assert.equal((await state()).save.draft[0],4);await action('撤销');assert.equal((await state()).save.draft[0],0);
 await groove(0);await action('移除');assert.equal((await state()).save.draft[0],null);await action('撤销');assert.equal((await state()).save.draft[0],0);
 for(let i=2;i<12;i++){await addAt(ORDERS[0].palette[i],i);assert.equal((await state()).busy,false);}
 s=await state();assert.deepEqual(s.save.draft,ORDERS[0].palette);assert.deepEqual(s.save.inventory,initialStock);assert.equal(s.save.energy,energy);
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.waitForTimeout(360);await page.screenshot({path:dir+`/workshop-${width}.png`});await groove(0);assert.equal((await state()).slot,0);await page.waitForTimeout(360);await groove(0);}
 await page.setViewportSize({width:540,height:960});await page.waitForTimeout(160);await action('完成制作');assert.equal((await state()).modal,'first-finished');await page.screenshot({path:dir+'/first-closeup.png'});
 await action('装进礼盒');assert.equal((await state()).screen,'packing');await action('完成包装');s=await state();assert.equal(s.screen,'delivery');assert.deepEqual(s.delivery.work.beads,ORDERS[0].palette);assert.ok(s.save.firstSteps.firstDelivery);assert.equal(s.save.level,1);assert.equal(s.save.energy,energy);
 await action('继续营业');assert.equal((await state()).modal,'first-feedback');await page.screenshot({path:dir+'/customer-feedback.png'});await action('记录');await action('返回对话');assert.equal((await state()).modal,'first-feedback');await action('领取下一份委托');s=await state();assert.equal(s.screen,'orderArrival');assert.equal(s.incomingOrder.id,'sea');assert.ok(s.save.firstSteps.secondOrder);
 await action('开始制作');await action('采珠');s=await state();assert.equal(s.modal,'intro');assert.ok((await page.locator('#atelier-accessibility').textContent()).includes('蓝晶 6'));
 await page.getByRole('button',{name:/^开始采珠/}).dispatchEvent('click');s=await state();assert.equal(s.screen,'match');assert.equal(s.session.supplyOnly,true);assert.equal(s.goals.some(g=>g.target===66),false);assert.ok(s.save.firstSteps.firstGather);assert.equal(s.save.energy,energy-1);
 await page.screenshot({path:dir+'/commission-supply-goals.png'});const miningStock=s.save.inventory;
 const merit=session=>goalProgress(session).reduce((n,g)=>n+Math.min(g.current,g.target)/g.target,0)*100+(session.status==='won'?10000:0)+total(session.collected)*.001;
 for(let guard=0;guard<20&&(await state()).modal!=='result';guard++){
   s=await state();let best=null,score=-Infinity;
   for(let i=0;i<64;i++){
     for(const j of [i+1,i+8]){const result=move(s.session,i,j);if(result.valid&&merit(result.session)>score){score=merit(result.session);best=[i,j];}}
     if(s.session.specials[i]){const result=activateSpecial(s.session,i);if(result.valid&&merit(result.session)>score){score=merit(result.session);best=[i];}}
   }
   assert.ok(best);for(const i of best)await tap(84+(i%8)*78,376+Math.floor(i/8)*78);
   await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy);s=await state();
   assert.deepEqual(s.save.inventory,miningStock.map((n,i)=>n+Math.floor((s.session.collected[s.session.materialTypes.indexOf(i)]||0)/10)));
 }
 s=await state();assert.equal(s.modal,'result');assert.equal(s.session.status,'won');await page.screenshot({path:dir+'/gathered-for-order.png'});
 const earned=s.save.inventory;await action('收好珠材 · 回工坊');s=await state();assert.equal(s.screen,'craft');assert.deepEqual(s.save.inventory,earned);
 // A reload retains all earned stock, starter-kit marker and real draft.
 await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.inventory,earned);await action('按单制作');await action('开始制作');
 const recipe=[...Array(6).fill(2),...Array(3).fill(0)],counts=draftCounts(recipe);
 while(recipe.length<12){const type=earned.findIndex((n,i)=>n>counts[i]);assert.ok(type>=0);recipe.push(type);counts[type]++;}
 for(let i=0;i<12;i++)await addAt(recipe[i],i);await action('月牙');await action('完成制作');assert.equal((await state()).screen,'packing');await action('完成包装');s=await state();assert.equal(s.save.completed.length,2);assert.ok(s.save.firstSteps.secondDelivery);assert.deepEqual(s.delivery.work.beads,recipe);
 await action('继续营业');await action('目送她出发');await escape();await action('图鉴');await action('欣赏给奶奶的一朵花');assert.deepEqual((await state()).collectionDetail.work.beads,ORDERS[0].palette);
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,freeFirstCommission:true,shortOpening:true,randomMaterialLaunchAndRearrangement:true,nativeReplaceRemoveUndo:true,continuousPlacement:true,firstCloseupAndFeedback:true,noMiningBeforeFirstDelivery:true,exactSupplyTargets:true,earlyCollectionSaved:true,noDoubleClaim:true,secondDelivery:true,realCollection:true,threeWidths:true,firstSteps:s.save.firstSteps,errors},null,2));
 console.log('First-session loop passed: free first order, one-line opening, large workshop, native placement/replace/remove/undo, closeup/packing/feedback, exact supply goals and saved collection, second delivery and milestones.');
}finally{await browser.close();}
