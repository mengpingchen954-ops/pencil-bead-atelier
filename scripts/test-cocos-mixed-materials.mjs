import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gatheredMaterials,freshSave,normalizeSave,findMove,total,draftCounts,deliver} from '../cocos/assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice,priceBounds} from '../cocos/assets/scripts/commerce.ts';
import {ORDERS,MATERIALS} from '../cocos/assets/scripts/content.ts';
import {materialPalette,charmType} from '../cocos/assets/scripts/materials.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.MIXED_ARTIFACTS||'artifacts/mixed-materials';
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
const names=['珠宝','水晶','木质','饰品'];
try{
 const initial={...freshSave(),started:true,sound:false,music:{enabled:false,track:'glimmer',volume:0}};
 for(const level of [1,3,5,6,18]){
  const ui=await fixture({...initial,level});await ui.button('消除采珠');const start=await ui.page.getByRole('button',{name:/^开始采珠 · /}).textContent();await ui.button(start);let s=await ui.state();
  assert.deepEqual([...new Set(s.session.board.map(t=>MATERIALS[s.session.materialTypes[t]].category))].sort(),[0,1,2,3]);
  assert.deepEqual(s.session.materialTypes,materialPalette(level));assert.ok([0,7,8,6,9,10].includes(s.session.materialTypes[0]));assert.ok([19,16,15,18].includes(s.session.materialTypes[1]));const dark=new Set([1,14,17,20,21,22,25,27,28,29,31,32,34,35]);assert.ok(s.session.board.filter(slot=>dark.has(s.session.materialTypes[slot])).length<32);
  // Read the actual native sprites, rather than inferring appearance from model IDs.
  const artwork=await ui.page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return g.boardNodes.map(n=>n.children.map(c=>c.getComponent(cc.Sprite)?.spriteFrame?.name).filter(Boolean));});
  s.session.board.forEach((t,i)=>{const type=s.session.materialTypes[t],m=MATERIALS[type],name=m.id?'charm-'+m.id:'bead-'+type;assert.ok(artwork[i].includes(name),name+' must be rendered on '+i);});
  await ui.page.screenshot({path:dir+'/mixed-level-'+level+'.png'});
  // Collect the rarer materials through real limited tools, then ordinary swaps for the main categories.
  for(const category of [2,3]){
   s=await ui.state();if(s.session.collected.some((n,i)=>n>0&&MATERIALS[s.session.materialTypes[i]].category===category))continue;
   const i=s.session.board.findIndex(t=>MATERIALS[s.session.materialTypes[t]].category===category);assert.ok(i>=0);
   await ui.button('小木槌 '+s.session.tools.hammer);await ui.tap(48+i%8*78+36,340+Math.floor(i/8)*78+36);
   await ui.page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:12000});
  }
  for(let turn=0;turn<32;turn++){
   s=await ui.state();if(s.modal==='result')break;
   const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);for(const i of pair)await ui.tap(48+i%8*78+36,340+Math.floor(i/8)*78+36);
   await ui.page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy,{},{timeout:12000});
  }
  s=await ui.state();assert.equal(s.modal,'result');assert.ok([13,14].includes(total(s.save.inventory)));assert.ok([3,4].includes(s.save.inventory.filter(Boolean).length));const expected=Array(48).fill(0);gatheredMaterials(s.session).forEach((n,i)=>expected[s.session.materialTypes[i]]=n);
  assert.deepEqual(s.save.inventory,expected);assert.deepEqual(s.save.gatheredStock,expected);assert.ok(expected.every((n,i)=>n===0||s.session.materialTypes.includes(i)));
  if(s.modal==='result')await ui.escape();else{await ui.button('暂停');await ui.button('返回店铺');await ui.button('确认返回店铺');}
  if((await ui.state()).screen!=='craft')await ui.button('自由 DIY');
  for(let c=0;c<4;c++){await ui.button(names[c]);const earned=expected.findIndex((n,i)=>n>0&&MATERIALS[i].category===c);if(earned<0){const tiles=(await ui.state()).crafting.materials.filter(m=>m.category===c);assert.ok(tiles.every(m=>!m.unlocked));continue;}const tile=(await ui.state()).crafting.materials[earned];assert.equal(tile.unlocked,true);assert.equal(tile.stock,expected[earned]);await ui.tap(tile.x,tile.y);const after=await ui.state();assert.ok(after.save.draft.includes(earned));}
  await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.deepEqual((await ui.state()).save.inventory,expected);await ui.context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,levels:[1,3,5,6,18],nativeSpritesAllCategories:true,paleMaterialsDominate:true,actualEliminatedStock:true,onlyAwardedMaterialsUnlock:true,reloadPreserved:true,errors},null,2));console.log('Mixed materials passed: four categories visibly present on every tested board, correct real rewards, DIY availability follows the final stage inventory, and reload preserves stock.');
}finally{await browser.close();}
