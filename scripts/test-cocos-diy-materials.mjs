import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,normalizeSave,findMove,total,draftCounts,deliver} from '../cocos/assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice,priceBounds} from '../cocos/assets/scripts/commerce.ts';
import {ORDERS,MATERIALS} from '../cocos/assets/scripts/content.ts';
import {materialPalette,charmType} from '../cocos/assets/scripts/materials.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.DIY_ARTIFACTS||'artifacts/diy-materials';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[];
const report={base,nativeInput:true};
async function fixture(save,viewport={width:390,height:844}){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},save);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const ready=async()=>{await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await page.waitForTimeout(200);};
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);await page.touchscreen.tap(b.x+b.width/2+(x-360)*scale,b.y+b.height/2+(y-640)*scale);await page.waitForTimeout(90);};
 const button=async(name)=>{
   const p=await page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
    const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const child of n.children){const result=find(child);if(result)return result;}return null;};
    const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('No native button '+name+' on '+g.screen+'/'+g.modal);
    const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);
 };
 const action=async name=>{await page.getByRole('button',{name,exact:true}).dispatchEvent('click');await page.waitForTimeout(100);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');await page.waitForTimeout(150);};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 return {context,page,state,ready,tap,button,action,escape};
}
const initial={...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0}};
async function startGather(ui){
 await ui.button('采珠');const name=await ui.page.getByRole('button',{name:/^开始采珠 · /}).textContent();await ui.button(name);
}
async function gatherMoves(ui,minimum=16){
 for(let turn=0;turn<20;turn++){
  const s=await ui.state();if(s.session.collected.reduce((n,m,i)=>n+(s.session.materialTypes[i]<36?m:0),0)>=minimum||s.modal==='result')break;
  const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);
  for(const index of pair)await ui.tap(48+index%8*78+36,340+Math.floor(index/8)*78+36);
  await ui.page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:12000});
 }
 const s=await ui.state();assert.ok(total(s.session.collected)>=minimum);
 const expected=Array(48).fill(0);s.session.collected.forEach((n,i)=>expected[s.session.materialTypes[i]]=n);
 assert.deepEqual(s.save.inventory,expected);assert.deepEqual(s.save.gatheredStock,expected);assert.deepEqual(s.save.materialUnlocked,expected.map(n=>n>0));
 if(s.modal==='result')await ui.escape();else{await ui.button('暂停');await ui.button('返回店铺');await ui.button('确认返回店铺');}
 if((await ui.state()).screen==='home')await ui.button('自由 DIY');
 return expected;
}
try{
 const ui=await fixture(initial),{state,page,tap,button,action}=ui;
 await button('自由 DIY');let s=await state();assert.equal(s.screen,'craft');assert.ok(s.save.materialUnlocked.every(n=>!n));
 const untouched=JSON.stringify(s.save);
 for(const [c,name]of ['珠宝','水晶','木质','饰品'].entries()){
  await button(name);assert.equal((await state()).crafting.category,c);await tap(146,805);assert.equal(JSON.stringify((await state()).save),untouched);
  await page.screenshot({path:dir+'/locked-category-'+c+'.png'});
 }
 await button('珠宝');await startGather(ui);await page.screenshot({path:dir+'/match-reference-materials.png'});
 const gathered=await gatherMoves(ui,18);report.realGathering=true;
 const recipe=[];for(let i=0;i<36;i++)for(let j=0;j<gathered[i]&&recipe.length<12;j++)recipe.push(i);
 assert.equal(recipe.length,12);
 for(const type of recipe){s=await state();const m=s.crafting.materials[type];if(s.crafting.category!==m.category)await button(['珠宝','水晶','木质','饰品'][m.category]);await tap(m.x,m.y);}
 await page.waitForTimeout(1100);s=await state();assert.equal(s.save.draft.includes(null),false);const draft=s.save.draft.slice(),stock=s.save.inventory.slice();
 await page.screenshot({path:dir+'/crafted-from-gathered.png'});
 // Native drag swaps slots and undo restores them, without changing stock.
 const from=s.crafting.slots[0],to=s.crafting.slots[4];const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280),xy=p=>({x:b.x+b.width/2+(p.x-360)*scale,y:b.y+b.height/2+(p.y-640)*scale});
 const a=xy(from),z=xy(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(z.x,z.y,{steps:8});await page.mouse.up();await page.waitForTimeout(100);const swapped=draft.slice();[swapped[0],swapped[4]]=[swapped[4],swapped[0]];assert.deepEqual((await state()).save.draft,swapped);await button('撤销');assert.deepEqual((await state()).save.draft,draft);assert.deepEqual((await state()).save.inventory,stock);
 // Size controls change actual bead display and survive reload.
 await button('+');assert.equal((await state()).save.beadSize,10);await button('−');assert.equal((await state()).save.beadSize,8);
 await button('完成制作');assert.equal((await state()).screen,'packing');await button('保存并上架');s=await state();assert.equal(s.modal,'listing');assert.equal(s.save.commerce.works.length,1);assert.equal(s.save.coins,initial.coins);assert.equal(s.save.commerce.works[0].charm,'none');
 const expected=stock.map((n,i)=>n-(draftCounts(draft)[i]||0));assert.deepEqual(s.save.inventory,expected);assert.deepEqual(s.save.gatheredStock,expected);
 await button('确认上架');const listed=(await state()).save.commerce.works[0];await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.commerce.works[0].status==='sold',{},{timeout:30000});
 assert.equal((await state()).save.coins,initial.coins+listed.price);await page.reload({waitUntil:'networkidle'});await ui.ready();assert.equal((await state()).save.coins,initial.coins+listed.price);report.saveSaleReload=true;
 await button('自由 DIY');for(const width of [360,390,540,1440]){await page.setViewportSize({width,height:width===1440?900:844});await page.waitForTimeout(200);await page.screenshot({path:dir+'/workshop-'+width+'.png'});assert.equal((await state()).screen,'craft');}
 await ui.context.close();
 // Each later category uses the same six actual materials on the board and in earned inventory.
 for(const level of [3,5,7,8]){
  const later=await fixture({...initial,level});await later.button('自由 DIY');await startGather(later);const shot=await later.state();assert.deepEqual(shot.session.materialTypes,materialPalette(level));await later.page.screenshot({path:dir+'/match-level-'+level+'.png'});await gatherMoves(later,12);await later.context.close();
 }
 // No provenance migration invents unlocks, while old works, coins and stock survive.
 const old={...initial,coins:1342,inventory:[10,2,3,4,0,0]};delete old.gatheredStock;delete old.materialUnlocked;
 const legacy=await fixture(old);const restored=(await legacy.state()).save;assert.equal(restored.coins,1342);assert.deepEqual(restored.inventory.slice(0,6),old.inventory);assert.ok(restored.gatheredStock.every(n=>n===0));await legacy.button('自由 DIY');const before=JSON.stringify((await legacy.state()).save);await legacy.tap(146,805);assert.equal(JSON.stringify((await legacy.state()).save),before);await legacy.context.close();report.legacyPreserved=true;
 // Only an earned charm can be selected, and saving spends one real item.
 const earned={...initial,inventory:Array(48).fill(0),gatheredStock:Array(48).fill(0),materialUnlocked:Array(48).fill(false),draft:Array(12).fill(0)};earned.inventory[0]=earned.gatheredStock[0]=12;earned.materialUnlocked[0]=true;const heart=charmType('heart');earned.inventory[heart]=earned.gatheredStock[heart]=1;earned.materialUnlocked[heart]=true;
 const charms=await fixture(earned);await charms.button('自由 DIY');await charms.button('饰品');await charms.tap(146,805);assert.equal((await charms.state()).save.charm,'none');await charms.tap(565,989);assert.equal((await charms.state()).save.charm,'heart');await charms.page.screenshot({path:dir+'/earned-charm.png'});await charms.button('完成制作');await charms.button('保存作品');assert.equal((await charms.state()).save.gatheredStock[heart],0);await charms.context.close();report.charmStock=true;
 assert.deepEqual(errors,[]);report.errors=errors;report.widths=[360,390,540,1440];fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('DIY materials passed: actual gathering, four locked categories, native placement/drag/undo/size, stock consumption, sale/reload, all later categories, legacy migration and earned charms.');
}finally{await browser.close();}
