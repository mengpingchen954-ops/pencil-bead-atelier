import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8321/',dir='artifacts/cocos-launch';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:540,height:960},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,inventory:Array(6).fill(30),sound:false,music:{enabled:false,volume:.35,track:'glimmer'}};
 await page.addInitScript(save=>{if(window.name.startsWith('qa-save:')){localStorage.setItem('pencil-bead-atelier-v1',window.name.slice(8));window.name='';}if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const action=async name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const point=async p=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(p.x-360)*s,y:b.y+b.height/2+(p.y-640)*s};};
 const tap=async p=>{const q=await point(p);await page.touchscreen.tap(q.x,q.y);};
 const material=async i=>tap((await state()).crafting.materials[i]);
 const idle=()=>page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).crafting.flights.length);
 const drag=async(from,to)=>{const slots=(await state()).crafting.slots,a=await point(slots[from]),b=await point(slots[to]);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();};
 await page.goto(base,{waitUntil:'networkidle'});await ready();await action('按单制作');await action('开始制作');
 await page.evaluate(()=>{window.launchSamples=[];window.sampleLaunch=true;const sample=()=>{if(!window.sampleLaunch)return;const s=JSON.parse(window.render_game_to_text());window.launchSamples.push(...s.crafting.flights);requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await material(0);let s=await state();const first=s.save.draft.findIndex(n=>n===0);assert.ok(first>=0);assert.equal(s.crafting.flights.length,1);assert.equal(s.busy,false);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).crafting.flights.some(f=>Math.hypot(f.x-360,f.y-532)<22));
 await page.screenshot({path:dir+'/center.png'});
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).crafting.flights.some(f=>Math.hypot(f.x-360,f.y-532)>80&&Math.hypot(f.x-360,f.y-532)<215));
 s=await state();assert.equal(s.crafting.flights[0].angle,0);await page.screenshot({path:dir+'/outward-bounce.png'});await idle();
 // Re-rendering for later material taps must preserve all earlier flights.
 for(let type=1;type<=5;type++)await material(type);
 s=await state();assert.equal(s.save.draft.filter(n=>n!==null).length,6);assert.ok(s.crafting.flights.length>=2);assert.equal(new Set(s.crafting.flights.map(f=>f.index)).size,s.crafting.flights.length);assert.deepEqual(s.save.inventory,initial.inventory);
 await page.screenshot({path:dir+'/continuous.png'});await idle();s=await state();const empty=s.save.draft.findIndex(n=>n===null);
 const samples=await page.evaluate(()=>{window.sampleLaunch=false;return window.launchSamples;});
 assert.ok(samples.length>15);assert.ok(samples.every(f=>f.angle===0),'every sampled bead keeps its original orientation');
 assert.ok(samples.some(f=>Math.hypot(f.x-360,f.y-532)<3),'bead reaches the center before its outward bounce');
 const firstSamples=samples.filter(f=>f.index===first),centerFrame=firstSamples.findIndex(f=>Math.hypot(f.x-360,f.y-532)<3);
 const radii=firstSamples.slice(centerFrame).map(f=>Math.hypot(f.x-360,f.y-532)),peak=radii.indexOf(Math.max(...radii));
 assert.ok(radii[peak]>248&&radii[peak]<261,'spring visibly overshoots the wire by a bounded amount');
 assert.ok(radii.slice(peak).some(r=>r<227),'bead rebounds inside the wire before settling');
 // Another bead landing must not destroy a drag already in progress.
 await material(2);s=await state();const drop=s.save.draft.findIndex(n=>n===null),a=await point(s.crafting.slots[first]),b=await point(s.crafting.slots[drop]);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.waitForTimeout(1000);await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();assert.equal((await state()).save.draft[drop],0);await action('撤销');await action('撤销');
 await drag(first,empty);assert.equal((await state()).save.draft[empty],0);assert.equal((await state()).save.draft[first],null);await action('撤销');assert.equal((await state()).save.draft[first],0);
 s=await state();const second=s.save.draft.findIndex(n=>n===1);await drag(first,second);assert.equal((await state()).save.draft[first],1);assert.equal((await state()).save.draft[second],0);await action('撤销');
 await tap((await state()).crafting.slots[first]);await action('移除');assert.equal((await state()).save.draft[first],null);await action('撤销');assert.equal((await state()).save.draft[first],0);
 const draft=(await state()).save.draft.slice();await material(2);await action('撤销');await idle();assert.deepEqual((await state()).save.draft,draft);
 // Selecting an occupied groove never changes the random-add behavior.
 await tap((await state()).crafting.slots[first]);for(let i=0;i<6;i++)await material(i);
 s=await state();assert.equal(s.save.draft.filter(n=>n!==null).length,12);const full=s.save.draft.slice();await material(3);assert.deepEqual((await state()).save.draft,full);await idle();
 await tap((await state()).crafting.slots[first]);await action('替换');assert.equal((await state()).save.draft[first],3);await action('撤销');await idle();assert.deepEqual((await state()).save.draft,full);
 // Observe actual rendered bead children; impact must move nearby art, never groove hit targets.
 await tap((await state()).crafting.slots[first]);await action('移除');
 await page.evaluate(async()=>{
   const cc=await System.import('cc');
   window.readBeadArt=()=>cc.director.getScene().getChildByPath('AtelierGame/Canvas/Atelier/Page').children.filter(n=>n.name.startsWith('Slot ')).map(n=>{
     const b=n.children.find(c=>c.name.startsWith('bead-'));
     return {index:Number(n.name.slice(5)),x:b?.position.x,y:b?.position.y,angle:b?.angle,slotX:n.position.x,slotY:n.position.y};
   });
   window.rippleBaseline=window.readBeadArt();window.rippleSamples=[];window.sampleRipple=true;
   const sample=()=>{if(!window.sampleRipple)return;window.rippleSamples.push(window.readBeadArt());requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 await material(full[first]);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).crafting.flights.some(f=>Math.hypot(f.x-360,f.y-532)>248&&Math.hypot(f.x-360,f.y-532)<261));
 await page.screenshot({path:dir+'/spring-impact.png'});await idle();await page.waitForTimeout(100);
 const ripple=await page.evaluate(()=>{window.sampleRipple=false;return {baseline:window.rippleBaseline,samples:window.rippleSamples,final:window.readBeadArt()};});
 const moved=new Set();
 for(const frame of ripple.samples)for(const bead of frame){const before=ripple.baseline[bead.index];assert.equal(bead.slotX,before.slotX);assert.equal(bead.slotY,before.slotY);if(bead.index===first||bead.x===undefined)continue;assert.equal(bead.angle,0);if(Math.hypot(bead.x-before.x,bead.y-before.y)>2)moved.add(bead.index);}
 assert.ok(moved.size>=2,'impact ripples through nearby existing beads');
 for(const index of moved)assert.ok(Math.min((index-first+12)%12,(first-index+12)%12)<=2,'distant beads stay still');
 for(const bead of ripple.final){if(bead.index===first)continue;const before=ripple.baseline[bead.index];assert.ok(Math.hypot(bead.x-before.x,bead.y-before.y)<.001,'ripple returns to the exact original pose');}
 assert.deepEqual((await state()).save.draft,full);
 await page.screenshot({path:dir+'/settled.png'});await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.draft,full);await action('按单制作');await action('开始制作');assert.equal((await state()).crafting.flights.length,0);
 // Leaving during flight preserves the reserved draft, without ghost beads on return.
 await tap((await state()).crafting.slots[first]);await action('移除');await material(4);const leaving=(await state()).save.draft.slice();await action('返回委托');assert.equal((await state()).screen,'orders');await action('按单制作 180金');await action('开始制作');assert.deepEqual((await state()).save.draft,leaving);assert.equal((await state()).crafting.flights.length,0);
 const reduced={...initial,reduced:true,inventory:[1,0,0,0,0,0]};await page.evaluate(save=>{window.name='qa-save:'+JSON.stringify(save);},reduced);await page.reload({waitUntil:'networkidle'});await ready();await action('按单制作');await action('开始制作');await material(0);s=await state();assert.equal(s.crafting.flights.length,0);assert.equal(s.save.draft.filter(n=>n===0).length,1);const limited=s.save.draft.slice();await material(0);await material(2);assert.deepEqual((await state()).save.draft,limited);
 for(const [width,height] of [[360,800],[390,844],[1440,900]]){await page.setViewportSize({width,height});await page.screenshot({path:dir+`/layout-${width}.png`});}
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,centerThenBounce:true,springOvershoot:Math.max(...radii)-228,inwardRebound:true,neighborRipple:[...moved],noRotation:true,orientationSamples:samples.length,concurrentFlights:true,uniqueReservations:true,dragSwapRemoveUndo:true,fullAndStockGuards:true,reloadAndLeave:true,reducedMotion:true,threeWidths:true,errors},null,2));console.log('Spring launch passed: center, bounded overshoot, inward rebound, neighboring bead ripple with stable hit targets, no rotation, concurrent flights, held drag, undo/full/stock/reload/exit/reduced motion and three widths.');
}finally{await browser.close();}
