import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,findMove} from '../cocos/assets/scripts/model.ts';

const url=process.env.GAME_URL||'http://127.0.0.1:8322/pencil-bead-atelier/';
const dir=process.env.AUTO_SOUND_ARTIFACTS||'artifacts/auto-sound';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=document-user-activation-required']}),errors=[],cases=[];
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const initial={...freshSave(),started:true,level:30,sound:false,music:{enabled:true,track:'piano',volume:.43},customers:{nextId:1,nextAt:Date.now()+86400000,lastStyle:'',active:null}};
  await page.addInitScript(save=>{
   if(!localStorage.getItem('pencil-bead-atelier-v1'))localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save));
   window.soundProof={starts:[],meters:[],pending:[]};
   const connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
   AudioNode.prototype.connect=function(destination,...args){
    if(this instanceof AudioBufferSourceNode)this.effectGain=destination;
    if(destination instanceof AudioDestinationNode){
     const analyser=this.context.createAnalyser();analyser.fftSize=1024;
     const meter={peak:0};this.effectMeter=window.soundProof.meters.length;window.soundProof.meters.push(meter);
     connect.call(this,analyser);connect.call(analyser,destination,...args);
     const samples=new Float32Array(1024),end=performance.now()+180000;
     const read=()=>{analyser.getFloatTimeDomainData(samples);for(const value of samples)meter.peak=Math.max(meter.peak,Math.abs(value));if(performance.now()<end)requestAnimationFrame(read);};requestAnimationFrame(read);
     return destination;
    }
    return connect.call(this,destination,...args);
   };
   AudioBufferSourceNode.prototype.start=function(...args){window.soundProof.starts.push({name:this.buffer?.duration<2?window.soundProof.pending.shift():'music',duration:this.buffer?.duration,meter:this.effectGain?.effectMeter});return start.apply(this,args);};
  },initial);
  const ready=async()=>{
   await page.waitForFunction(()=>typeof render_game_to_text==='function');
   await page.evaluate(async()=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame'),play=g.sound.playOneShot.bind(g.sound);g.sound.playOneShot=(clip,volume)=>{soundProof.pending.push(clip.name);return play(clip,volume);};});
  };
  const state=async()=>JSON.parse(await page.evaluate(()=>render_game_to_text()));
  const tap=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),k=Math.min(b.width/720,b.height/1280),px=b.x+b.width/2+(x-360)*k,py=b.y+b.height/2+(y-640)*k;if(width===390)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);};
  const node=async name=>{
   const p=await page.evaluate(async name=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');
    const find=n=>{if(!n.active)return null;if(n.name===name)return n;for(const c of n.children){const result=find(c);if(result)return result;}return null;};
    const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};
   },name);await tap(p.x,p.y);
  };
  const button=name=>node('Button: '+name);
  const audible=()=>page.evaluate(()=>soundProof.starts.filter(s=>s.duration<2&&soundProof.meters[s.meter]?.peak>.001).length);
  const outputAfter=async(action)=>{const before=await audible();await action();await page.waitForFunction(before=>soundProof.starts.filter(s=>s.duration<2&&soundProof.meters[s.meter]?.peak>.001).length>before,before);};
  await page.goto(url,{waitUntil:'networkidle'});await ready();
  let s=await state();assert.equal(s.save.sound,true);assert.deepEqual(s.save.music,initial.music);assert.equal(s.save.level,30);assert.deepEqual(s.save.inventory,initial.inventory);
  await outputAfter(()=>button('消除采珠'));
  const label=await page.getByRole('button',{name:/^开始采珠 · /}).textContent();await button(label);
  await page.waitForFunction(()=>JSON.parse(render_game_to_text()).music.playing);
  s=await state();assert.equal(s.session.level,30);const pair=findMove(s.session.board,s.session.specials,s.session.obstacles);assert.ok(pair);
  await outputAfter(async()=>{for(const i of pair)await tap(84+i%8*78,376+Math.floor(i/8)*78);});
  await page.waitForFunction(()=>!JSON.parse(render_game_to_text()).busy);
  await page.waitForFunction(()=>soundProof.starts.some(s=>s.name==='land'&&soundProof.meters[s.meter]?.peak>.001)&&soundProof.starts.some(s=>/^(clear|special|chain-)/.test(s.name)&&soundProof.meters[s.meter]?.peak>.001));
  const matchSounds=await page.evaluate(()=>soundProof.starts.filter(s=>s.duration<2&&soundProof.meters[s.meter]?.peak>.001).map(s=>s.name));
  await page.screenshot({path:dir+'/level-30-'+width+'.png'});
  await button('暂停');await node('Pause 音效');assert.equal((await state()).save.sound,false);
  await page.waitForTimeout(150);const muted=await page.evaluate(()=>soundProof.starts.filter(s=>s.duration<2).length);
  await button('继续游戏');await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>soundProof.starts.filter(s=>s.duration<2).length),muted);
  await button('暂停');await outputAfter(()=>node('Pause 音效'));assert.equal((await state()).save.sound,true);
  await node('Pause 音效');assert.equal((await state()).save.sound,false);const saved=(await state()).save;
  await page.reload({waitUntil:'networkidle'});await ready();s=await state();
  assert.equal(s.save.sound,true);assert.deepEqual(s.save.music,saved.music);assert.deepEqual(s.save.inventory,saved.inventory);assert.deepEqual(s.save.draft,saved.draft);assert.equal(s.save.level,30);
  await outputAfter(()=>button('消除采珠'));
  cases.push({width,legacyMutedSaveEnabled:true,musicPreserved:true,level30Audible:true,matchSounds,manualMute:true,enablePreview:true,reloadEnablesEffects:true,progressPreserved:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/report.json',JSON.stringify({url,cases,errors},null,2));console.log(JSON.stringify({passed:true,cases,errors}));
}finally{await browser.close();}
