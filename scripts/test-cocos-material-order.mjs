import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,newSession,gatheredMaterials} from '../cocos/assets/scripts/model.ts';
import {categoryMaterials} from '../cocos/assets/scripts/materials.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.ORDER_ARTIFACTS||'artifacts/material-order/browser';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],widths=[390,1440];
try{
 for(const width of widths){
  const mobile=width===390,context=await browser.newContext({viewport:{width,height:mobile?960:900},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})}),page=await context.newPage();
  page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const save={...freshSave(),started:true,draft:[],sound:false,music:{enabled:false,track:'glimmer',volume:0},firstSteps:{craft:1,firstGather:1}},groups=[0,1,2,3].map(c=>categoryMaterials(c).slice(-3).reverse());
  for(const ids of groups)ids.forEach((type,i)=>{save.materialUnlocked[type]=true;save.materialUnlockOrder.push(type);save.inventory[type]=save.gatheredStock[type]=i===0?0:5;});
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},save);
  const load=async()=>{await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');};await load();
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
  const tap=async(x,y)=>{const p=await xy(x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(120);};
  const button=async name=>{const p=await game((g,cc,name)=>{const search=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=search(c);if(r)return r;}return null;};const n=search(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);};
  const nativeOrder=()=>game(g=>g.page.getChildByName('Material viewport').getChildByName('Material content').children.map(n=>Number(n.name.slice(14))));
  await game(g=>g.navigate('craft'));const stock=(await state()).save.inventory;
  for(let c=0;c<4;c++){
   await button(['珠宝','水晶','木质','饰品'][c]);let s=await state();assert.deepEqual(await nativeOrder(),categoryMaterials(c,false,s.save));assert.deepEqual((await nativeOrder()).slice(0,3),groups[c]);
   for(let cell=0;cell<3;cell++){const m=s.crafting.materials[groups[c][cell]];assert.equal(m.visible,true);assert.equal(m.x,146+cell*140);assert.equal(m.y,868);}
   await page.screenshot({path:dir+'/category-'+c+'-'+width+'.png'});
   // Sorted coordinates must hit the actual material; an exhausted first unlock stays first.
   const empty=s.crafting.materials[groups[c][0]],chosen=s.crafting.materials[groups[c][1]];await tap(empty.x,empty.y);assert.deepEqual((await state()).save.draft,[]);
   await tap(chosen.x,chosen.y);await page.waitForTimeout(1100);assert.deepEqual((await state()).save.draft,[chosen.type]);assert.deepEqual((await state()).save.inventory,stock);assert.deepEqual((await nativeOrder()).slice(0,3),groups[c]);await button('撤销');
   const locked=s.crafting.materials[(await nativeOrder())[3]];await tap(locked.x,locked.y);assert.deepEqual((await state()).save.draft,[]);
  }
  // Real compiled reward banking appends only newly earned IDs; a repeated bank is idempotent.
  let order=[...save.materialUnlockOrder];for(const level of [5,1]){
   const session={...newSession(42,level),status:'won',moves:0,collected:[60,50,40,30,20,10]},before=await state();
   order.push(...session.materialTypes.filter((type,slot)=>gatheredMaterials(session)[slot]>0&&!before.save.materialUnlocked[type]));
   await game((g,cc,session)=>{g.session=session;g.bankGather();g.bankGather();g.session=null;g.render();},session);assert.deepEqual((await state()).save.materialUnlockOrder,order);
  }
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');assert.deepEqual((await state()).save.materialUnlockOrder,order);await game(g=>g.navigate('craft'));
  for(let c=0;c<4;c++){await button(['珠宝','水晶','木质','饰品'][c]);assert.deepEqual(await nativeOrder(),categoryMaterials(c,false,(await state()).save));}
  await game(g=>g.inventory());for(let c=0;c<4;c++){
   await button(['珠宝','水晶','木质','饰品'][c]);const expected=categoryMaterials(c,false,(await state()).save),positions=await game((g,cc,names)=>{const list=g.overlay.getChildByName('Inventory material viewport').getChildByName('Inventory material content');return names.map(name=>{const n=list.getChildByName(name);return {x:n.position.x,y:-n.position.y};});},expected.map(i=>MATERIALS[i].name));
   positions.forEach((p,cell)=>assert.deepEqual(p,{x:cell%4*131,y:Math.floor(cell/4)*149+78}));
  }await page.screenshot({path:dir+'/inventory-'+width+'.png'});
  // A legacy save gains a stable fallback order without altering its stock or progress.
  const legacy=(await state()).save;await game(g=>{delete g.save.materialUnlockOrder;g.persist();});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await game(g=>g.navigate('craft'));
  assert.deepEqual((await state()).save.inventory,legacy.inventory);assert.deepEqual((await state()).save.materialUnlocked,legacy.materialUnlocked);
  for(let c=0;c<4;c++){await button(['珠宝','水晶','木质','饰品'][c]);const catalog=categoryMaterials(c),unlocked=catalog.filter(i=>legacy.materialUnlocked[i]);assert.deepEqual(await nativeOrder(),[...unlocked,...catalog.filter(i=>!legacy.materialUnlocked[i])]);}
  await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,widths,unlockedFirst:true,firstUnlockOrder:true,exhaustedStable:true,rewardBanking:true,repeatBanking:true,tapAndUndo:true,lockedBlocked:true,inventory:true,reload:true,legacyMigration:true,errors},null,2));console.log('Material unlock order passed on mobile and desktop: all categories, exhausted stock, tap/undo, real reward banking, repeat banking, inventory, reload and legacy migration.');
}finally{await browser.close();}
