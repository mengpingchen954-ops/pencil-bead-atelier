import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,normalizeSave,findMove,total,draftCounts,deliver} from '../cocos/assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice,priceBounds} from '../cocos/assets/scripts/commerce.ts';
import {ORDERS,MATERIALS} from '../cocos/assets/scripts/content.ts';
import {materialPalette,charmType} from '../cocos/assets/scripts/materials.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.SIZE_ARTIFACTS||'artifacts/bead-sizes';
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
const initial={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,track:'glimmer',volume:0},inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true),draft:Array.from({length:13},(_,i)=>i===2?3:0)};
const ui=await fixture(initial),{page,state,button,tap,ready}=ui;
const widths=()=>page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return g.slotNodes.map(n=>{const bead=n.children.find(c=>/^bead-/.test(c.name));return bead?.getComponent(cc.UITransform).contentSize.width||0;});});
const select=async i=>{const s=await state();await tap(s.crafting.slots[i].x,s.crafting.slots[i].y);};
const drag=async(a,b)=>{const s=await state(),box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/720,box.height/1280),xy=p=>({x:box.x+box.width/2+(p.x-360)*scale,y:box.y+box.height/2+(p.y-640)*scale}),from=xy(s.crafting.slots[a]),to=xy(s.crafting.slots[b]);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();await page.waitForTimeout(150);};
try {
 await button('自由 DIY');let s=await state();assert.equal(s.screen,'craft');assert.equal(s.save.draft.length,13);
 const before=await widths();await button('+');assert.deepEqual(await widths(),before);await page.waitForTimeout(2800);
 await select(0);await button('+');await button('+');s=await state();assert.equal(s.save.draftSizes[0],12);assert.ok(s.save.draftSizes.slice(1).every(n=>n===8));
 const after=await widths();assert.ok(after[0]>before[0]);assert.deepEqual(after.slice(1),before.slice(1));
 await select(1);await button('−');await select(2);await button('+');s=await state();assert.deepEqual(s.save.draftSizes.slice(0,3),[12,6,10]);assert.equal(s.save.beadSize,8);assert.deepEqual(s.save.inventory,initial.inventory);
 for(const width of [360,390,1440]){await page.setViewportSize({width,height:width===1440?900:844});await page.waitForTimeout(150);await page.screenshot({path:dir+'/single-beads-'+width+'.png'});const w=await widths();assert.ok(w[0]>w[2]&&w[2]>w[1]);}
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle'});await ready();await button('自由 DIY');assert.deepEqual((await state()).save.draftSizes.slice(0,3),[12,6,10]);
 await drag(0,2);assert.deepEqual((await state()).save.draftSizes.slice(0,3),[10,6,12]);await button('撤销');assert.deepEqual((await state()).save.draftSizes.slice(0,3),[12,6,10]);
 await select(1);const tile=(await state()).crafting.materials[3];await tap(tile.x,tile.y);assert.equal((await state()).save.draft[1],3);assert.equal((await state()).save.draftSizes[1],6);
 await select(1);await button('移除');await button('撤销');assert.equal((await state()).save.draftSizes[1],6);
 await button('预览');await page.screenshot({path:dir+'/preview.png'});await button('继续制作');await button('完成制作');s=await state();assert.equal(s.screen,'packing');assert.deepEqual(s.packing.beadSizes.slice(0,3),[12,6,10]);await page.screenshot({path:dir+'/packing.png'});
 await button('保存作品');s=await state();const work=s.save.commerce.works[0];assert.deepEqual(work.beadSizes.slice(0,3),[12,6,10]);const stock=s.save.inventory.slice();
 await button('上架橱窗 · 1');await button('确认上架');await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.commerce.works[0].beadSizes,work.beadSizes);
 await ui.action('图鉴');await tap(207,409);assert.equal((await state()).modal,'free-work');await page.screenshot({path:dir+'/saved-work.png'});await button('再做一条');assert.deepEqual((await state()).save.draftSizes,work.beadSizes);assert.deepEqual((await state()).save.inventory,stock);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.commerce.works[0].status==='sold',{},{timeout:30000});s=await state();assert.equal(s.save.coins,initial.coins+s.save.commerce.works[0].price);assert.deepEqual(s.save.commerce.works[0].beadSizes,work.beadSizes);
 report.sameMaterialIndependentSizes=true;report.nativeDragReplacementUndo=true;report.saveReloadGalleryRemake=true;report.salePaysOnce=true;report.widths=[360,390,1440];
 // Non-reduced animation ends at the selected instance's saved size.
 const motion=await fixture({...initial,reduced:false,draft:[0,...Array(11).fill(null)],draftSizes:[12,...Array(11).fill(8)]});await motion.button('自由 DIY');await motion.tap(360,239);const m=(await motion.state()).crafting.materials[3];await motion.tap(m.x,m.y);await motion.page.waitForTimeout(1200);assert.equal((await motion.state()).save.draftSizes[0],12);assert.ok((await motion.state()).crafting.flights.length===0);await motion.page.screenshot({path:dir+'/animated-replacement.png'});await motion.context.close();report.animation=true;
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally { await browser.close(); }
