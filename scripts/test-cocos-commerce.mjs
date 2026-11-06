import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,normalizeSave,findMove,total,draftCounts,deliver} from '../cocos/assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice,priceBounds} from '../cocos/assets/scripts/commerce.ts';
import {ORDERS,MATERIALS} from '../cocos/assets/scripts/content.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.COMMERCE_ARTIFACTS||'artifacts/commerce';
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
async function gather(ui,minimum=1){
 const {state,tap,button,page}=ui;await button('消除采珠');assert.equal((await state()).modal,'intro');
 const label=await page.getByRole('button',{name:/^开始采珠 · /}).textContent();await button(label);
 assert.equal((await state()).session.freeGather,true);assert.equal((await state()).session.rewardOrder,null);
 for(let turn=0;turn<16;turn++){
  const s=await state();if(s.session.collected.reduce((n,m,i)=>n+(s.session.materialTypes[i]<36?Math.floor(m/10):0),0)>=minimum||s.modal==='result')break;
  const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);
  for(const index of pair)await tap(48+index%8*78+36,340+Math.floor(index/8)*78+36);
  await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:12000});
 }
 const s=await state();assert.ok(total(s.save.inventory)>0);const expected=Array(48).fill(0);s.session.collected.forEach((n,i)=>expected[s.session.materialTypes[i]]=Math.floor(n/10));assert.deepEqual(s.save.inventory,expected,'Every exchanged bead must already be stored');
 await page.screenshot({path:dir+'/gather.png'});
 if(s.modal==='result')await ui.escape();else{await button('暂停');await button('返回店铺');await button('确认返回店铺');}
 return (await state()).save.inventory;
}
try{
 const initial={...freshSave(),started:true,inventory:Array(48).fill(0),sound:false,music:{enabled:false,track:'glimmer',volume:0}};
 const ui=await fixture(initial),{page,state,tap,button,action,ready}=ui;
 const gathered=await gather(ui);report.gatheringImmediate=true;
 if((await state()).screen!=='home')await action('小店');
 await button('自由 DIY');let s=await state();assert.equal(s.screen,'craft');
 const recipe=[];for(let i=0;i<36;i++)for(let j=0;j<gathered[i]&&recipe.length<12;j++)recipe.push(i);
 for(const type of recipe){const m=(await state()).crafting.materials[type];if((await state()).crafting.category!==m.category)await button(['珠宝','水晶','木质','饰品'][m.category]);await tap(m.x,m.y);}
 await page.waitForTimeout(1100);s=await state();assert.equal(s.save.charm,'none');assert.ok(s.save.draft.some(Number.isInteger));
 const draft=[...s.save.draft],crafted=draft.filter(Number.isInteger),coins=s.save.coins;await page.screenshot({path:dir+'/free-diy.png'});
 await button('完成制作');assert.equal((await state()).screen,'packing');await page.screenshot({path:dir+'/finished.png'});
 await button('返回修改');assert.deepEqual((await state()).save.draft,draft);await button('完成制作');await button('保存并上架');s=await state();
 assert.equal(s.modal,'listing');assert.equal(s.save.coins,coins);assert.equal(s.save.commerce.works.length,1);assert.equal(s.save.commerce.works[0].status,'ready');
 assert.deepEqual(s.save.inventory,gathered.map((n,i)=>n-(draftCounts(crafted)[i]||0)));assert.deepEqual(s.save.commerce.works[0].beads,crafted);assert.equal(s.save.commerce.works[0].charm,'none');
 await button('加价 10');await page.screenshot({path:dir+'/price.png'});await button('确认上架');s=await state();assert.equal(s.save.coins,coins);assert.equal(s.save.commerce.works[0].status,'listing');
 const stock=s.save.inventory;await page.reload({waitUntil:'networkidle'});await ready();await action('售珠');await button('在售 1');
 await page.screenshot({path:dir+'/listing.png'});await button('下架作品 · 1');s=await state();assert.equal(s.sales.tab,'ready');assert.equal(s.save.commerce.works[0].status,'ready');assert.deepEqual(s.save.inventory,stock);
 await button('上架橱窗 · 1');const {min}=priceBounds(crafted);for(let price=suggestedPrice(crafted);price>min;price-=10)await button('降价 10');
 await button('确认上架');const listed=(await state()).save.commerce.works[0];
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.commerce.works[0].status==='sold',{},{timeout:30000});
 s=await state();assert.equal(s.save.coins,coins);assert.equal(s.save.commerce.works[0].claimed,false);await button('已售 1');await button('收钱 · 1');s=await state();assert.equal(s.save.coins,coins+listed.price);assert.equal(s.save.rep,10);assert.deepEqual(s.save.inventory,stock);assert.deepEqual(s.save.completed,[]);
 await button('已售 1');await page.screenshot({path:dir+'/sold.png'});const paid=s.save.coins;
 await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.coins,paid);
 await action('图鉴');assert.equal((await state()).album.items.length,1);await page.screenshot({path:dir+'/collection.png'});
 await tap(207,409);await page.screenshot({path:dir+'/detail.png'});await button('再做一条');assert.deepEqual((await state()).save.draft,crafted);assert.equal((await state()).save.coins,paid);
 report.freeDiyFromGatheredStock=true;report.saveConsumesOnceWithoutIncome=true;report.priceAndWithdrawal=true;report.saleAndReloadPayOnce=true;report.realWorkGallery=true;
 await ui.context.close();

 // A later level must retain every collected material even when the player exits before winning.
 const later=await fixture({...initial,level:4});await gather(later,1);const laterStock=(await later.state()).save.inventory;
 await later.page.reload({waitUntil:'networkidle'});await later.ready();assert.deepEqual((await later.state()).save.inventory,laterStock);report.laterGatheringExitAndReload=true;await later.context.close();

 // Existing progress is preserved while a representative gallery exercises pagination and all navigation widths.
 let old={...freshSave(),started:true,reduced:true,inventory:Array(48).fill(300),gatheredStock:Array(48).fill(300),materialUnlocked:Array(48).fill(true),sound:false,music:initial.music,coins:1342};
 for(const order of ORDERS)old=deliver({...old,draft:[...order.palette],charm:order.charm});old.deliveryReceipt=null;
 for(let i=0;i<8;i++)old=finishWork({...old,draft:Array.from({length:12},(_,j)=>(i+j)%6),charm:['daisy','moon','heart'][i%3]},1000+i);
 old=listWork(old,1,suggestedPrice(old.commerce.works[0].beads),1000);old=settleSales(old,50000);old=listWork(old,2,suggestedPrice(old.commerce.works[1].beads),Date.now()+3600000);
 const archive=JSON.stringify(old.collection),legacy=await fixture(normalizeSave(old));
 const before=(await legacy.state()).save;
 for(const [width,height]of [[360,740],[390,844],[540,960],[1440,900]]){
  await legacy.page.setViewportSize({width,height});await legacy.page.waitForTimeout(250);
  for(const [tab,screen]of [['小店','home'],['售珠','orders'],['手作','craft'],['装修','decor'],['图鉴','album']]){
   if((await legacy.state()).screen==='craft')await legacy.button('返回售珠');
   if(screen==='craft')await legacy.action(tab);else await legacy.tap(['小店','售珠','手作','装修','图鉴'].indexOf(tab)*144+72,1210);
   assert.equal((await legacy.state()).screen,screen);
   if(['orders','album','craft'].includes(screen))await legacy.page.screenshot({path:dir+'/'+screen+'-'+width+'.png'});
   assert.equal(await legacy.page.getByRole('button',{name:'售珠',exact:true}).count(),screen==='craft'?0:1);
  }
 }
 await legacy.action('售珠');await legacy.button('后页 →');assert.equal((await legacy.state()).sales.page,1);await legacy.button('← 前页');assert.equal((await legacy.state()).sales.page,0);
 await legacy.action('图鉴');await legacy.button('后页 →');assert.equal((await legacy.state()).album.page,1);await legacy.button('旧版珍藏');assert.equal((await legacy.state()).album.collected,6);
 assert.equal(JSON.stringify((await legacy.state()).save.collection),archive);assert.deepEqual((await legacy.state()).save,before);report.oldProgressAndCollectionsPreserved=true;report.pagination=true;report.widths=[360,390,540,1440];await legacy.context.close();

 // Opening after a sale's deadline settles without requiring another page or an authenticated connection.
 let offline=finishWork({...initial,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true),draft:Array(12).fill(0)},1000);offline=listWork(offline,1,suggestedPrice(offline.commerce.works[0].beads),1000);
 const reopened=await fixture(offline);assert.equal((await reopened.state()).save.commerce.works[0].status,'sold');assert.equal((await reopened.state()).save.coins,offline.coins);await reopened.action('售珠');await reopened.button('已售 1');await reopened.button('收钱 · 1');const offlineCoins=(await reopened.state()).save.coins;assert.equal(offlineCoins,offline.coins+offline.commerce.works[0].price);
 await reopened.page.reload({waitUntil:'networkidle'});await reopened.ready();assert.equal((await reopened.state()).save.coins,offlineCoins);await reopened.context.close();report.offlineSettlement=true;
 assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Commerce passed: real native match → inventory → free DIY → save → price → list/withdraw → sale → reload/gallery, later-level gathering, legacy saves, offline settlement and four widths without errors.');
}finally{await browser.close();}


