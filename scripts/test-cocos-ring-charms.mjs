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
const native=()=>page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return {loose:g.page.children.filter(n=>n.name.startsWith('charm-')).map(n=>n.name),slots:g.slotNodes.map(n=>({art:n.children.filter(n=>/^(bead-|charm-)/.test(n.name)).map(n=>({name:n.name,width:n.getComponent(cc.UITransform).contentSize.width,angle:n.angle})),selected:n.children.some(n=>n.name==='Selected groove')}))};});
const geometry=async target=>target.page.evaluate(async()=>{
 const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
 return g.slotNodes.flatMap((slot,i)=>{const art=slot.children.find(n=>n.name.startsWith('charm-'));if(!art)return [];
  const t=art.getComponent(cc.UITransform),st=slot.getComponent(cc.UITransform),hole=t.convertToWorldSpaceAR(new cc.Vec3()),wire=st.convertToWorldSpaceAR(new cc.Vec3(st.contentSize.width/2,-st.contentSize.height/2));
  const body=t.convertToWorldSpaceAR(new cc.Vec3((.5-t.anchorPoint.x)*t.contentSize.width,(.5-t.anchorPoint.y)*t.contentSize.height)),p=g.slotPos(i);
  return [{i,error:cc.Vec3.distance(hole,wire),dot:(body.x-hole.x)*(p.x-360)-(body.y-hole.y)*(p.y-410),facing:g.workingFacings[i],body:{x:body.x+360,y:640-body.y}}];
 });
});
const checkGeometry=async target=>{const items=await geometry(target);assert.ok(items.length);for(const item of items){assert.ok(item.error<.01,'hole on wire at '+item.i);assert.ok(item.facing==='in'?item.dot<0:item.dot>0,'facing at '+item.i);}return items;};
const drag=async(from,to,body=false,touch=false,held)=>{
 const s=await state(),box=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(box.width/720,box.height/1280),xy=p=>({x:box.x+box.width/2+(p.x-360)*scale,y:box.y+box.height/2+(p.y-640)*scale}),a=xy(body?(await geometry(ui)).find(item=>item.i===from).body:s.crafting.slots[from]),b=xy(typeof to==='number'?s.crafting.slots[to]:to);
 if(touch){const cdp=await page.context().newCDPSession(page);try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:0}]});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10,id:0}]});await page.waitForTimeout(16);}await held?.();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach();}}
 else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await held?.();await page.mouse.up();}
 await page.waitForTimeout(150);
};
try{
 await button('自由 DIY');let s=await state();assert.deepEqual(s.save.draft,[...initial.draft,leaf]);assert.equal(s.save.charm,'none');assert.deepEqual(s.save.inventory,initial.inventory);assert.deepEqual((await native()).loose,[]);assert.equal((await native()).slots[12].art[0].name,'charm-leaf');
 await button('饰品');await page.screenshot({path:dir+'/legacy-leaf-on-ring.png'});const migrated=s.save.draft.slice();
 await page.reload({waitUntil:'networkidle'});await ready();await button('自由 DIY');assert.deepEqual((await state()).save.draft,migrated);await button('饰品');
 const before=JSON.stringify((await state()).save),locked=(await state()).crafting.materials[36];await tap(locked.x,locked.y);assert.equal(JSON.stringify((await state()).save),before);await page.waitForTimeout(2850);
 for(const width of [360,390,1440]){
  await page.setViewportSize({width,height:width===1440?900:844});await page.waitForTimeout(150);
  for(const index of [9,12]){
   const original=(await state()).save;await drag(index,{x:index===9?25:695,y:410},index===12,width!==1440);s=await state();assert.equal(s.save.draft[index],null);assert.deepEqual(s.save.inventory,original.inventory);assert.deepEqual(s.save.gatheredStock,original.gatheredStock);
   assert.equal(await page.evaluate(index=>JSON.parse(localStorage.getItem('pencil-bead-atelier-v1')).draft[index],index),null);await page.screenshot({path:dir+'/drag-out-'+index+'-'+width+'.png'});
   await button('撤销');s=await state();assert.deepEqual(s.save.draft,original.draft);assert.deepEqual(s.save.draftSizes,original.draftSizes);assert.deepEqual(s.save.draftFacings,original.draftFacings);
  }
  for(const facing of ['in','out']){
   const original=(await state()).save,p=(await state()).crafting.slots[12],body=(await geometry(ui)).find(item=>item.i===12).body,amount=facing==='in'?-55:50,angle=(await native()).slots[12].art[0].angle;
   await drag(12,{x:body.x+(p.x-360)/171*amount,y:body.y+(p.y-410)/171*amount},true,width!==1440,async()=>{
    assert.equal((await state()).save.draftFacings[12],original.draftFacings[12]);const item=(await geometry(ui)).find(item=>item.i===12);assert.ok(item.error<.01);assert.ok(facing==='in'?item.dot<0:item.dot>0);assert.ok(Math.abs(Math.abs((await native()).slots[12].art[0].angle-angle)-180)<.1);await page.screenshot({path:dir+'/drag-facing-'+facing+'-'+width+'.png'});
   });
   s=await state();assert.equal(s.save.draftFacings[12],facing);assert.deepEqual(s.save.draft,original.draft);assert.deepEqual(s.save.inventory,original.inventory);await checkGeometry(ui);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pencil-bead-atelier-v1')).draftFacings[12]),facing);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);report.dragOutsideRemovesBeadsAndCharmBodies=true;report.dragRemovalUndoAndStockPreserved=true;report.nativeTouchAndMouseDrag=true;report.radialDragPreviewsAndSavesFacing=true;
 if(!(await native()).slots[12].selected)await select(12);for(let step=0;step<4;step++)await button('+');s=await state();assert.equal(s.save.draftSizes[12],12);assert.ok(s.save.draftSizes.slice(0,12).every(n=>n===8));assert.equal((await native()).slots[12].selected,true);
 await button('朝内');assert.equal((await state()).save.draftFacings[12],'in');await checkGeometry(ui);await page.screenshot({path:dir+'/selected-leaf-inward.png'});
 await button('朝外');assert.equal((await state()).save.draftFacings[12],'out');await checkGeometry(ui);await page.screenshot({path:dir+'/selected-leaf-outward.png'});
 await button('朝内');const body=(await checkGeometry(ui)).find(item=>item.i===12).body;await tap(body.x,body.y);assert.equal((await native()).slots[12].selected,false);await page.waitForTimeout(350);await tap(body.x,body.y);assert.equal((await native()).slots[12].selected,true);
 await page.screenshot({path:dir+'/selected-leaf-size.png'});await drag(12,2);s=await state();assert.equal(s.save.draft[2],leaf);assert.equal(s.save.draftSizes[2],12);
 assert.equal(s.save.draftFacings[2],'in');const bellTile=s.crafting.materials[bell];await tap(bellTile.x,bellTile.y);s=await state();assert.equal(s.save.draft[2],bell);assert.equal(s.save.draftSizes[2],12);await button('撤销');assert.equal((await state()).save.draft[2],leaf);assert.equal((await state()).save.draftFacings[2],'in');
 await select(2);await button('移除');assert.equal((await state()).save.draft[2],null);await button('撤销');assert.equal((await state()).save.draft[2],leaf);
 const leafTile=(await state()).crafting.materials[leaf];await tap(leafTile.x,leafTile.y);await tap(leafTile.x,leafTile.y);s=await state();assert.equal(s.save.draft.filter(n=>n===leaf).length,3);assert.equal(s.save.draft.length,15);
 const exhausted=JSON.stringify(s.save);await tap(leafTile.x,leafTile.y);assert.equal(JSON.stringify((await state()).save),exhausted);await page.waitForTimeout(2850);
 for(const width of [360,390,1440]){await page.setViewportSize({width,height:width===1440?900:844});await page.waitForTimeout(150);await page.screenshot({path:dir+'/ring-charms-'+width+'.png'});assert.deepEqual((await native()).loose,[]);}
 await page.setViewportSize({width:390,height:844});s=await state();const draft=s.save.draft.slice(),sizes=s.save.draftSizes.slice(),facings=s.save.draftFacings.slice(),expected=initial.inventory.map((n,i)=>n-(draftCounts(draft)[i]||0));assert.deepEqual(s.save.inventory,initial.inventory);await checkGeometry(ui);
 await button('预览');await page.screenshot({path:dir+'/preview.png'});await button('继续制作');await button('完成制作');await page.screenshot({path:dir+'/packing.png'});await button('保存作品');s=await state();const work=s.save.commerce.works[0];assert.deepEqual(work.beads,draft);assert.deepEqual(work.beadSizes,sizes);assert.deepEqual(work.beadFacings,facings);assert.equal(work.charm,'none');assert.deepEqual(s.save.inventory,expected);assert.deepEqual(s.save.gatheredStock,expected);
 await button('上架橱窗 · 1');await page.screenshot({path:dir+'/listing.png'});await button('确认上架');await page.reload({waitUntil:'networkidle'});await ready();assert.deepEqual((await state()).save.commerce.works[0].beads,draft);
 await ui.action('图鉴');await tap(207,409);await page.screenshot({path:dir+'/gallery.png'});await button('再做一条');s=await state();assert.deepEqual(s.save.draft,draft);assert.deepEqual(s.save.draftSizes,sizes);assert.deepEqual(s.save.draftFacings,facings);assert.deepEqual(s.save.inventory,expected);assert.deepEqual((await native()).loose,[]);await checkGeometry(ui);
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.commerce.works[0].status==='sold',{},{timeout:30000});s=await state();const paid=s.save.coins;assert.equal(paid,initial.coins+s.save.commerce.works[0].price);await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.coins,paid);assert.deepEqual((await state()).save.inventory,expected);
 report.legacyMigratesOnce=true;report.nativeRingResizeDragReplaceRemoveUndo=true;report.multipleCharmsStockGuard=true;report.saveGalleryRemakeSizes=true;report.perCharmFacingAndHoleAlignment=true;report.bodyTouchSelectsCharm=true;report.salePaysOnce=true;report.widths=[360,390,1440];
 await ui.context.close();
 if(!process.env.RING_CORE_ONLY){
  const all=await fixture({...initial,charm:'none',draft:Array.from({length:12},(_,i)=>36+i),draftSizes:Array.from({length:12},(_,i)=>[6,8,10,12][i%4]),draftFacings:Array.from({length:12},(_,i)=>i%2?'in':'out')});await all.button('自由 DIY');await all.button('饰品');assert.equal((await checkGeometry(all)).length,12);await all.page.screenshot({path:dir+'/all-twelve-hole-anchors.png'});await all.context.close();report.allTwelveHoleAnchors=true;
  const motion=await fixture({...initial,reduced:false,charm:'none',draft:[24,...Array(11).fill(null)]});await motion.button('自由 DIY');await motion.button('饰品');const m=(await motion.state()).crafting.materials[leaf];await motion.tap(m.x,m.y);await motion.page.waitForTimeout(1200);const moved=await motion.state();assert.ok(moved.save.draft.includes(leaf));assert.equal(moved.crafting.flights.length,0);await motion.page.screenshot({path:dir+'/animated-leaf.png'});await motion.context.close();report.charmAnimation=true;
  const only=await fixture({...initial,charm:'none',draft:Array(12).fill(null)});await only.button('自由 DIY');await only.button('饰品');const item=(await only.state()).crafting.materials[leaf];await only.tap(item.x,item.y);await only.page.waitForTimeout(350);await only.button('完成制作');await only.button('保存作品');assert.deepEqual((await only.state()).save.commerce.works[0].beads,[leaf]);await only.context.close();report.charmOnlyWork=true;
 }
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
