import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.NAMING_ARTIFACTS||'artifacts/work-names';
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

async function enterName(ui,value,y=855){
 await ui.tap(270,y);
 const input=ui.page.locator('input:not([aria-label])');
 await input.waitFor({state:'visible'});
 await input.fill(value);await ui.page.keyboard.press('End');
 await ui.page.keyboard.insertText('f ');await ui.page.keyboard.press('Backspace');await ui.page.keyboard.press('Backspace');
 await ui.tap(360,y+90);
}
try{
 const initial={...freshSave(),started:true,reduced:true,inventory:Array(48).fill(10),gatheredStock:Array(48).fill(10),materialUnlocked:Array(48).fill(true),draft:[0,13,1,43],draftSizes:[6,8,10,12],draftFacings:['out','out','out','in'],sound:false,music:{enabled:false,track:'glimmer',volume:0}};
 for(const [width,height] of [[360,740],[390,844],[1440,900]]){
  const ui=await fixture(initial,{width,height}),{page,button,action,state,ready}=ui;
  await button('自由 DIY');await button('完成制作');assert.equal((await state()).screen,'packing');
  await enterName(ui,'月光与蔷薇');assert.equal((await state()).save.draftName,'月光与蔷薇');
  await page.screenshot({path:dir+'/packing-'+width+'.png'});
  await button('返回修改');await button('完成制作');assert.equal((await state()).save.draftName,'月光与蔷薇');
  await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.draftName,'月光与蔷薇');
  await button('自由 DIY');await button('完成制作');
  await button('随机名称');const random=(await state()).save.draftName;assert.ok(random&&random!=='月光与蔷薇');
  await button('随机名称');assert.notEqual((await state()).save.draftName,random);
  await enterName(ui,'月光与蔷薇');
  const stock=(await state()).save.inventory,coins=(await state()).save.coins;
  await button('保存并上架');let s=await state();assert.equal(s.save.commerce.works[0].name,'月光与蔷薇');assert.equal(s.save.draftName,'');
  await page.screenshot({path:dir+'/listing-name-'+width+'.png'});
  await button('确认上架');s=await state();const work=s.save.commerce.works[0];
  await button('改名 · 1');assert.equal((await state()).modal,'work-name');
  await button('随机名称');await button('取消改名');assert.equal((await state()).save.commerce.works[0].name,'月光与蔷薇');
  await button('编辑名称');await enterName(ui,'  ',611);await button('保存名称');assert.equal((await state()).modal,'work-name');
  await enterName(ui,'星河小梦',611);await page.screenshot({path:dir+'/rename-'+width+'.png'});
  await button('保存名称');s=await state();assert.equal(s.save.commerce.works[0].name,'星河小梦');
  assert.equal(s.save.commerce.works[0].price,work.price);assert.equal(s.save.commerce.works[0].sellAt,work.sellAt);
  assert.deepEqual(s.save.inventory,stock.map((n,i)=>n-(initial.draft.filter(t=>t===i).length)));assert.equal(s.save.coins,coins);
  await ui.escape();await page.screenshot({path:dir+'/sales-'+width+'.png'});
  await action('图鉴');assert.equal((await state()).album.items[0].name,'星河小梦');
  await page.screenshot({path:dir+'/album-'+width+'.png'});
  await page.reload({waitUntil:'networkidle'});await ready();assert.equal((await state()).save.commerce.works[0].name,'星河小梦');
  await action('售珠');s=await state();await button(s.save.commerce.works[0].status==='sold'?'已售 1':'在售 1');
  await button('改名 · 1');await button('随机名称');await button('保存名称');
  assert.notEqual((await state()).save.commerce.works[0].name,'星河小梦');
  await ui.context.close();
 }
 assert.deepEqual(errors,[]);Object.assign(report,{widths:[360,390,1440],manualChinese:true,randomNoRepeat:true,draftReload:true,renameCancelAndBlank:true,listingUnchanged:true,inventoryUnchanged:true,galleryAndReload:true,errors});
 fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('Naming passed: native Chinese input, random names, saved draft, completion/listing, edit/cancel/blank, inventory/prices/times, gallery/reload at 360/390/1440 widths.');
}finally{await browser.close();}
