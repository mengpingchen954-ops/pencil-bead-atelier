import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
import {categoryMaterials} from '../cocos/assets/scripts/materials.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.SCROLL_ARTIFACTS||'artifacts/material-scroll/browser';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],report={base,widths:[]};
try{
 for(const width of [390,540,1440]){
  const mobile=width<600,context=await browser.newContext({viewport:{width,height:width===1440?900:960},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})}),page=await context.newPage();
  page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},{...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0},reduced:false,draft:[],inventory:MATERIALS.map((m,i)=>i===152?0:30),gatheredStock:MATERIALS.map((m,i)=>i===152?0:30),materialUnlocked:MATERIALS.map((m,i)=>i!==152),firstSteps:{craft:1,firstGather:1}});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
  const tap=async(x,y)=>{const p=await xy(x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(120);};
  const button=async name=>{const p=await game((g,cc,name)=>{const search=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=search(c);if(r)return r;}return null;};const n=search(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);};
  const pointer=async(from,to,hold=0,cancel=false)=>{
   const a=await xy(from.x,from.y),b=await xy(to.x,to.y);
   if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});if(hold)await page.waitForTimeout(hold);for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10}]});await page.waitForTimeout(12);}await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await cdp.detach();}
   else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();}
  };
  const scrollTo=async(value,inventory=false)=>{await game((g,cc,a)=>(a.inventory?g.overlay:g.page).getChildByName(a.inventory?'Inventory material viewport':'Material viewport').getComponent(cc.ScrollView).scrollToOffset(new cc.Vec2(0,a.value),.02),{value,inventory});await page.waitForTimeout(160);};
  await game(g=>g.navigate('craft'));assert.equal(await game((g,cc)=>cc.sys.isMobile),mobile);const stock=(await state()).save.inventory;
  assert.equal(await page.getByRole('button',{name:'下一页珠材',exact:true}).count(),0);
  await page.screenshot({path:dir+'/top-'+width+'.png'});
  const seen=new Set();for(let c=0;c<4;c++){
   await button(['珠宝','水晶','木质','饰品'][c]);await scrollTo(0);
   if(mobile)await pointer({x:286,y:1066},{x:286,y:870});else{const p=await xy(286,966);await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,1000);}
   await page.waitForTimeout(1000);let s=await state();assert.ok(s.crafting.scrollOffset>40,'native scroll category '+c);assert.deepEqual(s.save.draft,[]);assert.deepEqual(s.save.inventory,stock);assert.equal(s.crafting.flights.length,0);
   await button(['珠宝','水晶','木质','饰品'][(c+1)%4]);const remembered=await game((g,cc,c)=>g.craftScroll[c],c);await button(['珠宝','水晶','木质','饰品'][c]);assert.ok(Math.abs((await state()).crafting.scrollOffset-remembered)<2,'category offset retained');
   const max=(await state()).crafting.maxScroll;for(let value=0;value<=max+299;value+=300){await scrollTo(Math.min(value,max));s=await state();s.crafting.materials.filter(m=>m.visible).forEach(m=>seen.add(m.type));}
   const last=categoryMaterials(c,false,(await state()).save).at(-1);assert.equal((await state()).crafting.materials[last].visible,true,'last material visible in category '+c);await page.screenshot({path:dir+'/category-'+c+'-bottom-'+width+'.png'});
  }assert.equal(seen.size,MATERIALS.filter(m=>!m.retired).length);
  // A quick swipe leaving the tray cannot become a bead dropped into the plate.
  await button('水晶');await scrollTo(0);if(mobile){await pointer({x:286,y:970},{x:360,y:430});await page.waitForTimeout(900);assert.deepEqual((await state()).save.draft,[]);}
  await scrollTo((await state()).crafting.maxScroll);let s=await state(),locked=s.crafting.materials[152];await tap(locked.x,locked.y);assert.deepEqual((await state()).save.draft,[]);
  const material=s.crafting.materials.find(m=>m.visible&&m.unlocked),offset=s.crafting.scrollOffset;
  await pointer({x:material.x,y:material.y},{x:360,y:430},mobile?450:0);await page.waitForTimeout(700);s=await state();assert.deepEqual(s.save.draft,[material.type]);assert.deepEqual(s.save.inventory,stock);assert.ok(Math.abs(s.crafting.scrollOffset-offset)<2,'drag preserves scroll');
  await page.screenshot({path:dir+'/dragged-'+width+'.png'});await button('工具');await button('撤销');assert.deepEqual((await state()).save.draft,[]);assert.ok(Math.abs((await state()).crafting.scrollOffset-offset)<2);
  // A scrolled material can still be tapped normally after the ring is redrawn.
  s=await state();const chosen=s.crafting.materials.find(m=>m.visible&&m.unlocked);await tap(chosen.x,chosen.y);await page.waitForTimeout(1000);assert.deepEqual((await state()).save.draft,[chosen.type]);assert.ok(Math.abs((await state()).crafting.scrollOffset-offset)<2);
  await game(g=>g.inventory());await button('水晶');await scrollTo(0,true);
  if(mobile)await pointer({x:290,y:770},{x:290,y:460});else{const p=await xy(290,600);await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,1200);}
  await page.waitForTimeout(900);assert.ok(await game(g=>g.inventoryScroll[1]>50));await page.screenshot({path:dir+'/inventory-'+width+'.png'});assert.deepEqual((await state()).save.inventory,stock);
  await button('珠宝');const inventoryOffset=await game(g=>g.inventoryScroll[1]);await button('水晶');assert.ok(Math.abs(await game(g=>g.inventoryScroll[1])-inventoryOffset)<2);await game(g=>g.closeModal());
  await game(g=>{g.save.reduced=true;g.render();});assert.equal(await game((g,cc)=>g.page.getChildByName('Material viewport').getComponent(cc.ScrollView).inertia),false);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');assert.deepEqual((await state()).save.draft,[chosen.type]);assert.deepEqual((await state()).save.inventory,stock);
  report.widths.push(width);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({...report,nativeSwipes:true,mouseWheel:true,allActiveMaterialsReachable:true,categoryMemory:true,noAccidentalPlacement:true,longPressDrag:true,tapAndUndo:true,inventoryScroll:true,reload:true,errors},null,2));console.log('Continuous material scrolling passed at 390/540/1440: native swipes and wheel, all active materials, category memory, no swipe placements, held drag, tap/undo, inventory and reload.');
}finally{await browser.close();}
