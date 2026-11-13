import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshSave,newSession} from '../cocos/assets/scripts/model.ts';
import {finishWork} from '../cocos/assets/scripts/commerce.ts';
const base=process.env.GAME_URL||'http://127.0.0.1:8337/pencil-bead-atelier/',dir=process.env.POLISH_ARTIFACTS||'artifacts/bead-polish';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const initial={...freshSave(),started:true,reduced:false,sound:false,music:{enabled:false,volume:0,track:'glimmer'},firstSteps:{firstGather:1,craft:1},inventory:Array(48).fill(100),gatheredStock:Array(48).fill(100),materialUnlocked:Array(48).fill(true),draft:[0,1,2,3,4,5,38,7,8,9,10,11]};
 await page.addInitScript(save=>localStorage.setItem('pencil-bead-atelier-v1',JSON.stringify(save)),initial);
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
 const game=async(fn,arg)=>page.evaluate(async({source,arg})=>{const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('AtelierGame').getComponent('AtelierGame');return (0,eval)('('+source+')')(g,cc,arg);},{source:fn.toString(),arg});
 const shot=async name=>page.screenshot({path:dir+'/'+name+'.png'});
 const xy=async(x,y)=>{const b=await page.locator('#GameCanvas').boundingBox(),s=Math.min(b.width/720,b.height/1280);return {x:b.x+b.width/2+(x-360)*s,y:b.y+b.height/2+(y-640)*s};};
 const tap=async(x,y)=>{const p=await xy(x,y);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(180);};
 const button=async name=>{
  const p=await game((g,cc,name)=>{const find=n=>{if(!n.active)return null;if(n.name==='Button: '+name)return n;for(const c of n.children){const r=find(c);if(r)return r;}return null;};const n=find(g.modal?g.overlay:g.page);if(!n)throw Error('Missing '+name);const t=n.getComponent(cc.UITransform),p=t.convertToWorldSpaceAR(new cc.Vec3(t.width/2,-t.height/2));return {x:p.x+360,y:640-p.y};},name);await tap(p.x,p.y);
 };
 const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 const clearBeads=async()=>assert.equal(await game((g,cc)=>{
  const beads=g.slotNodes.map(n=>{const art=n.children.find(c=>c.name.startsWith('bead-'));if(!art)return null;const t=n.getComponent(cc.UITransform);return {x:n.position.x+t.width/2,y:n.position.y-t.height/2,d:art.getComponent(cc.UITransform).width};}).filter(Boolean);
  return beads.every((a,i)=>beads.slice(i+1).every(b=>Math.hypot(a.x-b.x,a.y-b.y)-(a.d+b.d)/2>=5.99));
 }),true,'Normal beads must leave a visible gap');
 const aligned=()=>game((g,cc)=>g.page.children.filter(n=>n.name.startsWith('Resource ')).map(n=>{const l=n.children.find(c=>c.getComponent(cc.Label)),label=l.getComponent(cc.Label),p=n.getComponent(cc.UITransform),t=l.getComponent(cc.UITransform);return label.horizontalAlign===cc.Label.HorizontalAlign.CENTER&&label.verticalAlign===cc.Label.VerticalAlign.CENTER&&Math.abs((-l.position.y+t.height/2)-p.height/2)<.01;}));
 assert.deepEqual(await aligned(),[true,true,true]);await shot('home-centered');
 await page.getByRole('button',{name:'每日签到',exact:true}).dispatchEvent('click');await page.waitForTimeout(200);await shot('daily-clean');await button('×');
 await game(g=>g.navigate('orders'));assert.deepEqual(await aligned(),[true,true,true]);await shot('header-shared');
 const listed=finishWork({...initial,draft:Array(11).fill(0).concat(38)},1000);
 await game((g,cc,save)=>{g.save=save;g.listingDialog(1);},listed);await page.waitForTimeout(200);await shot('listing-clean');await button('加价 10');await button('×');
 await game((g,cc,save)=>{g.save=save;g.navigate('craft');},initial);await clearBeads();await shot('charm-tight');
 const rest=await game(g=>({art:g.slotNodes.map(n=>n.children.find(c=>c.name.startsWith('bead-'))?.position.x??0),slots:g.slotNodes.map(n=>({x:n.position.x,y:n.position.y})),save:JSON.stringify(g.save)}));
 const start=(await state()).crafting.slots[1],cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await xy(start.x,start.y)]});
 for(let d=8;d<=40;d+=8){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await xy(start.x+d,start.y+8)]});await page.waitForTimeout(30);}
 await page.waitForTimeout(160);const during=await game(g=>({art:g.slotNodes.map(n=>n.children.find(c=>c.name.startsWith('bead-'))?.position.x??0),flow:g.craftFlows.size}));
 assert.ok(during.flow>0);assert.ok(Math.abs(during.art[2]-rest.art[2])>1);await shot('drag-flow');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(1800);
 const settled=await game(g=>({flow:g.craftFlows.size,art:g.slotNodes.map(n=>n.children.find(c=>c.name.startsWith('bead-'))?.position.x??0),slots:g.slotNodes.map(n=>({x:n.position.x,y:n.position.y})),save:JSON.stringify(g.save)}));
 assert.equal(settled.flow,0);assert.deepEqual(settled.art,rest.art);assert.deepEqual(settled.slots,rest.slots);assert.equal(settled.save,rest.save);await shot('flow-settled');
 await game(g=>{g.save.draft[3]=null;g.render();});const target=(await state()).crafting.slots[3];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await xy(146,805)]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await xy(target.x,target.y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(80);assert.ok(await game(g=>g.craftFlows.size)>0);await shot('insertion-flow');await page.waitForTimeout(1800);assert.equal(await game(g=>g.craftFlows.size),0);
 await game(g=>{g.save.reduced=true;g.save.draft=Array(19).fill(0);g.render();});await tap(146,805);
 assert.equal((await state()).save.draft.length,20);await tap(286,805);assert.equal((await state()).save.draft.length,20);await clearBeads();await shot('twenty-limit');
 await button('完成制作');await button('保存并上架');assert.equal((await state()).save.commerce.works.at(-1).beads.length,20);await shot('twenty-listing');await button('×');
 for(const kind of ['row','column','burst']){
  const session=newSession(971,19);session.specials[27]=kind;
  await game((g,cc,session)=>{g.closeModal();g.save.reduced=true;g.session=session;g.screen='match';g.render();},session);
  assert.equal(await game((g,cc,kind)=>g.boardNodes[27].children.some(n=>n.name==='Special jewel '+kind),kind),true);
  assert.equal(await game((g,cc)=>g.boardNodes[0].children.find(n=>n.name.startsWith('bead-')||n.name.startsWith('charm-')).getComponent(cc.UITransform).width),76);
  await shot('special-'+kind);await tap(48+3*78+36,340+3*78+36);await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).busy);
  assert.equal((await state()).session.moves,session.moves-1);
 }
 for(const status of ['won','lost']){const session={...newSession(971,19),status,moves:0,collected:[29,19,30,25,20,29]};await game((g,cc,s)=>{g.session=s;g.render();g.result();},session);await page.waitForTimeout(200);await shot('result-'+status);await button('×');}
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/polish-report.json',JSON.stringify({base,centeredResources:true,cleanDialogs:true,dragFlow:true,exactRest:true,insertionFlow:true,twentyPieceLimit:true,specialActivation:['row','column','burst'],errors},null,2));
 console.log('Polish passed: centered resources, clean dialogs, real drag/insertion flow, exact rest, 20-piece cap, saving/listing and all special icons.');
}finally{await browser.close();}
