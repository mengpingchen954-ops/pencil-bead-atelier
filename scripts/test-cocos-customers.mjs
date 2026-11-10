import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,normalizeSave} from '../cocos/assets/scripts/model.ts';
import {CUSTOM_STYLES,finishWork,customerFit} from '../cocos/assets/scripts/commerce.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.CUSTOMER_ARTIFACTS||'artifacts/customers';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],report={base};
const initial=()=>({...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0},inventory:[12,...Array(47).fill(0)],gatheredStock:[12,...Array(47).fill(0)],materialUnlocked:[true,...Array(47).fill(false)]});
const offered=(save,style)=>({...save,customers:{nextId:2,nextAt:0,lastStyle:'',active:{id:1,style,buyer:'许老师',status:'offered',createdAt:1000}}});
async function fixture(save,viewport={width:390,height:844}){
 const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},save);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const ready=async()=>{await page.waitForFunction(()=>typeof window.render_game_to_text==='function',{},{timeout:90000});await page.waitForTimeout(200);};
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);const px=b.x+b.width/2+(x-360)*scale,py=b.y+b.height/2+(y-640)*scale;if(viewport.width<600)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);await page.waitForTimeout(90);};
 const button=async(name)=>{
   if(['撤销','移除','替换','预览','参考配色','采珠','评分规则'].includes(name)&&await page.getByRole('button',{name:'工具',exact:true}).count())await button('工具');
   const p=await page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
    const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name||(name==='返回售珠'&&/^Button: 返回(小店|图鉴|故事|人物|手账|装修)$/.test(n.name)))return n;for(const child of n.children){const result=find(child);if(result)return result;}return null;};
    const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('No native button '+name+' on '+g.screen+'/'+g.modal);
    const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);
 };
 const action=async name=>{await page.getByRole('button',{name,exact:true}).dispatchEvent('click');await page.waitForTimeout(100);};
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');await page.waitForTimeout(150);};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 return {context,page,state,ready,tap,button,action,escape};
}

const coinState=page=>page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (g.coinEffects?.children||[]).map(n=>({id:n.uuid,x:n.position.x,y:n.position.y}));});
try{
 // Real elapsed time triggers a visitor, followed by touch-only gathering-stock craft and atomic delivery.
 const save=initial();save.customers.nextAt=Date.now()+15000;
 const ui=await fixture(save),{page,state,button,tap,action}=ui;
 await page.screenshot({path:dir+'/home-waiting.png'});
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.customers.active,{},{timeout:45000});
 let s=await state();assert.equal(s.modal,'');assert.equal(s.save.customers.active.status,'offered');const request=s.save.customers.active,style=CUSTOM_STYLES.find(style=>style.id===request.style);assert.ok(['cream','jewelry'].includes(style.id));
 await page.screenshot({path:dir+'/home-arrival.png'});await button('顾客定制');await page.screenshot({path:dir+'/offer.png'});await button('接受定制');assert.equal((await state()).screen,'craft');
 for(let i=0;i<6;i++){const tile=(await state()).crafting.materials[0];await tap(tile.x,tile.y);}await page.waitForTimeout(1000);s=await state();assert.equal(s.customers.draft.ok,true);assert.equal(s.save.draft.filter(Number.isInteger).length,6);
 await page.screenshot({path:dir+'/craft-progress.png'});await button('完成制作');await page.screenshot({path:dir+'/packing.png'});await button('保存并交付定制');
 s=await state();assert.equal(s.modal,'customer-receipt');assert.equal(s.save.coins,80+style.reward);assert.equal(s.save.rep,12);assert.equal(s.save.inventory[0],6);assert.equal(s.save.gatheredStock[0],6);assert.equal(s.save.customers.active,null);assert.ok(s.save.customers.nextAt>Date.now()+55000);assert.deepEqual(s.save.commerce.works[0].commission,{id:request.id,style:request.style});
 const start=await coinState(page);assert.equal(start.length,7);await page.screenshot({path:dir+'/receipt.png'});await page.waitForTimeout(190);const mid=await coinState(page);assert.ok(mid.some(coin=>{const old=start.find(o=>o.id===coin.id);return old&&coin.y>old.y+20;}));await page.waitForTimeout(1000);assert.equal((await coinState(page)).length,0);
 await button('收好这份心意');await page.screenshot({path:dir+'/sold.png'});assert.equal(await page.getByRole('button',{name:'收钱 · 1',exact:true}).count(),0);
 const paid=s.save.coins,inventory=s.save.inventory;await page.reload({waitUntil:'networkidle'});await ui.ready();s=await state();assert.equal(s.save.coins,paid);assert.deepEqual(s.save.inventory,inventory);assert.equal(s.save.commerce.works[0].commission.style,style.id);
 await tap(648,1210);assert.equal((await state()).album.items.length,1);await page.screenshot({path:dir+'/gallery.png'});
 // A single-bead free work can still be saved and listed normally alongside commissions.
 await action('手作');let tile=(await state()).crafting.materials[0];await tap(tile.x,tile.y);await button('完成制作');await button('保存并上架');assert.equal((await state()).modal,'listing');await button('确认上架');assert.equal((await state()).save.commerce.works[1].status,'listing');assert.equal((await state()).save.coins,paid);report.randomArrivalAndNativeCraft=true;report.atomicMaterialsAndReward=true;report.coinFlight=true;report.reloadAndGallery=true;report.freeDiyAndListingPreserved=true;await ui.context.close();

 // Existing works: mismatches cannot be submitted, pagination and confirmation preserve all materials.
 for(const [width,height] of [[360,740],[1440,900]]){
  let prepared={...initial(),reduced:true,inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true)};
  for(const type of [24,0,12,0])prepared=finishWork({...prepared,draft:Array(6).fill(type)},1000+type);
  prepared=offered({...prepared,draft:[0,12,...Array(10).fill(null)]},'forest');const ui=await fixture(normalizeSave(prepared),{width,height});
  const before=(await ui.state()).save;await ui.button('顾客定制');await ui.button('接受定制');assert.deepEqual((await ui.state()).save.draft,before.draft);assert.equal((await ui.state()).customers.draft.ok,false);
  await ui.page.screenshot({path:dir+'/forest-progress-'+width+'.png'});await ui.button('返回售珠');await ui.button('顾客定制');await ui.button('挑选已有作品');await ui.button('选这件 · 4');assert.equal((await ui.state()).modal,'customer-works');assert.equal((await ui.state()).save.coins,before.coins);
  await ui.page.screenshot({path:dir+'/existing-locked-'+width+'.png'});await ui.button('下一批');await ui.button('上一批');assert.equal((await ui.state()).modal,'customer-works');assert.ok(await ui.page.getByRole('button',{name:'选这件 · 4',exact:true}).count());await ui.button('下一批');await ui.page.screenshot({path:dir+'/existing-match-'+width+'.png'});await ui.button('选这件 · 1');assert.equal((await ui.state()).modal,'customer-confirm');await ui.page.screenshot({path:dir+'/confirm-'+width+'.png'});
  await ui.button('×');assert.equal((await ui.state()).save.commerce.works[0].status,'ready');await ui.button('顾客定制');await ui.button('挑选已有作品');await ui.button('下一批');await ui.button('选这件 · 1');await ui.button('交付并收款');
  const after=(await ui.state()).save;assert.equal(after.coins,before.coins+240);assert.equal(after.rep,before.rep+12);assert.deepEqual(after.inventory,before.inventory);assert.deepEqual(after.gatheredStock,before.gatheredStock);assert.deepEqual(after.draft,before.draft);assert.equal(after.commerce.works.filter(work=>work.status==='ready').length,3);assert.equal(after.commerce.works[0].buyer,'许老师');assert.deepEqual(await coinState(ui.page),[]);
  await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.equal((await ui.state()).save.coins,after.coins);assert.equal((await ui.state()).save.commerce.works[0].commission.style,'forest');await ui.context.close();
 }
 report.existingWorkDelivery=true;report.mismatchAndConfirmation=true;report.reducedMotion=true;report.widths=[360,390,1440];

 for(const accepted of [false,true]){
  let seed=offered({...initial(),reduced:true,draft:[0,...Array(11).fill(null)]},'crystal');if(accepted)seed.customers.active.status='accepted';
  const ui=await fixture(seed),before=(await ui.state()).save;await ui.button('顾客定制');await ui.page.screenshot({path:dir+'/crystal-'+(accepted?'accepted':'offer')+'.png'});
  if(accepted){await ui.button('取消这份定制');await ui.button('继续这份定制');assert.equal((await ui.state()).save.customers.active.status,'accepted');await ui.button('取消这份定制');await ui.button('确认取消定制');}else await ui.button('婉拒这位顾客');
  let after=(await ui.state()).save;assert.equal(after.customers.active,null);assert.ok(after.customers.nextAt>Date.now()+55000);for(const key of ['coins','rep','inventory','gatheredStock','draft','commerce'])assert.deepEqual(after[key],before[key]);
  await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.equal((await ui.state()).save.customers.active,null);await ui.context.close();
 }
 report.declineCancelAndCooldown=true;assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Customers passed: timed arrival, accept, native stock-backed DIY/direct delivery, existing work/style rejection/pagination, one payment, coin motion, cancellation, normal DIY/listing, gallery/reload and three widths.');
}catch(error){console.error(JSON.stringify({errors}));throw error;}finally{await browser.close();}
