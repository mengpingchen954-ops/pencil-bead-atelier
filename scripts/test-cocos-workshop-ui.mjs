import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
import {finishWork} from '../cocos/assets/scripts/commerce.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8347/';
const out=process.env.WORKSHOP_ARTIFACTS||'artifacts/workshop-ui';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const width of [360,390,540,1440]){
  const mobile=width<600,context=await browser.newContext({viewport:{width,height:mobile?900:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  let seed={...freshSave(),started:true,reduced:true,sound:false,music:{enabled:false,volume:0,track:'glimmer'},inventory:Array(MATERIALS.length).fill(40),gatheredStock:Array(MATERIALS.length).fill(40),materialUnlocked:Array(MATERIALS.length).fill(true),firstSteps:{craft:1,firstGather:1}};
  seed=finishWork({...seed,draft:[7,52,107,83,110,0,142,119,126,127,128,146],draftSizes:Array(12).fill(8)},1000);
  seed.draft=[];seed.draftSizes=[];seed.draftFacings=[];
  seed.inventory[5]=seed.gatheredStock[5]=0;seed.customers.active={id:1,style:'cream',buyer:'林阿姨',status:'accepted',createdAt:1000};
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},seed);
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
  const tap=async(x,y)=>{const p=await xy(x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(120);};
  const button=async name=>{
   const p=await game((g,cc,name)=>{const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);
  };
  const shot=async name=>{await page.waitForTimeout(180);await page.screenshot({path:out+'/'+name+'-'+width+'.png'});};
  await button('自由 DIY');assert.equal((await state()).screen,'craft');await shot('手串工坊');
  assert.ok(await game(g=>!!g.textures.get('pencil-diy-stage')&&!!g.textures.get('pencil-diy-plate')));
  const originalStock=(await state()).save.inventory;
  for(const type of [0,1,2,3,4,0]){const m=(await state()).crafting.materials[type];await tap(m.x,m.y);}
  let s=await state();assert.equal(s.save.draft.length,6);assert.deepEqual(s.save.inventory,originalStock);
  const empty=s.crafting.materials[5];await tap(empty.x,empty.y);assert.equal((await state()).save.draft.length,6);
  const source=await xy(s.crafting.materials[0].x,s.crafting.materials[0].y),target=await xy(360,451);
  if(mobile){
   const cdp=await context.newCDPSession(page),point=p=>({x:p.x,y:p.y,id:1});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(source)]});await page.waitForTimeout(400);
   for(let step=1;step<=8;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point({x:source.x+(target.x-source.x)*step/8,y:source.y+(target.y-source.y)*step/8})]});await page.waitForTimeout(20);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{await page.mouse.move(source.x,source.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:10});await page.mouse.up();}
  await page.waitForTimeout(180);assert.equal((await state()).save.draft.length,7);await button('工具');await button('撤销');assert.equal((await state()).save.draft.length,6);
  let p=await game(g=>g.slotPos(0));await tap(p.x,p.y);await button('+');assert.equal((await state()).save.draftSizes[0],9);
  await button('工具');await button('撤销');assert.equal((await state()).save.draftSizes[0],8);
  await button('工具');await button('预览');assert.equal((await state()).modal,'craft-preview');await button('×');
  await button('水晶');await game((g,cc)=>g.page.getChildByName('Material viewport').getComponent(cc.ScrollView).scrollToOffset(new cc.Vec2(0,100),.01));await page.waitForTimeout(100);
  await button('木质');await button('水晶');assert.ok(Math.abs((await state()).crafting.scrollOffset-100)<.01);await button('珠宝');
  p=await game(g=>g.slotPos(1));await tap(p.x,p.y);await button('删除选中材质');assert.equal((await state()).save.draft.length,5);await button('工具');await button('撤销');assert.equal((await state()).save.draft.length,6);
  await shot('手串工坊串珠');
  const draft=(await state()).save.draft;await button('完成制作');assert.equal((await state()).screen,'packing');await button('返回修改');assert.deepEqual((await state()).save.draft,draft);
  await button('菜单');assert.equal((await state()).modal,'pause');await button('继续游戏');assert.deepEqual((await state()).save.draft,draft);
  const custom=await game((g,cc)=>g.page.children.find(n=>n.name.startsWith('Button: 定制：')).name.slice(8));await button(custom);assert.equal((await state()).modal,'customer');await button('×');
  await game(g=>g.navigate('album'));await page.getByRole('button',{name:'欣赏作品 · 1',exact:true}).dispatchEvent('click');await page.waitForTimeout(120);assert.equal((await state()).modal,'free-work');
  await shot('作品放大');
  const inspect=()=>game((g,cc)=>{
   const group=g.overlay.getChildByName('Enlarged work'),origin=g.overlay.getComponent(cc.UITransform);if(!group||!Number.isFinite(group.scale.x))throw Error('Invalid enlarged work');
   for(const n of group.children){const t=n.getComponent(cc.UITransform);for(const x of [-t.anchorPoint.x*t.width,(1-t.anchorPoint.x)*t.width])for(const y of [-t.anchorPoint.y*t.height,(1-t.anchorPoint.y)*t.height]){
    const p=origin.convertToNodeSpaceAR(t.convertToWorldSpaceAR(new cc.Vec3(x,y)));if(p.x<159.9||p.x>560.1||-p.y<349.9||-p.y>732.1)throw Error('Enlarged work overflow '+n.name);
   }}return group.children.filter(n=>n.getComponent(cc.Sprite)).length;
  });assert.equal(await inspect(),seed.commerce.works[0].beads.length);
  const before=(await state()).save;await button('×');assert.equal((await state()).modal,'');assert.deepEqual((await state()).save,before);
  await page.getByRole('button',{name:'欣赏作品 · 1',exact:true}).dispatchEvent('click');await button('编辑名称');assert.equal((await state()).modal,'work-name');
  await page.getByRole('textbox',{name:'作品名称'}).fill('清风有约');await button('保存名称');assert.equal((await state()).save.commerce.works[0].name,'清风有约');assert.equal((await state()).modal,'free-work');
  await shot('作品放大改名');await button('再做一条');s=await state();assert.equal(s.screen,'craft');assert.deepEqual(s.save.draft,seed.commerce.works[0].beads);assert.deepEqual(s.save.inventory,originalStock);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');s=await state();assert.equal(s.save.commerce.works[0].name,'清风有约');assert.deepEqual(s.save.draft,seed.commerce.works[0].beads);
  await button('参加比赛');assert.equal((await state()).screen,'contest');await shot('参加比赛未邀请');
  assert.equal(await page.getByRole('button',{name:'报名参加',exact:true}).count(),0);
  await game(g=>{g.save.completed=['daisy','sea','rose','forest','violet'];g.render();});
  const contestCoins=(await state()).save.coins,freeDraft=(await state()).save.draft;await button('报名参加');assert.equal((await state()).screen,'contestCraft');
  await game(g=>{g.save.competitions.draft.beads=[3,3,3,3,3,3,3,3,5,5,5,5];g.render();});await button('提交参赛作品');assert.equal((await state()).modal,'contest-submit');
  await button('提交评审');assert.equal((await state()).modal,'contest-result');assert.equal((await state()).save.coins,contestCoins+84);await button('收好这份纪念');
  await shot('参加比赛');await button('查看参赛作品');assert.equal((await state()).modal,'contest-result');assert.equal((await state()).save.coins,contestCoins+84);await button('收好这份纪念');
  await button('报名参加');assert.equal((await state()).save.competitions.draft.id,'sea');assert.deepEqual((await state()).save.draft,freeDraft);await button('返回比赛');
  await button('继续参赛');assert.equal((await state()).screen,'contestCraft');assert.equal((await state()).save.competitions.draft.id,'sea');await button('返回比赛');
  console.log('PASS workshop and enlarged work at width '+width);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS live/depleted materials, touch/mouse drag, size/undo, tools, preview, commission, scroll, packing/return, pause, framed work, rename/remake, reload, contest invitations/submission/results/resume; no runtime/resource errors.');
}finally{await browser.close();}
