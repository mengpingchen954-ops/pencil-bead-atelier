import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,draftCounts} from '../cocos/assets/scripts/model.ts';
import {charmType} from '../cocos/assets/scripts/materials.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.RING_ARTIFACTS||'artifacts/ring-charms';
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
   if(['撤销','移除','替换','预览','参考配色','采珠','评分规则'].includes(name)&&await page.getByRole('button',{name:'工具',exact:true}).count())await button('工具');
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
const leaf=charmType('leaf'),bell=charmType('bell');
const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,track:'glimmer',volume:0},inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true),draft:Array.from({length:12},(_,i)=>i%3?24:29),draftSizes:Array(12).fill(8),charm:'leaf'};
initial.inventory[leaf]=initial.gatheredStock[leaf]=3;initial.inventory[bell]=initial.gatheredStock[bell]=2;initial.inventory[36]=initial.gatheredStock[36]=0;initial.materialUnlocked[36]=false;
const ui=await fixture(initial),{page,state,button,tap,ready}=ui;
const select=async index=>{const s=await state();await tap(s.crafting.slots[index].x,s.crafting.slots[index].y);};
const native=()=>page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return {loose:g.page.children.filter(n=>n.name.startsWith('charm-')).map(n=>n.name),slots:g.slotNodes.map(n=>({art:n.children.filter(n=>/^(bead-|charm-)/.test(n.name)).map(n=>({name:n.name,width:n.getComponent(cc.UITransform).contentSize.width})),selected:n.children.some(n=>n.name==='Selected groove')}))};});
const drag=async(from,to)=>{const s=await state(),box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/720,box.height/1280),xy=p=>({x:box.x+box.width/2+(p.x-360)*scale,y:box.y+box.height/2+(p.y-640)*scale}),a=xy(s.crafting.slots[from]),b=xy(s.crafting.slots[to]);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();await page.waitForTimeout(150);};
try{
 await button('自由 DIY');let s=await state();assert.deepEqual(s.save.draft,[...initial.draft,leaf]);assert.equal(s.save.charm,'none');assert.deepEqual(s.save.inventory,initial.inventory);assert.deepEqual((await native()).loose,[]);assert.equal((await native()).slots[12].art[0].name,'charm-leaf');
 await button('饰品');await page.screenshot({path:dir+'/legacy-leaf-on-ring.png'});const migrated=s.save.draft.slice();
 await page.reload({waitUntil:'networkidle'});await ready();await button('自由 DIY');assert.deepEqual((await state()).save.draft,migrated);await button('饰品');
 const before=JSON.stringify((await state()).save),locked=(await state()).crafting.materials[36];await tap(locked.x,locked.y);assert.equal(JSON.stringify((await state()).save),before);await page.waitForTimeout(2850);
 await select(12);await button('+');await button('+');s=await state();assert.equal(s.save.draftSizes[12],12);assert.ok(s.save.draftSizes.slice(0,12).every(n=>n===8));assert.equal((await native()).slots[12].selected,true);
 await page.screenshot({path:dir+'/selected-leaf-size.png'});await drag(12,2);s=await state();assert.equal(s.save.draft[2],leaf);assert.equal(s.save.draftSizes[2],12);
 const bellTile=s.crafting.materials[bell];await tap(bellTile.x,bellTile.y);s=await state();assert.equal(s.save.draft[2],bell);assert.equal(s.save.draftSizes[2],12);await button('撤销');assert.equal((await state()).save.draft[2],leaf);
 await select(2);await button('移除');assert.equal((await state()).save.draft[2],null);await button('撤销');assert.equal((await state()).save.draft[2],leaf);
 const leafTile=(await state()).crafting.materials[leaf];await tap(leafTile.x,leafTile.y);await tap(leafTile.x,leafTile.y);s=await state();assert.equal(s.save.draft.filter(n=>n===leaf).length,3);assert.equal(s.save.draft.length,15);
 const exhausted=JSON.stringify(s.save);await tap(leafTile.x,leafTile.y);assert.equal(JSON.stringify((await state()).save),exhausted);await page.waitForTimeout(2850);
 for(const width of [360,390,1440]){await page.setViewportSize({width,height:width===1440?900:844});await page.waitForTimeout(150);await page.screenshot({path:dir+'/ring-charms-'+width+'.png'});assert.deepEqual((await native()).loose,[]);}
 await page.setViewportSize({width:390,height:844});s=await state();const draft=s.save.draft.slice(),sizes=s.save.draftSizes.slice(),expected=initial.inventory.map((n,i)=>n-(draftCounts(draft)[i]||0));assert.deepEqual(s.save.inventory,initial.inventory);
 await button('预览');await page.screenshot({path:dir+'/preview.png'});await button('继续制作');await button('完成制作');await page.screenshot({path:dir+'/packing.png'});await button('保存作品');s=await state();const work=s.save.commerce.works[0];assert.deepEqual(work.beads,draft);assert.deepEqual(work.beadSizes,sizes);assert.equal(work.charm,'none');assert.deepEqual(s.save.inventory,expected);assert.deepEqual(s.save.gatheredStock,expected);
 await button('上架橱窗 · 1');await page.screenshot({path:dir+'/listing.png'});await button('确认上架');await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.commerce.works[0].beads,draft);
 await ui.action('图鉴');await tap(207,409);await page.screenshot({path:dir+'/gallery.png'});await button('再做一条');s=await state();assert.deepEqual(s.save.draft,draft);assert.deepEqual(s.save.draftSizes,sizes);assert.deepEqual(s.save.inventory,expected);assert.deepEqual((await native()).loose,[]);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.commerce.works[0].status==='sold',{},{timeout:30000});s=await state();const paid=s.save.coins;assert.equal(paid,initial.coins+s.save.commerce.works[0].price);await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.coins,paid);assert.deepEqual((await state()).save.inventory,expected);
 report.legacyMigratesOnce=true;report.nativeRingResizeDragReplaceRemoveUndo=true;report.multipleCharmsStockGuard=true;report.saveGalleryRemakeSizes=true;report.salePaysOnce=true;report.widths=[360,390,1440];
 await ui.context.close();
 if(!process.env.RING_CORE_ONLY){
  const motion=await fixture({...initial,reduced:false,charm:'none',draft:[24,...Array(11).fill(null)]});await motion.button('自由 DIY');await motion.button('饰品');const m=(await motion.state()).crafting.materials[leaf];await motion.tap(m.x,m.y);await motion.page.waitForTimeout(1200);const moved=await motion.state();assert.ok(moved.save.draft.includes(leaf));assert.equal(moved.crafting.flights.length,0);await motion.page.screenshot({path:dir+'/animated-leaf.png'});await motion.context.close();report.charmAnimation=true;
  const only=await fixture({...initial,charm:'none',draft:Array(12).fill(null)});await only.button('自由 DIY');await only.button('饰品');const item=(await only.state()).crafting.materials[leaf];await only.tap(item.x,item.y);await only.page.waitForTimeout(350);await only.button('完成制作');await only.button('保存作品');assert.deepEqual((await only.state()).save.commerce.works[0].beads,[leaf]);await only.context.close();report.charmOnlyWork=true;
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
