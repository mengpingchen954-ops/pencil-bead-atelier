import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave, newSession, move, useTool, activateSpecial, goalProgress, sessionRewards, total, normalizeSave} from '../cocos/assets/scripts/model.ts';
import {ORDERS, CLEAN_SPOTS} from '../cocos/assets/scripts/content.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8320/';
const browser=await chromium.launch({headless:true});
const errors=[],results=[];
fs.mkdirSync('artifacts/polish',{recursive:true});
const merit=s=>goalProgress(s).reduce((sum,g)=>sum+Math.min(g.current,g.target)/g.target,0)*100+s.specials.filter(Boolean).length*1.8+total(s.collected)*.005;
function bestAction(s,preferCreation=false){
 let best=null,score=-Infinity;
 const choose=(r,action)=>{if(!r.valid)return;const value=merit(r.session)+(r.session.status==='won'?10000:0)+(preferCreation?r.frames.reduce((n,f)=>n+f.created.length*30,0):0);if(value>score){score=value;best={...action,result:r};}};
 for(let i=0;i<64;i++){
  for(const j of [i+1,i+8])choose(move(s,i,j),{kind:'swap',a:i,b:j});
  if(s.specials[i])choose(activateSpecial(s,i),{kind:'special',a:i});
  if(s.moves<=4)for(const tool of ['hammer','bloom'])if(s.tools[tool])choose(useTool(s,tool,i),{kind:tool,a:i});
 }
 return best;
}
try{
 const context=await browser.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+JSON.stringify(m.location()));});page.on('requestfailed',r=>errors.push(r.url()+' '+JSON.stringify(r.failure())));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const fixture=(level,reduced=true)=>({...freshSave(),started:true,completed:['daisy'],orderId:'sea',inventory:Array(6).fill(50),level,reduced,sound:true,music:{track:'glimmer',volume:.35,enabled:false}});
 await page.addInitScript(save=>{
  if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}
  if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));
  const now=Date.now();Date.now=()=>Math.floor(now/1000000)*1000000+971;
 },fixture(1,false));
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const point=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return [b.x+b.width/2+(x-360)*s,b.y+b.height/2+(y-640)*s];};
 const tap=async(x,y)=>page.touchscreen.tap(...await point(x,y));
 const cell=async i=>tap(84+(i%8)*78,376+Math.floor(i/8)*78);
 const settled=()=>page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:30000});
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 await page.screenshot({path:'artifacts/polish/home.png'});
 assert.equal((await state()).save.completed.length,1);
 assert.equal(await page.getByRole('button',{name:'按单制作',exact:true}).count(),1);
 await tap(507,928);assert.equal((await state()).modal,'intro');
 await page.screenshot({path:'artifacts/polish/intro.png'});
 await action('再采一些备用');
 await page.screenshot({path:'artifacts/polish/match.png'});
 let s=await state();assert.equal(s.session.seed,971);assert.equal(s.session.moves,16);
 // An invalid real swipe returns to its starting cells and never spends a move.
 let invalid;
 for(let i=0;i<64&&!invalid;i++)for(const j of [i+1,i+8])if(j<64&&((j===i+8)||(i%8<7))&&!move(s.session,i,j).valid){invalid=[i,j];break;}
 assert.ok(invalid);const p1=await point(84+invalid[0]%8*78,376+Math.floor(invalid[0]/8)*78),p2=await point(84+invalid[1]%8*78,376+Math.floor(invalid[1]/8)*78);
 await page.mouse.move(...p1);await page.mouse.down();await page.mouse.move(...p2,{steps:5});await page.mouse.up();await settled();
 assert.deepEqual((await state()).session,s.session);await page.waitForTimeout(2900);
 const playAction=async choice=>{
  if(choice.kind==='swap'){
   // Swipe is essential when either endpoint is special, since tapping activates it.
   const a=await point(84+choice.a%8*78,376+Math.floor(choice.a/8)*78),b=await point(84+choice.b%8*78,376+Math.floor(choice.b/8)*78);
   await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(...b,{steps:4});await page.mouse.up();
  }else if(choice.kind==='special')await cell(choice.a);
  else {const snapshot=await state();await action((choice.kind==='hammer'?'小木槌':'花开十字')+' '+snapshot.session.tools[choice.kind]);await cell(choice.a);}
  await settled();const actual=(await state()).session;
  for(const key of ['board','specials','obstacles','cleared','collected','moves','status','score','tools'])assert.deepEqual(actual[key],choice.result.session[key],key+' follows pure rules');
 };
 let created=0,activated=0,chains=0,capturedSpecial=false;
 for(let turn=0;turn<40&&(await state()).session.status==='playing';turn++){
  const before=await state(),choice=bestAction(before.session,turn===0);assert.ok(choice);
  created+=choice.result.frames.reduce((n,f)=>n+f.created.length,0);activated+=choice.result.frames.reduce((n,f)=>n+f.activated.length,0);chains+=Math.max(0,choice.result.frames.length-1);
  await playAction(choice);
  if(!capturedSpecial&&(await state()).session.specials.some(Boolean)){capturedSpecial=true;await page.screenshot({path:'artifacts/polish/special-created.png'});}
 }
 s=await state();assert.equal(s.session.status,'won');assert.ok(created>0);assert.ok(activated>0);assert.ok(chains>0);
 await page.screenshot({path:'artifacts/polish/reward.png'});
 const stock=s.save.inventory.slice(),reward=sessionRewards(s.session,s.save),banked=s.session.banked||Array(6).fill(0);await action('收好珠材 · 回工坊');s=await state();
 assert.equal(s.screen,'craft');assert.equal(s.save.level,2);assert.deepEqual(s.save.inventory,stock.map((n,i)=>n+reward[i]-banked[i]));
 results.push({stage:1,created,activated,chains,earlyBanking:true});
 for(let level=2;level<=15;level++){
  await page.evaluate(save=>{window.name='qa-save:'+JSON.stringify(save);},fixture(level));await page.reload({waitUntil:'networkidle'});await ready();
  await action('消除采珠');let initial=await state();await action('再采一些备用');
  if([3,4,10,15].includes(level))await page.screenshot({path:'artifacts/polish/stage-'+level+'.png'});
  let turns=0;
  for(;turns<40&&(await state()).session.status==='playing';turns++){const choice=bestAction((await state()).session);assert.ok(choice);await playAction(choice);}
  const done=await state();assert.equal(done.session.status,'won','stage '+level);assert.ok(goalProgress(done.session).every(g=>g.done));
  assert.deepEqual(done.save.inventory,initial.save.inventory.map((n,i)=>n+(level<=3?done.session.collected[i]:0)),'early collection banks; later rewards wait for claim');
  results.push({stage:level,turns,goals:goalProgress(done.session)});
 }
 // Early losses retain actual collection through returning to craft and reloading.
 await page.evaluate(save=>{window.name='qa-save:'+JSON.stringify(save);},fixture(2));await page.reload({waitUntil:'networkidle'});await ready();
 await action('消除采珠');await action('再采一些备用');
 const earlyStock=(await state()).save.inventory.slice();
 for(let turns=0;turns<30&&(await state()).session.status==='playing';turns++){
  const before=(await state()).session;let worst=null,score=Infinity;
  for(let i=0;i<64;i++)for(const j of [i+1,i+8]){const r=move(before,i,j);if(r.valid&&merit(r.session)<score){score=merit(r.session);worst={kind:'swap',a:i,b:j,result:r};}}
  assert.ok(worst);await playAction(worst);
 }
 s=await state();assert.equal(s.session.status,'lost');assert.ok(total(s.session.collected)>0);
 const retained=earlyStock.map((n,i)=>n+s.session.collected[i]);assert.deepEqual(s.save.inventory,retained);
 await page.screenshot({path:'artifacts/polish/early-loss.png'});await action('带着珠材回制作');assert.equal((await state()).screen,'craft');assert.deepEqual((await state()).save.inventory,retained);
 await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.inventory,retained);results.push({earlyLossRetained:true,reloadNoDoubleAward:true});
 // Later losses grant no materials. Retrying spends exactly one more energy; pause retains the board.
 await page.evaluate(save=>{window.name='qa-save:'+JSON.stringify(save);},fixture(15));await page.reload({waitUntil:'networkidle'});await ready();
 await action('消除采珠');await action('再采一些备用');
 for(let turns=0;turns<30&&(await state()).session.status==='playing';turns++){
  const before=(await state()).session;let worst=null,score=Infinity;
  for(let i=0;i<64;i++)for(const j of [i+1,i+8]){const r=move(before,i,j);if(r.valid&&merit(r.session)<score){score=merit(r.session);worst={kind:'swap',a:i,b:j,result:r};}}
  assert.ok(worst);await playAction(worst);
 }
 s=await state();assert.equal(s.session.status,'lost');const lossStock=s.save.inventory.slice(),energy=s.save.energy;
 await page.screenshot({path:'artifacts/polish/loss.png'});await action('重新采珠 · 1 体力');s=await state();assert.equal(s.save.energy,energy-1);assert.deepEqual(s.save.inventory,lossStock);
 const pausedBoard=s.session.board.slice();await action('暂停');assert.equal((await state()).modal,'pause');await action('继续游戏');assert.deepEqual((await state()).session.board,pausedBoard);
 await action('暂停');await action('返回店铺');await action('确认返回店铺');assert.equal((await state()).screen,'home');
 // Renovation uses real earned-budget rules; test fixture only establishes a clean room.
 const renovation={...fixture(5,false),coins:500,renovation:{cleared:CLEAN_SPOTS.map(s=>s.id),repairs:{wall:false,floor:false,window:false}}};
 await page.evaluate(save=>{window.name='qa-save:'+JSON.stringify(save);},renovation);await page.reload({waitUntil:'networkidle'});await ready();await action('装修');
 await page.screenshot({path:'artifacts/polish/room-before.png'});
 const repairName=await page.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.textContent||n.getAttribute('aria-label')).find(n=>n?.includes('窗')&&n?.includes('金')));
 assert.ok(repairName);await action(repairName);assert.equal((await state()).busy,true);await settled();
 s=await state();assert.equal(s.modal,'renovation');assert.equal(s.save.renovation.repairs.window,true);assert.ok(s.save.coins<500);
 await page.screenshot({path:'artifacts/polish/grandmother-response.png'});await action('看看我们的新角落');await page.screenshot({path:'artifacts/polish/room-after.png'});
 const coins=s.save.coins;await page.reload({waitUntil:'networkidle'});await ready();s=await state();assert.equal(s.save.coins,coins);assert.equal(s.save.renovation.repairs.window,true);
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/polish/layout-${width}.png`});}
 fs.writeFileSync('artifacts/polish/report.json',JSON.stringify({base,results,errors},null,2));assert.deepEqual(errors,[]);
 console.log('Cocos polish passed: 15 stages through real gestures, special creation/activation/chains, invalid return, rule/render agreement, early banking and later rewards, renovation reveal, persistence and three viewports.');
}finally{await browser.close();}
