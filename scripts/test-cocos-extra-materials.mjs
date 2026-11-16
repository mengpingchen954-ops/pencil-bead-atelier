import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,findMove,gatheredMaterials} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';
import {categoryMaterials} from '../cocos/assets/scripts/materials.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.MATERIAL_ARTIFACTS||'artifacts/new-materials/browser';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],report={base,widths:[]};
try{
 for(const width of [390,540,1440]){
  const mobile=width<600,context=await browser.newContext({viewport:{width,height:width===1440?900:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},{...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0},reduced:false,draft:[],firstSteps:{craft:1,firstGather:1}});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
  const tap=async(x,y)=>{const p=await xy(x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(90);};
  const button=async name=>{const p=await game((g,cc,name)=>{const search=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=search(c);if(r)return r;}return null;};const n=search(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name+' '+g.screen+'/'+g.modal);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);};
  const scrollTo=async value=>{await game((g,cc,value)=>g.page.getChildByName('Material viewport').getComponent(cc.ScrollView).scrollToOffset(new cc.Vec2(0,value),.02),value);await page.waitForTimeout(150);};
  const reveal=async type=>{const category=MATERIALS[type].category;await button(['珠宝','水晶','木质','饰品'][category]);const s=await state(),cell=categoryMaterials(category,false,s.save).indexOf(type);await scrollTo(Math.min(s.crafting.maxScroll,Math.floor(cell/4)*100));};
  await button('消除采珠');const label=await page.getByRole('button',{name:/^开始采珠 · /}).textContent();await button(label);
  let s=await state();assert.ok(s.session.materialTypes.some(t=>t>=48));await page.screenshot({path:dir+'/match-'+width+'.png'});
  for(let turn=0;turn<32;turn++){
   s=await state();if(s.modal==='result')break;const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);
   for(const i of pair)await tap(84+i%8*78,376+Math.floor(i/8)*78);await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:15000});
  }
  s=await state();assert.equal(s.modal,'result');const expected=Array(MATERIALS.length).fill(0);gatheredMaterials(s.session).forEach((n,i)=>expected[s.session.materialTypes[i]]=n);assert.deepEqual(s.save.inventory,expected);const earned=expected.findIndex((n,i)=>i>=48&&n>0);assert.ok(earned>=48);
  await page.screenshot({path:dir+'/reward-'+width+'.png'});await game(g=>{g.closeModal();g.navigate('craft');});
  await reveal(earned);s=await state();await tap(s.crafting.materials[earned].x,s.crafting.materials[earned].y);await page.waitForTimeout(1000);assert.equal((await state()).save.draft[0],earned);
  // The complete catalog is a test fixture here; the real earned-stock route above remains separate.
  await game((g,cc,n)=>{g.save.inventory=Array(n).fill(30);g.save.gatheredStock=Array(n).fill(30);g.save.materialUnlocked=Array(n).fill(true);g.save.draft=[];g.slot=-1;g.render();},MATERIALS.length);
  const seen=[];for(let c=0;c<4;c++){
   await button(['珠宝','水晶','木质','饰品'][c]);const max=(await state()).crafting.maxScroll;
   for(let offset=0;offset<=max+299;offset+=300){
    await scrollTo(Math.min(offset,max));s=await state();s.crafting.materials.filter(m=>m.visible).forEach(m=>seen.push(m.type));
    const sprites=await game((g,cc)=>g.page.getChildByName('Material viewport').getChildByName('Material content').children.filter(n=>n.name.startsWith('Bead material ')).map(n=>!!n.children.find(n=>n.getComponent(cc.Sprite))?.getComponent(cc.Sprite)?.spriteFrame));assert.ok(sprites.every(Boolean));
    if(width!==540)await page.screenshot({path:dir+'/category-'+c+'-offset-'+offset+'-'+width+'.png'});
   }
  }assert.equal(new Set(seen).size,MATERIALS.length);
  for(const type of [52,64,112,142,148,120]){
   await reveal(type);await game(g=>{g.slot=-1;g.render();});s=await state();await tap(s.crafting.materials[type].x,s.crafting.materials[type].y);await page.waitForTimeout(1000);assert.equal((await state()).save.draft.at(-1),type);
  }
  await page.screenshot({path:dir+'/mixed-bracelet-'+width+'.png'});let p=await game(g=>g.slotPos(2));await tap(p.x,p.y);await page.waitForTimeout(220);
  if(mobile)await button('删除选中材质');else{await page.locator('#GameCanvas').focus();await page.keyboard.press('Delete');await page.waitForTimeout(60);}
  assert.deepEqual((await state()).save.draft,[52,64,142,148,120]);assert.ok(await game(g=>g.craftFlows.size>0));await page.waitForTimeout(1500);await button('撤销');assert.deepEqual((await state()).save.draft,[52,64,112,142,148,120]);
  // Real pointer/touch dragging reorders a new charm without changing stock or size.
  const start=await game(g=>g.slotPos(2)),end=await game(g=>g.slotPos(4)),a=await xy(start.x,start.y),b=await xy(end.x,end.y),before=(await state()).save.inventory;
  if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*n/10,y:a.y+(b.y-a.y)*n/10}]});await page.waitForTimeout(18);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();}
  await page.waitForTimeout(1200);s=await state();assert.equal(s.save.draft[4],112);assert.deepEqual(s.save.inventory,before);assert.ok(s.save.draftSizes.every(n=>n===8));
  const beads=s.save.draft;await button('完成制作');assert.equal((await state()).screen,'packing');await page.screenshot({path:dir+'/finished-'+width+'.png'});await button('保存并上架');assert.equal((await state()).modal,'listing');await button('确认上架');s=await state();assert.deepEqual(s.save.commerce.works[0].beads,beads);assert.equal(s.save.commerce.works[0].status,'listing');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');assert.deepEqual((await state()).save.commerce.works[0].beads,beads);
  await game(g=>g.inventory());await button('水晶');await game((g,cc)=>g.overlay.getChildByName('Inventory material viewport').getComponent(cc.ScrollView).scrollToOffset(new cc.Vec2(0,300),.02));await page.waitForTimeout(150);assert.ok(await game(g=>g.inventoryScroll[1]>200));await page.screenshot({path:dir+'/inventory-'+width+'.png'});
  report.widths.push(width);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({...report,catalog:MATERIALS.length,nativeMatchRewards:true,continuousCategories:true,allSprites:true,deletionAndUndo:true,drag:true,savedAndListed:true,reload:true,errors},null,2));console.log('New materials passed: native match/rewards, continuous category scrolling, sprite loading, mixed DIY, touch/mouse drag, delete/undo, listing/reload and inventory at 390/540/1440.');
}finally{await browser.close();}
