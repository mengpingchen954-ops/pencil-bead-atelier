import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {load,Node,UITransform,Label,Sprite,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const rules=load(root+'/assets/scripts/model.ts');
const {actionText,wrapText}=load(root+'/assets/scripts/theme.ts');
function fixture(){
 const g=new AtelierGame(),actions=new Map(),scheduled=[];
 g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');
 g.save={...rules.freshSave(),started:true};g.screen='home';g.persist=()=>{};g.play=()=>{};
 g.scheduleOnce=fn=>scheduled.push(fn);
 g.accessibility={clear(){},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){},announce(){}};
 return {g,actions,flush:()=>{for(const fn of scheduled.splice(0))fn();}};
}
test('visible action ids are hidden while native and accessible identities stay distinct',()=>{
 assert.equal(actionText('改名 · 123'),'改名');assert.equal(actionText('主题 · 春天'),'主题 · 春天');
 const {g,actions}=fixture();let calls=0;const n=g.button('上架橱窗 · 25',0,0,200,50,()=>calls++);
 assert.equal(n.name,'Button: 上架橱窗 · 25');assert.equal(n.getComponentsInChildren(Label)[0].string,'上架橱窗');actions.get('上架橱窗 · 25')();assert.equal(calls,1);
});
test('disabled buttons have no painted sprite, and painted buttons keep layout key counts stable',()=>{
 const {g}=fixture();g.textures.set('pencil-ui-neutral',{name:'neutral'});
 const disabled=g.button('不能交付',0,0,200,50,()=>{},g.page,false,false);
 assert.equal(disabled.getComponentsInChildren(Sprite).length,0);
 const active=g.button('继续',0,60,200,50,()=>{});
 assert.equal(active.getComponentsInChildren(Sprite).length,1);
 assert.equal(active.children.find(n=>n.name==='Painted surface').children[0].name,'Clipped paint');
});
test('Chinese wrapping avoids punctuation starts and isolated final glyphs',()=>{
 const rows=wrapText('把喜欢的珠子，串成自己的故事。',120,24).split('\n');
 assert.ok(rows.length>1);assert.ok(rows.every(s=>!/^['，。！？；：、]/.test(s)));assert.ok(rows.at(-1).length>=2);
 assert.equal(rows.join(''),'把喜欢的珠子，串成自己的故事。');
});
test('opening a modal clears notices and compact info measures actual nodes after construction',()=>{
 const {g,flush}=fixture();g.toast('过期提示');assert.ok(g.notices.children.length);
 g.info('体力','每三分钟恢复一点。');assert.equal(g.notices.children.length,0);
 flush();const paper=g.overlay.children.find(n=>n.name==='Dialog paper');
 assert.ok(paper.getComponent(UITransform).contentSize.height<400);
 const title=g.overlay.getComponentsInChildren(Label).find(l=>l.string==='体力');assert.equal(title.node.position.x,136);
});
test('craft returns to its actual source and a one-page collection has no paging actions',()=>{
 for(const source of ['home','orders','album','storyMap']){
  const {g,actions}=fixture();g.screen=source;g.navigate('craft');assert.equal(g.craftFrom,source);
  const label=({home:'返回小店',orders:'返回售珠',album:'返回图鉴',storyMap:'返回故事'})[source];actions.get(label)();assert.equal(g.screen,source);
 }
 const {g,actions}=fixture();g.navigate('album');assert.equal(actions.has('← 前页'),false);assert.equal(actions.has('后页 →'),false);
});
test('target colors get one and a half their original weight and six opening cells without free matches',()=>{
 const {MATERIAL_DROPS}=load(root+'/assets/scripts/materials.ts');
 for(let level=1;level<=30;level++)for(let seed=1;seed<=100;seed++){
  const session=rules.newSession(seed,level),targets=session.objectives.filter(g=>g.kind==='color').map(g=>g.type);
  for(let type=0;type<6;type++)assert.equal(session.dropPool.filter(t=>t===type).length,MATERIAL_DROPS.filter(t=>t===type).length*(targets.length?targets.includes(type)?3:2:1));
  assert.equal(rules.matches(session.board).length,0);assert.ok(rules.findMove(session.board));
  for(const type of targets)assert.ok(session.board.filter(t=>t===type).length>=6);
 }
 const first=rules.levelConfig(4),second=rules.levelConfig(19);assert.notDeepEqual(first.obstacles,second.obstacles);assert.match(second.title,/第2季/);
});
test('new contest rubric and ghost reference preserve earlier paid results and actual drafts',()=>{
 const comp=load(root+'/assets/scripts/competition.ts');
 const oldBeads=Array.from({length:12},(_,i)=>i%2?5:3),legacy=comp.evaluateCompetition('spring',oldBeads,'daisy',true);
 assert.equal(legacy.score,100);assert.equal(comp.evaluateCompetition('spring',oldBeads,'daisy').score,85);
 const save={...rules.freshSave(),completed:['daisy'],competitions:{draft:null,entries:[{id:'spring',beads:oldBeads,charm:'daisy',...legacy,reward:60}]}};
 const restored=rules.normalizeSave(save);assert.equal(restored.competitions.entries[0].score,100);assert.equal(restored.competitions.entries[0].reward,60);assert.equal(restored.coins,save.coins);
 const {g,actions}=fixture();g.save.completed=['daisy'];g.enterCompetition('spring');const before=JSON.stringify(g.save);
 g.contestSample();actions.get('显示参考虚影')();assert.equal(g.contestGhost,true);assert.equal(JSON.stringify(g.save),before);assert.equal(g.workingUndo.length,0);
 assert.ok(g.page.getComponentsInChildren(Label).some(l=>l.string.includes('预计')));
});
test('match exposes only pause and music in the header and returning after gathering keeps the craft origin',()=>{
 const {g,actions}=fixture();g.navigate('craft');g.startMatch();
 const top=g.page.children.filter(n=>n.name.startsWith('Button:')&&-n.position.y<85).map(n=>n.name);
 assert.deepEqual(top,['Button: 暂停','Button: ♪']);assert.equal(g.craftFrom,'home');
 g.session.status='lost';g.session.moves=0;g.session.collected=[10,10,10,10,10,10];g.leaveGather();assert.equal(g.craftFrom,'home');assert.ok(g.save.firstSteps.craft);actions.get('返回小店')();assert.equal(g.screen,'home');
});
test('story uses the five shared destinations and cleanup counts for thirty percent',()=>{
 const {g}=fixture();g.navigate('storyMap');assert.ok(g.page.children.find(n=>n.name==='Navigation'));
 let save=rules.freshSave();const {CLEAN_SPOTS}=load(root+'/assets/scripts/content.ts');for(const spot of CLEAN_SPOTS)save=rules.cleanSpot(save,spot.id);assert.equal(rules.shopProgress(save).percent,30);
});
test('collect all pays only unclaimed sales once and controller restores the transaction on storage failure',()=>{
 const trade=load(root+'/assets/scripts/commerce.ts');let save={...rules.freshSave(),inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20)};
 for(let i=0;i<4;i++){save=trade.finishWork({...save,draft:[0]},1000+i);save=trade.listWork(save,i+1,42,2000);}
 save=trade.settleSales(save,100000);save=trade.collectSale(save,1);
 const before=JSON.stringify(save),next=trade.collectAllSales(save);assert.equal(next.coins,save.coins+126);assert.equal(JSON.stringify(save),before);assert.equal(trade.collectAllSales(next),null);
 const {g}=fixture();g.save=save;g.screen='orders';g.salesTab='sold';g.toast=()=>{};g.persist=()=>{g.storageFailed=true;};g.collectReceipts();assert.equal(g.save,save);
 g.persist=()=>{g.storageFailed=false;};g.save.reduced=true;g.collectReceipts();assert.equal(g.save.coins,next.coins);const paid=g.save;g.collectReceipts();assert.equal(g.save,paid);
});
test('random names exclude all existing names even after the original suggestion pool is exhausted',()=>{
 const {randomWorkName}=load(root+'/assets/scripts/commerce.ts'),used=[];
 for(let i=0;i<100;i++){const name=randomWorkName('',used);assert.ok(name.length<=24);assert.equal(used.includes(name),false);used.push(name);}
});
test('price presets update the displayed waiting time and commit the selected slider price',()=>{
 const trade=load(root+'/assets/scripts/commerce.ts'),{g,actions}=fixture();g.save=trade.finishWork({...g.save,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),draft:[0,0,0]},1000);
 const bounds=trade.priceBounds([0,0,0],0);g.listingDialog(1,bounds.min);
 actions.get('高价')();assert.ok(g.overlay.getComponentsInChildren(Label).some(l=>l.string==='售价 '+bounds.max+' 金币'));
 actions.get('降价 10')();assert.ok(g.overlay.getComponentsInChildren(Label).some(l=>l.string==='售价 '+(bounds.max-10)+' 金币'));actions.get('快卖')();actions.get('确认上架')();assert.equal(g.save.commerce.works[0].price,bounds.min);assert.equal(g.save.commerce.works[0].sellAt-g.save.commerce.works[0].listedAt,trade.saleDuration([0,0,0],bounds.min));
});
test('character progress uses distinct experiences and does not fill from several quotes in one story',()=>{
 const {characterMemories}=load(root+'/assets/scripts/memories.ts'),save=rules.freshSave();save.seenStories=['old-table','first-receipt'];
 const grandma=characterMemories(save).find(p=>p.id==='grandma');assert.equal(grandma.steps,2);assert.ok(grandma.steps<4);
 save.completed=['daisy'];save.commerce.works=[{status:'sold',buyer:'花店小满'}];assert.equal(characterMemories(save).find(p=>p.id==='xiaoman').steps,2);
});
test('empty state drawings are distinct and reputation upgrade reports the actual cap',()=>{
 const {g}=fixture();for(const kind of ['showcase','album','journal','customer'])g.emptyArt(kind,0,0,160);
 assert.equal(new Set(g.page.children.map(n=>n.name)).size,4);
 g.save.rep=50;assert.match(g.reputationMessage(40),/125%/);assert.equal(g.reputationMessage(50),'');g.save.rep=999;assert.equal(g.reputationMessage(300),'');
});

test('the final customer work page compacts around actual cards and returns to the first page',()=>{
 const trade=load(root+'/assets/scripts/commerce.ts'),{g,actions,flush}=fixture();let save={...g.save,inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30)};
 for(let i=0;i<4;i++)save=trade.finishWork({...save,draft:Array(6).fill(0)},1000+i);
 g.save={...save,customers:{nextId:2,nextAt:0,lastStyle:'',active:{id:1,style:'jewelry',buyer:'许老师',status:'accepted',createdAt:1}}};
 g.customerWorks(1);flush();assert.ok(g.overlay.getChildByName('Dialog paper').getComponent(UITransform).contentSize.height<600);
 assert.ok(actions.has('上一批'));actions.get('上一批')();assert.equal(g.overlay.children.filter(n=>n.name.startsWith('Custom work ')).length,3);
});

test('bead impacts use short licensed material clips and respect the sound switch',()=>{
 const g=new AtelierGame(),played=[];g.save=rules.freshSave();g.sound={playOneShot:(clip,volume)=>played.push({name:clip.name,volume})};
 const names=['bead-glass-1','bead-glass-2','bead-glass-3','bead-wood-1','bead-metal-1'];g.sounds=new Map(names.map(name=>[name,{name}]));
 for(const type of [0,12,24,36])g.playBeadImpact(type);assert.ok(played.slice(0,2).every(p=>p.name.startsWith('bead-glass-')));assert.equal(played[2].name,'bead-wood-1');assert.equal(played[3].name,'bead-metal-1');
 g.save.sound=false;g.playBeadImpact(0);assert.equal(played.length,4);
 for(const name of names){const wav=fs.readFileSync(root+'/assets/resources/audio/'+name+'.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');let offset=12,data=null,rate=0;
  while(offset+8<=wav.length){const key=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);if(key==='fmt ')rate=wav.readUInt32LE(offset+12);if(key==='data')data=wav.subarray(offset+8,offset+8+size);offset+=8+size+(size%2);}
  assert.ok(data&&rate===44100);assert.ok(data.length/2/rate>.05&&data.length/2/rate<.5);let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));assert.ok(peak>500&&peak<32768);
 }
});
