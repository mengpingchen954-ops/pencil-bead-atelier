import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';

const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/';
const dir=process.env.BEAD_AUDIO_ARTIFACTS||'artifacts/bead-audio/browser';
const key='pencil-bead-atelier-v1',errors=[],cases=[];
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
async function fixture(save,width=390){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key,save});
 const ready=()=>page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const state=async()=>JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
 const button=async name=>{
  await page.waitForTimeout(60);
  const p=await page.evaluate(async name=>{
   const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
   const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const child of n.children){const result=find(child);if(result)return result;}return null;};
   const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing native button '+name);
   const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.contentSize.width/2,-t.contentSize.height/2));return {x:p.x+360,y:640-p.y};
  },name);
  const b=await page.locator('#GameCanvas').boundingBox(),scale=Math.min(b.width/720,b.height/1280);
  const x=b.x+b.width/2+(p.x-360)*scale,y=b.y+b.height/2+(p.y-640)*scale;
  if(width===390)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
 };
 const escape=async()=>{await page.locator('#GameCanvas').focus();await page.keyboard.press('Escape');};
 await page.goto(base,{waitUntil:'networkidle'});await ready();
 return {context,page,state,button,escape,ready};
}
async function tapNode(ui,name){
 const p=await native(ui.page,"const walk=n=>{if(!n.active)return null;if(n.name===arg)return n;for(const c of n.children){const f=walk(c);if(f)return f;}return null;};const n=walk(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+arg);const t=n.getComponent(cc.UITransform),v=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:v.x+360,y:640-v.y};",name);
 const b=await ui.page.locator('#GameCanvas').boundingBox(),k=Math.min(b.width/720,b.height/1280),x=b.x+b.width/2+(p.x-360)*k,y=b.y+b.height/2+(p.y-640)*k;
 if(ui.page.viewportSize().width===390)await ui.page.touchscreen.tap(x,y);else await ui.page.mouse.click(x,y);await ui.page.waitForTimeout(60);
}
async function native(page,fn,arg){return page.evaluate(async ({fn,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return Function('g','cc','arg',fn)(g,cc,arg);},{fn,arg});}
try{
 for(const width of [390,1440]){
  const save={...freshSave(),started:true,sound:true,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true),music:{enabled:false,track:'glimmer',volume:0},customers:{nextId:2,nextAt:0,lastStyle:'',active:{id:1,style:'jewelry',buyer:'林阿姨',status:'accepted',createdAt:1000}}};
  const ui=await fixture(save,width);await ui.button('自由 DIY');
  const instrument=()=>native(ui.page,"window.impacts=[];const play=g.sound.playOneShot.bind(g.sound);g.sound.playOneShot=(clip,volume)=>{const n=g.craftMotion.children[0];window.impacts.push({name:clip.name,volume,at:performance.now(),position:n?{x:n.position.x,y:n.position.y}:null});play(clip,volume);};return Array.from(g.sounds.keys()).filter(k=>k.startsWith('bead-'));");
  assert.equal((await instrument()).length,5);
  const read=()=>ui.page.evaluate(()=>window.impacts);const labels=()=>native(ui.page,"return g.page.getComponentsInChildren(cc.Label).map(l=>l.string)");
  assert.equal((await labels()).some(s=>/自由手作 ·|已可完成 ·|保存时按实际用料/.test(s)),false);
  await tapNode(ui,'Bead material 0');await ui.page.waitForTimeout(1050);let events=await read();assert.equal(events.length,2);assert.ok(events.every(e=>e.name.startsWith('bead-glass-')));assert.equal(events[0].volume,.55);assert.equal(events[1].volume,.2);assert.ok(Math.abs(events[0].position.x-319)<2&&Math.abs(events[0].position.y+369)<2);assert.ok(events[1].at>events[0].at);assert.equal((await ui.state()).save.draft.filter(t=>t===0).length,1);assert.equal((await ui.state()).save.inventory[0],20);
  await ui.page.screenshot({path:dir+'/landed-'+width+'.png'});assert.equal((await labels()).some(s=>/已可完成 ·|保存时按实际用料/.test(s)),false);
  await ui.button('木质');await tapNode(ui,'Bead material 24');await ui.page.waitForTimeout(1050);assert.ok((await read()).slice(-2).every(e=>e.name==='bead-wood-1'));
  await ui.button('饰品');await tapNode(ui,'Bead material 36');await ui.page.waitForTimeout(1050);assert.ok((await read()).slice(-2).every(e=>e.name==='bead-metal-1'));
  await native(ui.page,"g.save.sound=false;window.impacts=[]");await ui.button('珠宝');await tapNode(ui,'Bead material 3');await ui.page.waitForTimeout(1050);assert.equal((await read()).length,0);
  await native(ui.page,"g.save.sound=true;g.save.reduced=true;window.impacts=[]");await tapNode(ui,'Bead material 5');assert.equal((await read()).length,1);assert.equal((await ui.state()).crafting.flights.length,0);
  const before=(await ui.state()).save;await ui.page.reload({waitUntil:'networkidle'});await ui.ready();assert.deepEqual((await ui.state()).save.draft,before.draft);assert.deepEqual((await ui.state()).save.inventory,before.inventory);await ui.context.close();cases.push({width,contactSynchronized:true,materialSounds:true,mute:true,reduced:true,reload:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,cases,errors},null,2));console.log('Bead audio native checks passed.');
}finally{await browser.close();}
