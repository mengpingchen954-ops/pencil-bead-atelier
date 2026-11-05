import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice} from '../cocos/assets/scripts/commerce.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.RECEIPT_ARTIFACTS||'artifacts/sale-receipts';
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


function pending(count=4){
 let save={...freshSave(),started:true,reduced:false,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),sound:false,music:{enabled:false,track:'glimmer',volume:0}};
 for(let i=0;i<count;i++){save=finishWork({...save,draft:[i,12+i],draftSizes:[7,11],draftName:'手作 '+(i+1)},1000+i);save=listWork(save,i+1,suggestedPrice([i,12+i]),2000);}
 return save;
}
const flying=ui=>ui.page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (g.coinEffects?.children||[]).filter(n=>n.name.startsWith('Sale coin ')).map(n=>({x:n.position.x+14,y:14-n.position.y,scale:n.scale.x}));});
try{
 for(const [width,height] of [[360,740],[390,844],[1440,900]]){
  const initial=pending(),ui=await fixture(initial,{width,height}),{page,state,button,action,ready}=ui;
  let s=await state();assert.equal(s.save.coins,initial.coins);assert.equal(s.save.rep,40);assert.ok(s.save.commerce.works.every(w=>w.status==='sold'&&w.claimed===false));
  await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.coins,initial.coins);
  await action('售珠');await button('已售 4');await page.screenshot({path:dir+'/pending-'+width+'.png'});
  const before=(await state()).save;await button('收钱 · 4');s=await state();assert.equal(s.save.coins,before.coins+before.commerce.works[3].price);assert.equal(s.save.commerce.works[3].claimed,true);
  const first=await flying(ui);assert.ok(first.length>0);await page.screenshot({path:dir+'/flying-'+width+'.png'});
  await page.waitForTimeout(240);const middle=await flying(ui);assert.ok(middle.length);assert.ok(middle.some(p=>p.y<400),'coins move upward toward the balance');
  await page.screenshot({path:dir+'/flying-up-'+width+'.png'});
  await ui.tap(383,523);assert.equal((await state()).save.coins,s.save.coins);await page.waitForTimeout(1100);assert.deepEqual(await flying(ui),[]);
  await button('收钱 · 3');await button('收钱 · 2');s=await state();assert.equal(s.save.coins,initial.coins+before.commerce.works.slice(1).reduce((sum,w)=>sum+w.price,0));
  assert.deepEqual(s.save.inventory,initial.inventory);assert.deepEqual(s.save.gatheredStock,initial.gatheredStock);assert.equal(s.save.rep,40);
  const paid=s.save.coins;await page.reload({waitUntil:'networkidle'});await ready();s=await state();assert.equal(s.save.coins,paid);assert.equal(s.save.commerce.works[0].claimed,false);assert.deepEqual(await flying(ui),[]);
  await action('售珠');await button('已售 4');assert.equal(await page.getByRole('button',{name:'收钱 · 4',exact:true}).count(),0);await button('后页 →');await button('收钱 · 1');
  assert.equal((await state()).save.coins,paid+before.commerce.works[0].price);await action('图鉴');await page.waitForTimeout(1100);assert.deepEqual(await flying(ui),[]);assert.equal((await state()).album.items.length,4);
  await page.reload({waitUntil:'networkidle'});await ready();assert.ok((await state()).save.commerce.works.every(w=>w.claimed));await ui.context.close();
 }
 // Previously auto-paid works do not become new receipts during migration.
 const legacy=settleSales(pending(1),100000);legacy.coins+=legacy.commerce.works[0].price;delete legacy.commerce.works[0].claimed;
 const old=await fixture(legacy);assert.equal((await old.state()).save.coins,legacy.coins);assert.equal((await old.state()).save.commerce.works[0].claimed,true);await old.action('售珠');await old.button('已售 1');assert.equal(await old.page.getByRole('button',{name:'收钱 · 1',exact:true}).count(),0);await old.context.close();
 // Persist failure leaves the receipt claimable; retry pays once. Reduced motion skips coin flights.
 const reduced=await fixture({...pending(1),reduced:true});await reduced.action('售珠');await reduced.button('已售 1');const before=(await reduced.state()).save;
 await reduced.page.evaluate(()=>{window.receiptOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('receipt storage fixture');};});
 await reduced.button('收钱 · 1');assert.deepEqual((await reduced.state()).save,before);assert.deepEqual(await flying(reduced),[]);
 await reduced.page.evaluate(()=>{Storage.prototype.setItem=window.receiptOriginalSet;});await reduced.button('收钱 · 1');assert.equal((await reduced.state()).save.coins,before.coins+before.commerce.works[0].price);assert.deepEqual(await flying(reduced),[]);await reduced.context.close();
 assert.deepEqual(errors,[]);Object.assign(report,{widths:[360,390,1440],offlineWaits:true,manualClaimOnce:true,coinsFlyUp:true,animationCleanup:true,multipleReceiptsAndPagination:true,reloadRetainsPendingAndPaid:true,oldPaidMigration:true,storageFailureRollback:true,reducedMotion:true,inventoryUnchanged:true,errors});fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Sale receipts passed: offline pending/manual-only payout, native claim, upward coin flight/cleanup, multi-claim/pagination, repeat taps/reload, legacy paid migration, failed storage and reduced motion at360/390/1440 widths.');
}finally{await browser.close();}
