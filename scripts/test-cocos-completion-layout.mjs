import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
import {priceBounds,saleDuration} from '../cocos/assets/scripts/commerce.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.COMPLETION_ARTIFACTS||'artifacts/packing-fit/browser';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],report={base,widths:[]};
try{
 for(const width of [360,390,540,1440]){
  const mobile=width<600,context=await browser.newContext({viewport:{width,height:mobile?960:900},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const draft=[52,142,107,83,110,105,144,119,126,127,128,146,108,106,0,14,64],initial={...freshSave(),started:true,rep:320,draft,draftSizes:draft.map((_,i)=>6+i%7),draftFacings:draft.map((_,i)=>i%2?'in':'out'),inventory:Array(MATERIALS.length).fill(30),gatheredStock:Array(MATERIALS.length).fill(30),materialUnlocked:Array(MATERIALS.length).fill(true),sound:false,music:{enabled:false,track:'glimmer',volume:0},firstSteps:{craft:1,firstGather:1}};
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},initial);
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280),p={x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);};
  const button=async name=>{const p=await game((g,cc,name)=>{const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);};
  const inspect=async listing=>game((g,cc,listing)=>{
   const group=(listing?g.overlay:g.page).getChildByName(listing?'Listing work':'Packed work');if(!group)throw Error('Missing fitted preview');
   const origin=(listing?g.overlay:g.page).getComponent(cc.UITransform),shift=listing?-g.overlay.getChildByName('Dialog paper').position.y-230:0;
   const limits=listing?{left:165,right:555,top:354+shift,bottom:614+shift}:{left:238,right:482,top:430,bottom:610};let corners=0;
   for(const n of group.children){const t=n.getComponent(cc.UITransform);for(const x of [-t.anchorPoint.x*t.width,(1-t.anchorPoint.x)*t.width])for(const y of [-t.anchorPoint.y*t.height,(1-t.anchorPoint.y)*t.height]){
    const p=origin.convertToNodeSpaceAR(t.convertToWorldSpaceAR(new cc.Vec3(x,y)));if(p.x<limits.left-.02||p.x>limits.right+.02||-p.y<limits.top-.02||-p.y>limits.bottom+.02)throw Error('Overflow '+n.name+' '+p.x+','+-p.y);corners++;
   }}if(group.children.some(n=>/shadow/i.test(n.name)))throw Error('Unexpected jewelry shadow');if(group.getComponent(cc.Mask))throw Error('Preview was clipped');return {corners,materials:group.children.filter(n=>n.getComponent(cc.Sprite)).length};
  },listing);
  await button('自由 DIY');const stock=(await state()).save.inventory,coins=(await state()).save.coins;await button('完成制作');assert.equal((await state()).screen,'packing');assert.ok((await inspect(false)).materials>=draft.length);
  assert.equal(await game(g=>!!g.page.getChildByName('pencil-frame')),false);await page.screenshot({path:dir+'/packing-'+width+'.png'});
  await button('返回修改');assert.deepEqual((await state()).save.draft,draft);await button('完成制作');
  if(width===390){
   const tested=await game((g,cc,count)=>{const original=JSON.stringify(g.save);let cases=0;for(let type=0;type<count;type++)for(const facing of ['in','out']){
    g.save.draft=[type];g.save.draftSizes=[12];g.save.draftFacings=[facing];g.save.charm=type%2?'heart':'none';g.render();const n=g.page.getChildByName('Packed work');if(!n||!Number.isFinite(n.scale.x))throw Error('Invalid fit');
    const origin=g.page.getComponent(cc.UITransform);for(const child of n.children){const t=child.getComponent(cc.UITransform),r=t.getBoundingBoxToWorld();for(const x of [r.xMin,r.xMax])for(const y of [r.yMin,r.yMax]){const p=origin.convertToNodeSpaceAR(new cc.Vec3(x,y));if(p.x<237.9||p.x>482.1||-p.y<429.9||-p.y>610.1)throw Error('Variant overflow '+type+' '+facing);}}cases++;
   }g.save=JSON.parse(original);g.render();return cases;},MATERIALS.length);assert.equal(tested,MATERIALS.length*2);await inspect(false);
  }
  if(width===390||width===1440){
   const original=await game(g=>JSON.stringify(g.save));
   for(const eligible of [false,true]){
    await game((g,cc,eligible)=>{g.save.draft=Array(6).fill(eligible?0:24);g.save.draftSizes=Array(6).fill(8);g.save.draftFacings=Array(6).fill('out');g.save.customers.active={id:1,style:'cream',buyer:'林阿姨',status:'accepted',createdAt:Date.now()};g.render();},eligible);
    await inspect(false);
    await game((g,cc,eligible)=>{const n=g.page.getChildByName('Button: '+(eligible?'保存并交付定制':'查看定制要求')),save=g.page.getChildByName('Button: 保存作品'),t=n.getComponent(cc.UITransform);if(t.height<64||-n.position.y+t.height>-save.position.y-24)throw Error('Crowded commission actions');},eligible);
    await page.screenshot({path:dir+'/packing-'+(eligible?'eligible':'requirements')+'-'+width+'.png'});
    if(!eligible){await button('查看定制要求');assert.equal((await state()).modal,'customer');await game(g=>g.closeModal());}
   }
   await game((g,cc,original)=>{g.save=JSON.parse(original);g.render();},original);
  }
  await button('保存并上架');assert.equal((await state()).modal,'listing');await page.waitForTimeout(150);await inspect(true);await page.screenshot({path:dir+'/listing-'+width+'.png'});
  const work=(await state()).save.commerce.works[0],bounds=priceBounds(work.beads,320),price=()=>game((g,cc)=>Number(g.overlay.getChildByName('Listing price').getComponent(cc.Label).string));
  const p=await price();await button('加价 10');assert.equal(await price(),Math.min(bounds.max,p+10));await button('降价 10');assert.equal(await price(),p);
  await button('高价');assert.equal(await price(),bounds.max);await button('加价 10');assert.equal(await price(),bounds.max);await button('快卖');assert.equal(await price(),bounds.min);await button('降价 10');assert.equal(await price(),bounds.min);await button('建议价');
  await page.getByRole('slider',{name:'作品售价'}).evaluate(el=>{el.value='73';el.dispatchEvent(new Event('input',{bubbles:true}));});const selected=await price();assert.ok(selected>bounds.min&&selected<bounds.max);assert.match(await page.getByRole('slider',{name:'作品售价'}).getAttribute('aria-valuetext'),new RegExp('^'+selected+' 金币'));
  await button('确认上架');let s=await state();assert.equal(s.save.commerce.works[0].price,selected);assert.equal(s.save.commerce.works[0].sellAt-s.save.commerce.works[0].listedAt,saleDuration(work.beads,selected));assert.equal(s.save.coins,coins);assert.deepEqual(s.save.commerce.works[0].beads,draft);
  assert.deepEqual(s.save.inventory,stock.map((n,i)=>n-draft.filter(t=>t===i).length));await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');s=await state();assert.equal(s.save.commerce.works[0].price,selected);assert.deepEqual(s.save.commerce.works[0].beads,draft);
  report.widths.push(width);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({...report,completeSilhouettes:true,all153Facings:true,previewContained:true,noClipping:true,nativeReturnAndSave:true,priceControls:true,slider:true,listAndReload:true,errors},null,2));console.log('Completion/listing layouts passed at 360/390/540/1440: all153 facings contained, full mixed work, return/save, native price steps/presets, slider, listing and reload.');
}finally{await browser.close();}
