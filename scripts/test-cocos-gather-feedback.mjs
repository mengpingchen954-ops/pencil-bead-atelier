import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,findMove,move,total,gatheredMaterials} from '../cocos/assets/scripts/model.ts';
import {MATERIALS} from '../cocos/assets/scripts/content.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.GATHER_ARTIFACTS||'artifacts/gather-feedback';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[];
async function fixture(width,height,reduced=false){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const save={...freshSave(),level:19,started:true,reduced,sound:false,music:{enabled:false,track:'glimmer',volume:0}};
 await page.addInitScript(save=>{if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));},save);
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280),px=b.x+b.width/2+(x-360)*s,py=b.y+b.height/2+(y-640)*s;
  if(width<600)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);
 };
 const cell=async i=>tap(48+i%8*78+36,340+Math.floor(i/8)*78+36);
 const button=async name=>{
  const p=await page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name||(name==='返回售珠'&&/^Button: 返回(小店|图鉴|故事|人物|手账|装修)$/.test(n.name)))return n;for(const child of n.children){const found=find(child);if(found)return found;}return null;};
   const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing button '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};
  },name);await tap(p.x,p.y);await page.waitForTimeout(40);
 };
 const settled=()=>page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:20000});
 const effects=()=>page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
  return {beads:(g.gatherEffects?.children||[]).filter(n=>n.name.startsWith('Gather bead ')).map(n=>({id:n.uuid,x:n.position.x,y:-n.position.y,art:n.getComponent(cc.Sprite)?.spriteFrame?.name})),
   text:(g.gatherEffects?.getChildByName('Gather count')?.getComponentsInChildren(cc.Label)||[]).map(l=>l.string),
   result:(g.modal==='result'?g.overlay.getComponentsInChildren(cc.Label):[]).map(l=>l.string)};
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');await page.waitForTimeout(200);
 await button('消除采珠');const start=await page.getByRole('button',{name:/^开始采珠 · /}).textContent();await button(start);
 return {context,page,state,tap,cell,button,settled,effects};
}
async function verifyCollection(ui,action,reduced=false){
 const before=await ui.state();await action();await ui.settled();const after=await ui.state(),gains=gatheredMaterials(after.session).map((n,i)=>n-gatheredMaterials(before.session)[i]),amount=total(gains),effects=await ui.effects();
 assert.deepEqual(effects.text,amount?['本关采集 +'+amount+' 颗']:[]);assert.equal(total(after.save.inventory)-total(before.save.inventory),amount);
 const expected=[...before.save.inventory];after.session.collected.forEach((n,i)=>expected[after.session.materialTypes[i]]+=gains[i]);
 assert.deepEqual(after.save.inventory,expected);assert.deepEqual(after.save.gatheredStock,expected);
 if(reduced||!amount)assert.deepEqual(effects.beads,[]);else{
  assert.ok(effects.beads.length>0&&effects.beads.length===Math.min(10,amount));
  const arts=new Set(after.session.collected.flatMap((n,i)=>{if(!gains[i])return [];const t=after.session.materialTypes[i],m=MATERIALS[t];return [m.id?'charm-'+m.id:'bead-'+t];}));
  effects.beads.forEach(b=>assert.ok(arts.has(b.art),b.art));
 }
 return {amount,after,effects};
}
async function finish(ui,reduced=false){
 let final;
 for(let turn=0;turn<32;turn++){
  const s=await ui.state();assert.equal(s.session.status,'playing');
  const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);
  final=await verifyCollection(ui,async()=>{for(const i of pair)await ui.cell(i);},reduced);
  if(final.after.modal==='result')break;
  assert.equal(final.amount,0);assert.equal(total(final.after.save.inventory),0);
 }
 const {after,amount,effects}=final,kinds=after.save.inventory.filter(Boolean).length;
 assert.equal(after.modal,'result');assert.equal(amount,total(gatheredMaterials(after.session)));assert.ok([3,4].includes(kinds));
 assert.ok(effects.result.some(t=>t.startsWith('本关获得 '+kinds+' 种珠材，共 '+amount+' 颗')));
 assert.equal(effects.result.filter(t=>/^\+[1-9]\d*$/.test(t)).length,kinds);assert.ok(!effects.result.includes('+0'));
 return final;
}
try{
 const results=[];
 for(const [width,height] of [[390,844],[1440,900]]){
  const ui=await fixture(width,height),{page,state,cell,button,settled,effects}=ui;
  let s=await state(),invalid;
  for(let i=0;i<63&&!invalid;i++){const j=i%8<7?i+1:i+8;if(j<64&&!move(s.session,i,j).valid)invalid=[i,j];}
  assert.ok(invalid);for(const i of invalid)await cell(i);await settled();assert.deepEqual((await effects()).text,[]);assert.deepEqual((await state()).save.inventory,s.save.inventory);
  await button('重新排珠 '+s.session.tools.shuffle);await settled();assert.deepEqual((await effects()).text,[]);
  s=await state();await verifyCollection(ui,async()=>{await button('小木槌 '+s.session.tools.hammer);await cell(27);});
  s=await state();await verifyCollection(ui,async()=>{await button('花开十字 '+s.session.tools.bloom);await cell(35);});
  // Restart abandons raw clears without awarding a partial pack.
  await button('暂停');await button('重新开始');await button('重开本关 · 1 体力');assert.equal(total((await state()).save.inventory),0);
  const final=await finish(ui);results.push({width,kinds:final.after.save.inventory.filter(Boolean).length,total:final.amount,status:final.after.session.status});
  await page.screenshot({path:dir+'/flight-start-'+width+'.png'});
  await page.waitForTimeout(260);const middle=await effects();
  assert.ok(middle.beads.some(n=>{const old=final.effects.beads.find(o=>o.id===n.id);return old&&n.y<old.y-30;}),'materials move upward toward the pearl header');
  await page.screenshot({path:dir+'/flight-up-'+width+'.png'});
  await page.waitForFunction(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return g.gatherEffects.children.some(n=>n.name.startsWith('Gather bead ')&&-n.position.y<150);},{},{timeout:2000});
  await page.screenshot({path:dir+'/flight-header-'+width+'.png'});await page.waitForTimeout(1350);assert.deepEqual((await effects()).beads,[]);assert.deepEqual((await effects()).text,[]);
  await page.screenshot({path:dir+'/result-'+width+'.png'});
  const inventory=final.after.save.inventory;await button(final.after.session.status==='won'?'去串手串':'带着珠材回制作');assert.deepEqual((await state()).save.inventory,inventory);
  // Exiting the next unfinished run preserves only previously earned property.
  if((await state()).screen==='craft')await button('返回售珠');await ui.tap(72,1210);
  await button('消除采珠');await button(await page.getByRole('button',{name:/^开始采珠 · /}).textContent());
  s=await state();for(const i of findMove(s.session.board,s.session.specials,s.session.obstacles))await cell(i);await settled();
  assert.equal((await state()).session.status,'playing');assert.deepEqual((await state()).save.inventory,inventory);
  await button('暂停');await button('返回店铺');await button('确认返回店铺');assert.deepEqual((await effects()).beads,[]);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');assert.deepEqual((await state()).save.inventory,inventory);await ui.context.close();
 }
 const ui=await fixture(390,844,true),final=await finish(ui,true);results.push({reduced:true,total:final.amount,kinds:final.after.save.inventory.filter(Boolean).length});
 await ui.page.screenshot({path:dir+'/result-reduced.png'});await ui.button(final.after.session.status==='won'?'去串手串':'带着珠材回制作');assert.equal(total((await ui.state()).save.inventory),final.amount);assert.deepEqual((await ui.effects()).text,[]);await ui.context.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,results,nativeTouchAndMouse:true,actualSprites:true,upwardFlights:true,cappedParticles:true,terminalBudget:true,noMidRunRewards:true,toolsAndInvalidAndShuffle:true,restartAndEarlyExit:true,reducedMotion:true,cleanup:true,reloadPreservesStock:true,noDuplicateStock:true,errors},null,2));
 console.log('Gather feedback passed: final level-scaled win/loss rewards, end-only inventory/flights, touch/mouse, restart/exit, reduced motion, result and reload without duplicates.');
}finally{await browser.close();}
