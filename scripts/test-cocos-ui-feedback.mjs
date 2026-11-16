import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave} from '../cocos/assets/scripts/model.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.FEEDBACK_ARTIFACTS||'artifacts/ui-feedback';
fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],expectedTouchCancelDiagnostics=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
 page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(m.text().includes('Ignored attempt to cancel a touchcancel event with cancelable=false'))expectedTouchCancelDiagnostics.push(m.text());else errors.push(m.text());}});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(save=>localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save)),{...freshSave(),started:true,sound:false,reduced:false,firstSteps:{craft:1,firstGather:1}});
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const game=(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
 const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
 const cdp=await context.newCDPSession(page),touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[await xy(x,y)]});
 const nodeInfo=name=>game((g,cc,name)=>{
  const find=n=>{if(n.name===name&&n.active)return n;for(const child of n.children){const found=find(child);if(found)return found;}return null;},n=find(g.modal?g.overlay:g.page);
  if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));
  return {x:p.x+360,y:640-p.y,scale:n.scale.x,wash:!!n.getChildByName('Press feedback')};
 },name);
 async function press(name,shot){const n=await nodeInfo(name);await touch('touchStart',n.x,n.y);await page.waitForTimeout(70);const pressed=await nodeInfo(name);assert.equal(pressed.scale,.96);assert.equal(pressed.wash,true);if(shot)await page.screenshot({path:dir+'/'+shot+'.png'});return n;}
 const homeIcons=['Button: 珠 0','Resource coins','Button: ♥ 10','Button: ⚙','Music shortcut','Button: 每日签到','Button: 查看售珠橱窗','Button: 作品展示','Button: 自由 DIY','Button: 消除采珠','Story invitation','Button: 故事与手账','Button: 顾客定制','Button: 参加比赛',...['home','orders','craft','decor','album'].map(p=>'Navigate '+p)];
 for(const name of homeIcons){await press(name);await touch('touchCancel');await page.waitForTimeout(240);assert.equal((await nodeInfo(name)).scale,1);assert.equal(await game(g=>g.modal),'');assert.equal(await game(g=>g.screen),'home');}
 await press('Button: ⚙','home-pressed');await touch('touchEnd');await page.waitForTimeout(270);
 assert.equal(await game(g=>g.modal),'settings');assert.equal(await game(g=>g.uiEffects.children.length),0);
 let n=await press('Button: ×','dialog-pressed');await touch('touchMove',n.x-70,n.y+10);await touch('touchEnd');await page.waitForTimeout(300);
 assert.equal(await game(g=>g.modal),'settings');assert.equal((await nodeInfo('Button: ×')).scale,1);
 await press('Button: ×');await touch('touchCancel');await page.waitForTimeout(300);assert.equal(await game(g=>g.modal),'settings');
 await press('Button: ×');await touch('touchEnd');await page.waitForTimeout(260);assert.equal(await game(g=>g.modal),'');
 await press('Navigate album','navigation-pressed');await touch('touchEnd');await page.waitForTimeout(270);assert.equal(await game(g=>g.screen),'album');
 await game(g=>g.navigate('home'));await press('Music shortcut','music-pressed');await touch('touchEnd');await page.waitForTimeout(600);
 assert.equal(await game(g=>g.save.music.track),'calm');
 // Let the real audio player emit ENDED after seeking; no synthetic ended event or direct advance call.
 await game(g=>{window.__musicQA=g.music;});
 await page.waitForFunction(()=>{const m=window.__musicQA,s=m.source;return !m.snapshot().loading&&s._isLoaded&&s._player&&s.duration>1&&s.currentTime>.1&&s.playing;});
 const before=await game(async g=>{const s=g.music.source,duration=s.duration;const info={track:g.save.music.track,duration,loop:s.loop,clip:s.clip?.name,time:s.currentTime,player:s._player?.duration};await s._player.seek(duration-.4);return info;});assert.equal(before.loop,false);assert.ok(before.duration>1);
 try{await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.music.track==='piano',{},{timeout:15000});}catch(error){console.log('Music diagnostic',before,await game(g=>({saved:g.save.music,state:g.music.snapshot(),time:g.music.source.currentTime,duration:g.music.source.duration,hidden:g.music.hidden,player:g.music.source._player?.state})));throw error;}
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pencil-bead-atelier-v1')).music.track),'piano');
 await game(g=>{g.navigate('craft');});await press('Bead material 0','material-pressed');await touch('touchCancel');await page.waitForTimeout(260);assert.equal((await nodeInfo('Bead material 0')).scale,1);await game(g=>g.navigate('home'));
 await game(g=>{g.save.reduced=true;g.render();});n=await nodeInfo('Button: ⚙');await touch('touchStart',n.x,n.y);await page.waitForTimeout(80);
 const reduced=await nodeInfo('Button: ⚙');assert.equal(reduced.scale,1);assert.equal(reduced.wash,true);await touch('touchEnd');await page.waitForTimeout(300);assert.equal(await game(g=>g.modal),'settings');
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({base,pressRelease:true,cancel:true,moveAway:true,homeIcons,navigation:true,dialogs:true,materialPress:true,musicShortcut:true,naturalAudioEnd:before,reducedMotion:true,expectedTouchCancelDiagnostics,errors},null,2));
 console.log('UI feedback passed: real touch press/release/cancel, navigation, dialogs, music shortcut, reduced motion, and natural audio ending advances and persists the playlist.');
}finally{await browser.close();}
