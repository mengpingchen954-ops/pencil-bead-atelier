import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.DELETE_ARTIFACTS||'artifacts/customer-dialogue/browser';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],report={base,widths:[]};
try{
 for(const width of [390,540,1440]){
  const mobile=width<600,context=await browser.newContext({viewport:{width,height:width===1440?900:960},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},{...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0},reduced:false,inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),materialUnlocked:Array(48).fill(true),draft:Array.from({length:12},(_,i)=>i),draftSizes:Array(12).fill(8),firstSteps:{craft:1,firstGather:1}});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
  const click=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280),px=b.x+b.width/2+(x-360)*s,py=b.y+b.height/2+(y-640)*s;if(mobile)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);await page.waitForTimeout(60);};
  const button=async name=>{const p=await game((g,cc,name)=>{const n=(g.modal?g.overlay:g.page).getChildByName('Button: '+name);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await click(p.x,p.y);};
  await game(g=>g.navigate('craft'));await page.waitForTimeout(600);
  const before=await game(g=>({radius:g.craftRadius(),stock:g.save.inventory,sizes:g.save.draftSizes,beads:g.save.draft}));
  let p=await game(g=>g.slotPos(5));await click(p.x,p.y);await page.waitForTimeout(240);assert.equal(await game(g=>g.slot),5);
  await page.screenshot({path:dir+'/delete-selected-'+width+'.png'});
  if(mobile)await button('删除选中材质');else{
   await page.evaluate(()=>{const n=document.createElement('input');n.id='typing-test';document.body.append(n);n.focus();});await page.keyboard.press('Delete');assert.equal(await game(g=>g.save.draft.length),12);await page.evaluate(()=>document.getElementById('typing-test').remove());
   await page.locator('#GameCanvas').focus();await page.keyboard.press('Delete');await page.waitForTimeout(60);
  }
  const start=await game(g=>({beads:g.save.draft,radius:g.craftRadius(),flows:g.craftFlows.size,stock:g.save.inventory,sizes:g.save.draftSizes}));
  assert.deepEqual(start.beads,before.beads.filter((_,i)=>i!==5));assert.ok(start.radius<before.radius);assert.ok(start.flows>0);assert.deepEqual(start.stock,before.stock);assert.deepEqual(start.sizes,Array(11).fill(8));
  await page.screenshot({path:dir+'/delete-moving-'+width+'.png'});await page.waitForTimeout(1600);assert.equal(await game(g=>g.craftFlows.size),0);
  await page.screenshot({path:dir+'/delete-settled-'+width+'.png'});await button('撤销');assert.deepEqual(await game(g=>g.save.draft),before.beads);
  // A charm keeps its neighbors' individual sizes/facings, and reload does not restore empty slots.
  await game(g=>{g.save.draft=[0,43,1,43,2];g.save.draftSizes=[12,10,6,9,8];g.save.draftFacings=['out','in','out','out','out'];g.slot=-1;g.render();});
  await page.waitForTimeout(700);p=await game(g=>g.slotPos(1));await click(p.x,p.y);await page.waitForTimeout(240);await button('删除选中材质');
  assert.deepEqual(await game(g=>g.save.draft),[0,1,43,2]);assert.deepEqual(await game(g=>g.save.draftSizes),[12,6,9,8]);assert.deepEqual(await game(g=>g.save.draftFacings),['out','out','out','out']);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');assert.deepEqual(await game(g=>g.save.draft),[0,1,43,2]);
  for(const [buyer,id] of [['林阿姨','lin'],['花店小满','xiaoman'],['许老师','teacher'],['隔壁邻居','neighbor']]){
   await game((g,cc,buyer)=>{g.navigate('home');g.save.customers.active={id:1,buyer,style:'cream',status:'offered',createdAt:1000};g.customerDialog();},buyer);
   await page.waitForFunction(async id=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return !!g.overlay.getChildByName('Customer portrait '+id)?.getComponent(cc.Sprite)?.spriteFrame;},id);
   await page.screenshot({path:dir+'/customer-'+id+'-'+width+'.png'});
  }
  await button('接受定制');assert.equal(await game(g=>g.screen),'craft');assert.equal(await game(g=>g.save.customers.active.status),'accepted');
  await game(g=>g.customerDialog());await page.waitForTimeout(200);await page.screenshot({path:dir+'/customer-accepted-'+width+'.png'});
  await game(g=>g.customerReceipt({buyer:'隔壁邻居',beads:Array(6).fill(0),beadSizes:Array(6).fill(8),charm:'none',commission:{style:'cream'}}));await page.waitForTimeout(200);await page.screenshot({path:dir+'/customer-thanks-'+width+'.png'});
  report.widths.push(width);await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({...report,errors,mobileDelete:true,desktopDelete:true,animatedConvergence:true,undo:true,preservedSizesAndFacings:true,reload:true,fourPortraits:true},null,2));console.log('Delete and dialogue passed at 390, 540 and 1440: real touch/mouse/Delete, animated convergence, undo, charm metadata, reload, and four loaded portraits.');
}finally{await browser.close();}
