import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { load, Node, UITransform, Label, Sprite, Vec3, root } = require('../tools/generate-editor-layouts.cjs');
const { AtelierGame } = load(root + '/assets/scripts/AtelierGame.ts');
const { AtelierLayout } = load(root + '/assets/scripts/AtelierLayout.ts');
const { layoutKey } = load(root + '/assets/scripts/layout-key.ts');
const rules = load(root + '/assets/scripts/model.ts');
const materials = load(root + '/assets/scripts/materials.ts');
const ringSave = save => {const ring=materials.ringMaterials(save.draft,save.draftSizes,save.charm,save.beadSize);return {...save,draft:Array.from(ring.beads),draftSizes:Array.from(ring.sizes),charm:'none'};};

test('craft spring overshoots the wire once, rebounds inward and settles with bounded motion',()=>{
  const {craftSpring}=load(root+'/assets/scripts/AtelierGame.ts');
  const samples=Array.from({length:1001},(_,i)=>craftSpring(i/1000));
  assert.equal(samples[0],0);assert.equal(samples.at(-1),1);
  assert.ok(samples.every(n=>Number.isFinite(n)&&n>=0&&n<1.14));
  const peak=samples.indexOf(Math.max(...samples));
  assert.ok(peak>200&&peak<400);assert.ok(samples[peak]>1.1);
  assert.ok(Math.min(...samples.slice(peak))<.99);
  assert.ok(samples.slice(900).every(n=>Math.abs(n-1)<.003));
});

test('sales tabs page real DIY works without changing stock or granting income',()=>{
  const {game,actions}=pausedGame('home');const trade=load(root+'/assets/scripts/commerce.ts');
  game.save.inventory=Array(48).fill(100);game.save.gatheredStock=Array(48).fill(100);game.save.materialUnlocked=Array(48).fill(true);
  for(let i=0;i<4;i++)game.save=trade.finishWork({...game.save,draft:Array(12).fill(i)},1000+i);
  const before=JSON.stringify(game.save);game.navigate('orders');
  const cards=()=>game.page.children.filter(n=>n.name.startsWith('Sale work '));
  assert.equal(cards().length,3);assert.ok(actions.has('待上架 4'));actions.get('后页 →')();assert.equal(cards().length,1);
  actions.get('← 前页')();assert.equal(game.ordersPage,0);actions.get('在售 0')();assert.equal(cards().length,0);
  assert.equal(JSON.stringify(game.save),before);assert.ok(actions.has('售珠'));
});

test('entry scene contains eighteen real editable layouts, visible home art, labels and UI camera', () => {
  const scene = JSON.parse(fs.readFileSync(root + '/assets/scenes/Atelier.scene', 'utf8'));
  const layouts = scene.find(n => n._name === 'EditableLayouts');
  assert.ok(layouts);
  const pages = layouts._children.map(r => scene[r.__id__]);
  assert.deepEqual(pages.map(n => n._name), ['home','cover','orders','craft','match','decor','album','journal','contest','contestCraft','delivery','dialogue','memories','packing','storyMap','pause','orderArrival','collectionDetail']);
  assert.equal(pages.filter(n => n._active).length, 1);
  assert.ok(pages[0]._active);
  assert.ok(scene.some(n => n.__type__ === 'cc.Camera' && n._orthoHeight === 640));
  assert.ok(scene.filter(n => n.__type__ === 'cc.Sprite').length > 100);
  assert.ok(scene.filter(n => n.__type__ === 'cc.Label').length > 100);
  const homeArt = pages[0]._children.map(r => scene[r.__id__]).find(n => n._name === 'pencil-home-page');
  assert.ok(homeArt?._components.some(r => scene[r.__id__].__type__ === 'cc.Sprite'));
  assert.ok(scene.some(n=>n.__type__==='cc.Sprite'&&n._type===1));
  const keys = scene.filter(n => n.key).map(n => n.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const object of scene) {
    for (const r of [...(object._children || []), ...(object._components || [])]) assert.ok(scene[r.__id__]);
  }
});

test('header music distinguishes single and double taps, cancels abandoned gestures and preserves game progress',()=>{
  const {game,actions}=pausedGame('home'),scheduled=new Set();
  game.scheduleOnce=fn=>scheduled.add(fn);game.unschedule=fn=>scheduled.delete(fn);
  game.save.sound=false;game.render();const before=JSON.stringify({...game.save,music:null});
  const event=(x=674)=>({getUILocation:()=>({x,y:1238})});
  const tap=()=>{const n=game.page.children.find(n=>n.name==='Music shortcut');n.events.start(event());n.events.end(event());};
  const flush=()=>{for(const fn of [...scheduled]){scheduled.delete(fn);fn();}};
  const labels=game.page.getComponentsInChildren(Label).map(n=>n.string);
  assert.ok(labels.includes(String(game.save.coins)));assert.equal(labels.includes('金 '+game.save.coins),false);
  assert.equal(labels.includes('珠 '+rules.total(game.save.inventory)),false);
  tap();assert.equal(game.save.music.track,'glimmer');assert.equal(scheduled.size,1);
  flush();assert.equal(game.save.music.track,'calm');assert.equal(game.save.music.enabled,true);
  tap();tap();assert.equal(scheduled.size,0);assert.equal(game.modal,'music');flush();assert.equal(game.save.music.track,'calm');
  actions.get('+')();assert.equal(game.save.music.volume,.45);game.closeModal();
  tap();game.render();flush();assert.equal(game.save.music.track,'calm');
  tap();game.settings();flush();assert.equal(game.save.music.track,'calm');game.closeModal();game.render();
  const n=game.page.children.find(n=>n.name==='Music shortcut');
  n.events.start(event());n.events.cancel();n.events.end(event());flush();assert.equal(game.save.music.track,'calm');
  n.events.start(event());n.events.move(event(700));n.events.end(event());flush();assert.equal(game.save.music.track,'calm');
  game.save.music.track='healing';actions.get('下一首背景音乐')();assert.equal(game.save.music.track,'glimmer');
  actions.get('调整背景音乐音量')();assert.equal(game.modal,'music');
  assert.equal(JSON.stringify({...game.save,music:null}),before);
});

test('all persistent navigation uses the home dimensions and five destinations without covering page controls',()=>{
  const game=new AtelierGame();game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.textures.set('pencil-floor',{name:'pencil-floor'});
  game.save={...rules.freshSave(),started:true};
  const before=JSON.stringify(game.save),targets=['home','orders','craft','decor','album'];
  for(const page of ['home','orders','decor','album','journal','contest']){
    game.screen=page;game.render();
    const bar=game.page.children.find(n=>n.name==='Navigation');
    assert.equal(bar.position.y,-1140,page);assert.equal(bar.getComponent(UITransform).contentSize.height,140,page);
    const tabs=game.page.children.filter(n=>n.name.startsWith('Navigate '));
    assert.deepEqual(tabs.map(n=>n.name),targets.map(n=>'Navigate '+n),page);
    tabs.forEach((n,i)=>{
      assert.equal(n.position.x,i*144);assert.equal(n.position.y,-1140);
      assert.deepEqual(n.getComponent(UITransform).contentSize,{width:144,height:140});
      const label=n.getComponentsInChildren(Label)[0];assert.equal(label.fontSize,23);
      assert.equal(n.children.some(c=>c.name==='pencil-ui-active'),targets[i]===page);
    });
    for(const n of game.page.children.filter(n=>n.name.startsWith('Button: '))){
      assert.ok(-n.position.y+n.getComponent(UITransform).contentSize.height<=1140,page+' '+n.name);
    }
  }
  assert.equal(JSON.stringify(game.save),before);
});

test('home shows the real display window and opens free DIY without a recipe',()=>{
  const {game,actions}=pausedGame('home'),before=JSON.stringify(game.save);game.render();
  const labels=game.page.getComponentsInChildren(Label).map(l=>l.string);
  assert.ok(labels.includes('待上架 0 件 · 在售 0 件 · 已售 0 件'));assert.ok(actions.has('查看售珠橱窗'));
  actions.get('自由 DIY')();assert.equal(game.screen,'craft');assert.equal(JSON.stringify(game.save),before);
});

test('real renderer honors edited transforms, typography and sprite while keeping live inventory', () => {
  const game = new AtelierGame(); game.screen='home'; game.page=new Node('Page');
  game.save=rules.freshSave(); game.save.inventory=[8,0,0,0,0,0];
  const template = new Node('renamed by artist');
  template.setPosition(95,-330); template.setScale(1.1,1.1,1);
  const transform=template.addComponent(UITransform);transform.setContentSize(480,300);transform.setAnchorPoint(0,1);
  game.layouts.set(layoutKey('home',38,280,644,400,new Map()),template);
  game.textures.set('pencil-shop',{name:'pencil-shop'});
  const binding=template.addComponent(AtelierLayout);binding.originalImage='pencil-shop';
  const art=template.addComponent(Sprite);art.spriteFrame={name:'artist-replacement',originalSize:{width:400,height:400}};
  const node=game.image('pencil-shop',38,280,644,400);
  assert.deepEqual(node.position,new Vec3(185,-330));
  assert.equal(node.scale.x,1.1);
  assert.deepEqual(node.getComponent(UITransform).contentSize,{width:300,height:300});
  assert.equal(node.getComponent(Sprite).spriteFrame.name,'artist-replacement');
  const original=game.text('珠 5',10,20,100,50);
  const key=game.layoutKeys.get(original.node);
  const label=original.node.getComponent(Label);
  const baseline=original.node.addComponent(AtelierLayout);
  const fields=['string','fontSize','lineHeight','fontFamily','enableWrapText','overflow','horizontalAlign','verticalAlign'];
  baseline.originalLabel=JSON.stringify({...Object.fromEntries(fields.map(k=>[k,label[k]])),color:label.color.toHEX()});
  label.fontSize=32;game.layouts.set(key,original.node);
  game.layoutCounts.clear();game.layoutKeys.clear();
  const live=game.text('珠 '+rules.total(game.save.inventory),10,20,100,50);
  assert.equal(live.string,'珠 8');assert.equal(live.fontSize,32);
});

test('moved board cells remain animation targets, and generated scene is not overwritten implicitly', () => {
  const game=new AtelierGame(),cell=new Node('Cell 0');cell.setPosition(60,-450);
  game.layouts.set(layoutKey('match',48,340,72,72,new Map()),cell);
  assert.deepEqual(game.boardPos(0),new Vec3(60,-450));
  assert.deepEqual(game.boardPos(0,false),new Vec3(48,-340));
  const generator=fs.readFileSync(root+'/tools/generate-editor-layouts.cjs','utf8');
  assert.match(generator,/Layouts already exist/);
});

test('craft drag ignores the moving source when finding the nearest edited slot', () => {
  const game=new AtelierGame();game.save=rules.freshSave();game.save.draft[0]=0;game.save.draft[1]=1;
  game.page=new Node('Page');game.render=()=>{};game.persist=()=>{};
  for(let i=0;i<12;i++){const p=game.slotPos(i),n=new Node('Slot '+i);n.setPosition(p.x-37,-p.y+37);game.slotNodes.push(n);}
  const source=game.slotNodes[0];game.bindCraftDrag(source,0);
  const touch=(x,y)=>({getUILocation:()=>({x,y:1280-y})});
  const from=game.slotPos(0),to=game.slotPos(1);
  source.events.start(touch(from.x,from.y));
  source.events.move(touch(to.x,to.y));
  source.events.end(touch(to.x,to.y));
  assert.equal(game.save.draft[0],1);assert.equal(game.save.draft[1],0);
});

test('every serialized illustration, bead and charm preserves its source aspect ratio', () => {
  const sizes=new Map();
  for(const folder of ['art','beads'])for(const file of fs.readdirSync(root+'/assets/resources/'+folder)){
    if(!/\.(png|jpg)\.meta$/.test(file))continue;
    const meta=JSON.parse(fs.readFileSync(root+'/assets/resources/'+folder+'/'+file,'utf8'));
    const frame=meta.subMetas.f9941;sizes.set(frame.uuid,frame.userData);
  }
  const scene=JSON.parse(fs.readFileSync(root+'/assets/scenes/Atelier.scene','utf8'));
  for(const sprite of scene.filter(n=>n.__type__==='cc.Sprite')){
    const source=sizes.get(sprite._spriteFrame.__uuid__),node=scene[sprite.node.__id__];
    const transform=node._components.map(r=>scene[r.__id__]).find(c=>c.__type__==='cc.UITransform');
    assert.ok(source,node._name);
    if(sprite._type===1){assert.ok(source.borderLeft>0&&source.borderRight>0&&source.borderTop>0&&source.borderBottom>0,'Sliced UI skins must declare protected corners');continue;}
    assert.ok(Math.abs(transform._contentSize.width/transform._contentSize.height-source.rawWidth/source.rawHeight)<1e-6,node._name+' must not stretch');
  }
});

test('workshop grooves are round and the bracelet has room between neighboring bead centers', () => {
  const game=new AtelierGame(),top=game.slotPos(0),bottom=game.slotPos(6),right=game.slotPos(3),left=game.slotPos(9);
  assert.ok((bottom.y-top.y)/(right.x-left.x)>=.6);
  for(let i=0;i<12;i++){
    const a=game.slotPos(i),b=game.slotPos((i+1)%12);
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=60);
  }
  game.save=rules.freshSave();game.page=new Node('Page');game.craft();
  for(const slot of game.slotNodes){
    const recess=slot.getComponent(UITransform).contentSize;
    assert.equal(recess.width,recess.height);
  }
});

test('commission workshop previews its real draft and validates before entering packing', () => {
  const game=new AtelierGame(),actions=new Map();
  game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.toast=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){}};
  game.save={...rules.freshSave(),reduced:true,inventory:Array(48).fill(100),gatheredStock:Array(48).fill(100),materialUnlocked:Array(48).fill(true)};game.screen='craft';game.render();
  const before=JSON.stringify(game.save),rendered=[];
  const original=game.bracelet.bind(game);game.bracelet=(beads,...args)=>{rendered.push([...beads]);return original(beads,...args);};
  actions.get('完成制作')();assert.equal(game.screen,'craft');
  actions.get('放入珍珠')();assert.equal(game.workingDraft.filter(n=>n!==null).length,1);
  const partial=JSON.stringify(game.save);actions.get('预览')();
  assert.equal(game.modal,'craft-preview');assert.deepEqual(rendered.at(-1),[0]);assert.equal(JSON.stringify(game.save),partial);
  actions.get('继续制作')();assert.equal(game.modal,'');
  const index=game.save.draft.findIndex(n=>n!==null);actions.get(`第${index+1}槽：珍珠`)();actions.get('移除')();
  assert.ok(game.save.draft.every(n=>n===null));actions.get('撤销')();assert.equal(game.save.draft[index],0);
  actions.get('参考配色')();actions.get('按参考排珠')();
  const stocked=JSON.stringify(game.save);actions.get('完成制作')();assert.equal(game.screen,'packing');assert.equal(JSON.stringify(game.save),stocked);
  assert.equal(game.save.coins,JSON.parse(before).coins);assert.deepEqual(game.save.inventory,Array(48).fill(100));
});

function pausedGame(screen='match') {
  const game=new AtelierGame(),actions=new Map();
  game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.toast=()=>{};game.music={update(){},snapshot(){return {};}};
  game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){},closeDialog(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,music:{enabled:false,volume:.35,track:'glimmer'},draft:[0,3,...Array(10).fill(null)]};
  game.screen=screen;game.session=screen==='match'?rules.newSession(42,1):null;
  return {game,actions};
}

test('pause toggles, nested music and continued play preserve the exact board and commission',()=>{
  const {game,actions}=pausedGame(),session=game.session,draft=JSON.stringify(game.save.draft),energy=game.save.energy;
  const template=new Node('edited heading');template.setPosition(240,-312);template.addComponent(UITransform).setAnchorPoint(0,1);template.getComponent(UITransform).setContentSize(280,70);
  const key=layoutKey('pause',230,309,275,67,new Map());game.layouts.set(key,template);
  game.pauseMatch();assert.equal(game.modal,'pause');assert.equal(game.snapshot().pause.context,'match');
  actions.get('音乐：关闭')();assert.equal(game.save.music.enabled,true);actions.get('音效：开启')();assert.equal(game.save.sound,false);actions.get('减少动效：开启')();assert.equal(game.save.reduced,false);
  assert.deepEqual([...game.layoutKeys].find(([node,k])=>k===key)[0].position,new Vec3(240,-312));
  actions.get('切歌 / 音量')();assert.equal(game.modal,'music');assert.equal(game.musicFromPause,true);game.dismiss();assert.equal(game.modal,'pause');
  actions.get('继续游戏')();assert.equal(game.modal,'');assert.equal(game.session,session);assert.equal(JSON.stringify(game.save.draft),draft);assert.equal(game.save.energy,energy);
  game.busy=true;game.pauseMatch();assert.equal(game.modal,'');
});

test('restart and leaving a paused match require their explicit choice and never grant unclaimed stock',()=>{
  const {game,actions}=pausedGame(),session=game.session,stock=JSON.stringify(game.save.inventory),draft=JSON.stringify(game.save.draft),energy=game.save.energy;
  game.pauseMatch();actions.get('重新开始')();assert.equal(game.modal,'pause-restart');game.dismiss();assert.equal(game.session,session);assert.equal(game.save.energy,energy);
  actions.get('重新开始')();const confirm=actions.get('重开本关 · 1 体力');confirm();confirm();assert.equal(game.save.energy,energy-1);assert.equal(game.modal,'');assert.notEqual(game.session,session);assert.equal(JSON.stringify(game.save.inventory),stock);assert.equal(JSON.stringify(game.save.draft),draft);
  game.pauseMatch();actions.get('返回店铺')();assert.equal(game.modal,'pause-leave');actions.get('继续当前游戏')();assert.equal(game.screen,'match');
  actions.get('返回店铺')();actions.get('确认返回店铺')();assert.equal(game.screen,'home');assert.equal(game.session,null);assert.equal(JSON.stringify(game.save.inventory),stock);assert.equal(game.save.energy,energy-1);
  game.screen='match';game.session=session;game.save.energy=0;game.save.energyAt=Date.now();game.pauseMatch();actions.get('重新开始')();actions.get('重开本关 · 1 体力')();assert.equal(game.modal,'pause-restart');assert.equal(game.session,session);assert.equal(game.save.energy,0);
});

test('craft restart is undoable and contest restart never changes the customer draft',()=>{
  const {game,actions}=pausedGame('craft'),draft=JSON.stringify(game.save.draft),energy=game.save.energy;
  game.pauseMatch();actions.get('重新开始')();actions.get('重新制作本件')();assert.ok(game.save.draft.every(n=>n===null));actions.get('撤销')();assert.equal(JSON.stringify(game.save.draft),draft);
  game.save.competitions.draft={id:'spring',beads:[3,...Array(11).fill(null)],charm:'moon'};game.screen='contestCraft';game.pauseMatch();actions.get('重新开始')();actions.get('重新制作本件')();assert.ok(game.save.competitions.draft.beads.every(n=>n===null));assert.equal(JSON.stringify(game.save.draft),draft);assert.equal(game.save.energy,energy);
  game.pauseMatch();actions.get('返回店铺')();assert.equal(game.screen,'home');assert.equal(game.save.competitions.draft.charm,'moon');assert.equal(JSON.stringify(game.save.draft),draft);
});

test('native controller connects chat, gift selection, delivery response, return visit and album memory', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.startStory=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  game.save={...rules.freshSave(),started:true,completed:['daisy'],orderId:'sea',inventory:Array(48).fill(100),gatheredStock:Array(48).fill(100),materialUnlocked:Array(48).fill(true)};
  const order=load(root+'/assets/scripts/content.ts').ORDERS.find(o=>o.id==='sea');
  game.save.draft=Array.from(order.palette);game.save.charm=order.charm;
  game.screen='craft';game.render();game.seaChat();
  assert.equal(game.modal,'sea-chat');actions.get('有什么让你担心的吗？')();
  actions.get('你最期待什么？')();actions.get('把这份心意记住')();
  game.confirmDelivery();assert.equal(game.screen,'packing');game.seaPacking();assert.equal(game.modal,'sea-packing');
  actions.get('害怕的时候，也可以慢慢走。')();
  actions.get('晨空蓝纸')();actions.get('海风蓝丝带')();
  actions.get('保存包装选择')();assert.equal(game.screen,'packing');game.deliverOrder();assert.equal(game.screen,'delivery');actions.get('继续营业')();assert.equal(game.modal,'sea-response');
  assert.equal(game.save.collection.find(x=>x.id==='sea').gift.blessing,'slow');
  actions.get('目送她出发')();
  const rose=load(root+'/assets/scripts/content.ts').ORDERS.find(o=>o.id==='rose');
  game.save=rules.deliver({...game.save,orderId:'rose',draft:Array.from(rose.palette),charm:rose.charm});
  game.render();actions.get('小满回来了 · 看旅行留影')();
  assert.equal(game.modal,'sea-visit');actions.get('添一颗小爱心')();
  assert.equal(game.modal,'sea-memory');assert.equal(game.save.seaHeart.visited,true);
  actions.get('看看后来这条手串')();assert.equal(game.modal,'collection');
  assert.equal(game.save.collection.find(x=>x.id==='sea').travelCharm,'heart');
  game.save=rules.normalizeSave(JSON.parse(JSON.stringify(game.save)));
  game.closeModal();game.screen='journal';game.render();
  assert.ok(actions.has('旅行留影 · 小满的第一次独行'));
});

test('competition board connects native craft, isolated undo, one-time awards and saved results', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,completed:['daisy'],draft:[0,...Array(11).fill(null)],charm:'heart'};
  const commission=game.save.draft.slice(),stock=game.save.inventory.slice(),coins=game.save.coins;
  game.screen='home';game.render();actions.get('参加比赛')();assert.equal(game.screen,'contest');
  actions.get('报名参加')();assert.equal(game.screen,'contestCraft');
  actions.get('参考配色')();actions.get('以此为起点排珠')();
  actions.get('放入珍珠')();actions.get('第1槽：翡翠')();actions.get('替换')();
  assert.equal(game.save.competitions.draft.beads[0],0);
  actions.get('撤销')();assert.equal(game.save.competitions.draft.beads[0],3);
  assert.deepEqual(game.save.draft,commission);assert.equal(game.save.charm,'heart');assert.deepEqual(game.save.inventory,stock);
  actions.get('提交参赛作品')();assert.equal(game.modal,'contest-submit');
  actions.get('提交评审')();assert.equal(game.modal,'contest-result');assert.equal(game.save.coins,coins+84);
  actions.get('收好这份纪念')();game.render();actions.get('查看参赛作品')();assert.equal(game.save.coins,coins+84);
  game.save=rules.normalizeSave(JSON.parse(JSON.stringify(game.save)));
  game.navigate('craft');assert.deepEqual(Array.from(game.workingDraft),[0,47,...Array(10).fill(null)]);assert.equal(game.workingCharm,'none');assert.deepEqual(game.save.inventory,stock);
  assert.equal(game.save.competitions.entries[0].medal,'银色巧思奖');
});

test('old completed saves retain their archive and can freely make, list and sell new works',()=>{
 const {game,actions}=pausedGame('home'),content=load(root+'/assets/scripts/content.ts');
 game.save.inventory=Array(48).fill(100);game.save.gatheredStock=Array(48).fill(100);game.save.materialUnlocked=Array(48).fill(true);for(const order of content.ORDERS)game.save=rules.deliver({...game.save,draft:Array.from(order.palette),charm:order.charm});
 game.save.deliveryReceipt=null;const archive=JSON.stringify(game.save.collection),coins=game.save.coins;
 game.render();actions.get('自由 DIY')();game.save.draft=Array(12).fill(1);game.save.charm='moon';game.render();
 actions.get('完成制作')();assert.equal(game.screen,'packing');actions.get('保存并上架')();assert.equal(game.modal,'listing');
 assert.equal(game.save.coins,coins);assert.equal(game.save.commerce.works[0].status,'ready');actions.get('确认上架')();
 assert.equal(game.save.commerce.works[0].status,'listing');assert.equal(game.screen,'orders');
 const trade=load(root+'/assets/scripts/commerce.ts');game.save=trade.settleSales(game.save,game.save.commerce.works[0].sellAt);
 assert.equal(game.save.coins,coins);game.salesTab='sold';game.render();actions.get('收钱 · 1')();assert.equal(game.save.coins,coins+game.save.commerce.works[0].price);assert.equal(JSON.stringify(game.save.collection),archive);
 assert.equal(game.save.completed.length,6);assert.equal(game.save.repeatOrders,0);
});

test('collection catalog derives real works, locked cards, chapter progress and native search without changing saves', () => {
  const game=new AtelierGame(),actions=new Map();let inputSearch;
  game.textures.set('pencil-floor',{name:'pencil-floor'});
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},search(value,input){inputSearch=input;},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  const {ORDERS}=load(root+'/assets/scripts/content.ts');
  game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(100),gatheredStock:Array(48).fill(100),materialUnlocked:Array(48).fill(true),draft:[0,...Array(11).fill(null)],charm:'heart'};
  game.legacyAlbum=true;game.navigate('album');assert.equal(game.snapshot().album.percent,0);assert.equal(game.snapshot().album.items.length,6);assert.ok(actions.has('未收集 · 给奶奶的一朵花'));
  actions.get('未收集 · 给奶奶的一朵花')();assert.equal(game.modal,'info');game.closeModal();game.render();
  const custom=[...ORDERS[0].palette].reverse();game.save=rules.deliver({...game.save,draft:custom,charm:ORDERS[0].charm});
  game.save.deliveryReceipt=null;game.navigate('album');const before=JSON.stringify(game.save);let view=game.snapshot().album;
  assert.equal(view.percent,17);assert.equal(view.collected,1);assert.deepEqual(Array.from(view.items[0].work.beads),custom);
  actions.get('欣赏给奶奶的一朵花')();assert.equal(game.modal,'collection');game.closeModal();game.render();
  actions.get('系列筛选 ▾')();actions.get('第一章')();view=game.snapshot().album;assert.equal(view.total,2);assert.equal(view.percent,50);assert.equal(view.items.length,2);
  inputSearch('小满');actions.get('搜索')();view=game.snapshot().album;assert.equal(view.items.length,1);assert.equal(view.items[0].id,'sea');assert.equal(view.percent,50,'Search must not pretend the series completion changed');
  inputSearch('<没有这件作品>');actions.get('搜索')();assert.equal(game.snapshot().album.items.length,0);assert.ok(actions.has('清空搜索'));actions.get('清空搜索')();assert.equal(game.snapshot().album.items.length,2);
  const nativeField=game.page.children.find(n=>n.name==='Collection search'),edit=nativeField.components.find(c=>c.maxLength===32);edit.string='珍珠';nativeField.events['text-changed']();nativeField.events['editing-return']();assert.equal(game.albumQuery,'珍珠');
  assert.equal(JSON.stringify(game.save),before);actions.get('制作新手串')();assert.equal(game.screen,'craft');assert.deepEqual(JSON.parse(JSON.stringify(game.save)),ringSave(JSON.parse(before)));
  game.navigate('album');actions.get('售珠')();assert.equal(game.screen,'orders');game.navigate('album');actions.get('手作')();assert.equal(game.screen,'craft');game.navigate('album');actions.get('装修')();assert.equal(game.screen,'decor');game.navigate('album');actions.get('小店')();assert.equal(game.screen,'home');
});

test('returning collection uses recent actual works and retains exact bracelets and story collection', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  const {ORDERS,RETURN_ORDERS}=load(root+'/assets/scripts/content.ts');
  game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(100),gatheredStock:Array(48).fill(100),materialUnlocked:Array(48).fill(true)};
  for(const order of ORDERS)game.save=rules.deliver({...game.save,draft:Array.from(order.palette),charm:order.charm});
  for(let i=0;i<8;i++){const o=rules.currentOrder(game.save);game.save=rules.deliver({...game.save,draft:Array.from(o.palette).reverse(),charm:o.charm});}
  game.save.deliveryReceipt=null;const before=JSON.stringify(game.save);game.legacyAlbum=true;game.navigate('album');actions.get('查看回头客作品')();let view=game.albumView();
  assert.equal(view.series,'回头客 · 近六单');assert.equal(view.collected,6);assert.equal(view.percent,100);assert.equal(view.items.find(o=>o.id===RETURN_ORDERS[1].id).work.number,8);
  assert.deepEqual(Array.from(view.items[0].work.beads),Array.from(RETURN_ORDERS[0].palette).reverse());actions.get('欣赏再送妈妈一朵花')();assert.equal(game.modal,'collection');game.closeModal();game.render();actions.get('查看剧情作品')();assert.equal(game.albumView().series,'全部剧情');assert.equal(JSON.stringify(game.save),before);
});

test('old commission entry points now open free DIY, and gathering is available with any stock',()=>{
 const {game,actions}=pausedGame('home'),before=JSON.stringify(game.save);game.navigate('orderArrival');assert.equal(game.screen,'craft');
 const labels=game.page.getComponentsInChildren(Label).map(l=>l.string);assert.ok(labels.includes('未解锁'));assert.equal(labels.includes('采珠获得材料后解锁'),false);
 assert.equal(JSON.stringify(game.save),before);actions.get('采珠')();assert.equal(game.modal,'intro');assert.ok([...actions.keys()].some(k=>k.startsWith('开始采珠 · ')));
 assert.equal(JSON.stringify(game.save),before);
});

test('DIY tools expand without changing progress and retain undo, preview and gathering',()=>{
 const {game,actions}=pausedGame('home');game.navigate('craft');
 const before=JSON.stringify(game.save),tools=['撤销','移除','替换','预览','参考配色','采珠'];
 const native=()=>game.page.children.filter(n=>n.name.startsWith('Button: ')).map(n=>n.name.slice(8));
 assert.ok(tools.every(name=>!native().includes(name)&&actions.has(name)));
 actions.get('工具')();assert.ok(tools.every(name=>native().includes(name)));assert.equal(JSON.stringify(game.save),before);
 actions.get('收起工具')();assert.ok(tools.every(name=>!native().includes(name)));assert.equal(JSON.stringify(game.save),before);
 actions.get('工具')();actions.get('采珠')();assert.equal(game.modal,'intro');assert.equal(game.craftToolsOpen,false);assert.equal(JSON.stringify(game.save),before);
});

test('native goal HUD supports four objectives and claiming a win grants the displayed order supply exactly once', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){},announce(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,level:15};
  game.session=rules.newSession(19,15);game.screen='match';game.render();
  assert.equal(game.goalLabels.length,4);assert.equal(game.boardNodes.length,64);
  assert.ok(game.obstacleNodes.filter(Boolean).length>0);
  game.session.status='won';game.session.collected=[40,20,10,20,0,10];
  const before=game.save.inventory.slice(),reward=rules.sessionRewards(game.session,game.save),types=game.session.materialTypes.slice();
  game.result();actions.get('收好珠材 · 回工坊')();
  assert.equal(game.screen,'craft');assert.equal(game.save.level,16);
  assert.deepEqual(game.save.inventory,before.map((n,i)=>n+(reward[types.indexOf(i)]||0)));
  game.claim();assert.deepEqual(game.save.inventory,before.map((n,i)=>n+(reward[types.indexOf(i)]||0)));
});

test('reduced-motion renovation commits the purchase and opens grandmother response without locking controls', async () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){},announce(){},busy(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,coins:1000};
  game.textures.set('pencil-floor',{name:'pencil-floor'});
  game.save.renovation.cleared=load(root+'/assets/scripts/content.ts').CLEAN_SPOTS.map(s=>s.id);
  game.screen='decor';const next=rules.repairShop(game.save,'window');
  await game.revealRenovation(next,'window');
  assert.equal(game.modal,'renovation');assert.equal(game.busy,false);assert.equal(game.save.renovation.repairs.window,true);
  assert.equal(game.save.coins,next.coins);assert.ok(actions.has('看看我们的新角落'));
  actions.get('看看我们的新角落')();assert.equal(game.modal,'');
});

test('native receipt displays the paid bracelet and only continues the story after closing settlement', () => {
  const game=new AtelierGame(),actions=new Map();let stored=null,stories=0;
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{stored=JSON.parse(JSON.stringify(game.save));};game.scheduleOnce=()=>{};game.toast=()=>{};game.startStory=()=>stories++;
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){},announce(){}};
  const order=load(root+'/assets/scripts/content.ts').ORDERS[0];
  game.save={...rules.freshSave(),charm:"daisy",started:true,reduced:true,inventory:Array(48).fill(20),gatheredStock:Array(48).fill(20),materialUnlocked:Array(48).fill(true),draft:[...order.palette]};
  game.screen='craft';game.deliverOrder();
  assert.equal(game.screen,'delivery');assert.equal(game.modal,'');assert.equal(stories,0);
  assert.equal(stored.coins,260);assert.deepEqual(rules.pendingDelivery(stored).work.beads,Array.from(order.palette));
  game.deliverOrder();assert.equal(game.save.coins,260);assert.equal(game.save.collection.length,1);
  game.save=rules.normalizeSave(stored);game.render();assert.ok(actions.has('继续营业'));
  actions.get('继续营业')();assert.equal(game.modal,'first-feedback');assert.equal(stories,0);assert.equal(game.save.deliveryReceipt,null);
  actions.get('领取下一份委托')();assert.equal(game.screen,'craft');assert.equal(game.currentOrder().id,'sea');
  game.continueDelivery();assert.equal(stories,0);assert.equal(game.save.coins,260);
});

test('dialogue records only reveal read lines and returning or dismissing keeps the current story state', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
  game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  game.save={...rules.freshSave(),started:true,reduced:true};game.screen='home';
  const story=load(root+'/assets/scripts/content.ts').STORIES[0],coins=game.save.coins,stock=game.save.inventory.slice();
  game.startStory(0);assert.equal(game.dialogueState.speaker,'往事');
  for(let i=0;i<4;i++)actions.get('下一句  →')();
  assert.equal(game.storyLine,4);assert.equal(game.dialogueState.speaker,'奶奶');
  actions.get('记录')();assert.equal(game.modal,'dialogue-record');
  const strings=n=>[...n.components.filter(c=>c instanceof Label).map(c=>c.string),...n.children.flatMap(strings)];
  assert.ok(strings(game.overlay).includes(story.lines[4][1]));assert.equal(strings(game.overlay).includes(story.lines[5][1]),false);
  actions.get('上一页')();assert.ok(strings(game.overlay).includes(story.lines[2][1]));
  game.dismiss();assert.equal(game.modal,'story');assert.equal(game.storyLine,4);
  actions.get('记录')();actions.get('返回对话')();assert.equal(game.storyLine,4);
  game.dismiss();assert.equal(game.modal,'');assert.equal(game.save.seenStories.length,0);
  game.startStory(0);actions.get('跳过')();assert.equal(game.modal,'');assert.equal(game.save.seenStories.length,1);
  game.startStory(0);actions.get('跳过')();assert.equal(game.save.seenStories.length,1);
  assert.equal(game.save.coins,coins);assert.deepEqual(game.save.inventory,stock);
});

test('dialogue templates change presentation while the speaker and dialogue stay live', () => {
  const game=new AtelierGame();game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.save=rules.freshSave();game.screen='home';game.storyLine=4;
  const template=new Node('Moved speaker');template.setPosition(98,-951);
  template.addComponent(UITransform).setAnchorPoint(0,1);template.getComponent(UITransform).setContentSize(510,58);
  const key=layoutKey('dialogue',82,947,550,58,new Map());game.layouts.set(key,template);
  game.storyText();
  const label=[...game.layoutKeys].find(([node,k])=>k===key)?.[0].getComponent(Label);
  assert.equal(label.string,'奶奶');assert.equal(label.node.position.x,98);
  game.storyLine=3;game.storyText();
  assert.equal([...game.layoutKeys].find(([node,k])=>k===key)?.[0].getComponent(Label).string,'阿禾');
});

test('dialogue renders only its current speaker portrait, including first order, transcript return and offscreen speech',()=>{
  const game=new AtelierGame();game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.save=rules.freshSave();game.screen='home';
  const portraits=()=>game.overlay.children[0].children.filter(n=>/^pencil-(speaker-|dialogue-lin)/.test(n.name)).map(n=>n.name);
  for(const [line,expected] of [[4,['pencil-speaker-grandma']],[5,['pencil-speaker-ahe']],[0,[]],[2,[]]]){
    game.storyLine=line;game.storyText();assert.deepEqual(portraits(),expected);
  }
  game.storyLine=4;game.storyText();game.dialogueRecord('记录',[['奶奶','测试']],()=>game.storyText());game.dismiss();
  assert.deepEqual(portraits(),['pencil-speaker-grandma']);
  const save=JSON.stringify(game.save);game.firstOrder();assert.equal(game.modal,'welcome-diy');
  assert.equal(JSON.stringify(game.save),save);
  game.dialogueStage('first-order','早年的相遇','林阿姨','谢谢你',[],()=>{},()=>{});
  assert.deepEqual(portraits(),['pencil-dialogue-lin']);
  game.dialogueStage('sea-chat','小满的故事','小满','画外对话',[],()=>{},()=>{});
  assert.deepEqual(portraits(),[],'never substitute a different person for an offscreen speaker');
  assert.ok(game.overlay.children[0].children.some(n=>n.name==='pencil-first-order-stage'));
});

test('character memory navigation, locked tiles, replay and crafting preserve actual commission and economy', () => {
 const game=new AtelierGame(),actions=new Map();
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,seenStories:['old-table'],draft:[0,...Array(11).fill(null)]};game.screen='journal';game.render();
 const before=JSON.stringify(game.save);actions.get('人物故事 · 回忆')();assert.equal(game.screen,'memories');assert.equal(game.memoryView().id,'grandma');
 actions.get('未相识的人物 3')();assert.equal(game.memoryView().id,'grandma');
 actions.get('重温这段回忆')();assert.equal(game.modal,'story');actions.get('跳过')();assert.equal(game.screen,'memories');
 actions.get('回忆阿禾')();assert.equal(game.memoryView().id,'ahe');actions.get('开始自由制作')();assert.equal(game.screen,'craft');assert.equal(game.currentOrder().id,'daisy');
 assert.equal(JSON.stringify(game.save),before);
});

test('finished DIY preview can return unchanged and saves actual materials only once without paying',()=>{
 const {game,actions}=pausedGame('craft');game.save.inventory=Array(48).fill(50);game.save.gatheredStock=Array(48).fill(50);game.save.materialUnlocked=Array(48).fill(true);game.save.draft=Array(12).fill(2);game.save.charm='heart';
 game.navigate('craft');
 const before=JSON.stringify(game.save),coins=game.save.coins;game.confirmDelivery();assert.equal(game.screen,'packing');
 assert.deepEqual(game.snapshot().packing.beads,game.save.draft);assert.equal(JSON.stringify(game.save),before);
 actions.get('返回修改')();assert.equal(JSON.stringify(game.save),before);game.confirmDelivery();actions.get('保存作品')();
 assert.equal(game.screen,'orders');assert.equal(game.save.commerce.works.length,1);assert.equal(game.save.coins,coins);assert.equal(game.save.inventory[2],38);
 const saved=JSON.stringify(game.save);game.completePacking();assert.equal(JSON.stringify(game.save),saved);
});

test('free DIY never rewrites the gifts or original works in imported sea memories',()=>{
 const {game}=pausedGame('craft'),orders=load(root+'/assets/scripts/content.ts').ORDERS;
 game.save.inventory=Array(48).fill(50);game.save.gatheredStock=Array(48).fill(50);for(const order of orders.slice(0,2))game.save=rules.deliver({...game.save,draft:Array.from(order.palette),charm:order.charm});
 game.save.deliveryReceipt=null;const archive=JSON.stringify(game.save.collection),heart=JSON.stringify(game.save.seaHeart);
 game.save.draft=Array(12).fill(3);game.save.charm='heart';game.confirmDelivery();game.completePacking();
 assert.equal(game.save.commerce.works.length,1);assert.equal(JSON.stringify(game.save.collection),archive);assert.equal(JSON.stringify(game.save.seaHeart),heart);
});

test('story map opens actual unlocked stories, shows locked conditions and keeps commissions and resources unchanged',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
 game.save={...rules.freshSave(),started:true,reduced:true};const before=JSON.stringify(game.save);game.screen='home';game.render();
 actions.get('故事与手账')();assert.equal(game.modal,'story-journal');actions.get('故事解锁')();assert.equal(game.screen,'storyMap');actions.get('解锁条件 · 饰品小店')();assert.equal(game.modal,'');assert.equal(JSON.stringify(game.save),before);
 actions.get('继续故事')();assert.equal(game.modal,'story');assert.equal(game.storyIndex,0);actions.get('跳过')();assert.equal(game.screen,'storyMap');assert.equal(game.snapshot().storyRoute.read,1);assert.equal(game.save.coins,80);
 actions.get('制作手串 · 解锁故事')();assert.equal(game.screen,'craft');assert.equal(game.currentOrder().id,'daisy');
 game.save.completed=['daisy'];game.navigate('storyMap');actions.get('查看章节 · 旧工作间')();assert.equal(game.modal,'route-chapter');assert.equal(actions.has('阅读 · 待解锁'),false);
 actions.get('阅读 · 第一张收据，我自己收着')();actions.get('跳过')();const completed=JSON.stringify(game.save);
 actions.get('查看章节 · 旧工作间')();actions.get('重温 · 第一张收据，我自己收着')();actions.get('跳过')();assert.equal(JSON.stringify(game.save),completed);
 actions.get('回忆手账')();assert.equal(game.screen,'journal');assert.ok(actions.has('人物故事 · 回忆'));
});

test('enlarged collection keeps actual materials and archive stories read-only, and remakes only the current commission with undo',()=>{
 const {ORDERS}=load(root+'/assets/scripts/content.ts'),game=new AtelierGame(),actions=new Map();
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(48).fill(100),gatheredStock:Array(48).fill(100),materialUnlocked:Array(48).fill(true)};
 for(const o of ORDERS.slice(0,2))game.save=rules.deliver({...game.save,draft:Array.from(o.palette).reverse(),charm:o.charm});
 game.save.deliveryReceipt=null;game.save.collection[1].gift={blessing:'slow',paper:'sky',ribbon:'blue'};game.save.collection[1].travelCharm='heart';
 game.save.draft=[1,...Array(11).fill(null)];game.save.charm='heart';game.screen='album';game.albumQuery='小满';
 const before=JSON.stringify(game.save);game.collectionPreview('sea');let detail=game.snapshot().collectionDetail;
 assert.equal(game.modal,'collection');assert.equal(detail.name,ORDERS[1].name);assert.equal(detail.storyId,'stolen-design');
 assert.deepEqual(Array.from(detail.work.beads),Array.from(ORDERS[1].palette).reverse());
 assert.equal(detail.materials.reduce((n,m)=>n+m.count,0),14);assert.equal(detail.blessing,'害怕的时候，也可以慢慢走。');assert.match(detail.wrapping,/蓝/);
 actions.get('查看订单故事')();assert.equal(game.modal,'collection-story');assert.equal(game.dialogueState.text,ORDERS[1].text);
 actions.get('下一句  →')();actions.get('记录')();game.dismiss();assert.equal(game.modal,'collection-story');game.dismiss();assert.equal(game.modal,'collection');
 assert.equal(JSON.stringify(game.save),before);assert.equal(game.albumQuery,'小满');
 actions.get('再做一条')();assert.equal(game.modal,'collection-remake');game.dismiss();assert.equal(JSON.stringify(game.save),before);
 actions.get('再做一条')();actions.get('按此配色自由制作')();assert.equal(game.screen,'craft');assert.equal(game.currentOrder().id,'rose');
 assert.deepEqual(Array.from(game.save.draft),[...Array.from(ORDERS[1].palette).reverse(),materials.charmType('moon')]);assert.equal(game.save.collection[1].charm,'moon');assert.equal(game.save.coins,JSON.parse(before).coins);
 assert.equal(JSON.stringify(game.save.inventory),JSON.stringify(JSON.parse(before).inventory));assert.equal(Object.values(rules.checkOrder(game.save)).every(Boolean),false);
 actions.get('撤销')();assert.deepEqual(JSON.parse(JSON.stringify(game.save)),ringSave(JSON.parse(before)));
 game.collectionPreview('missing');assert.equal(game.modal,'info');assert.equal(game.snapshot().collectionDetail,null);assert.deepEqual(JSON.parse(JSON.stringify(game.save)),ringSave(JSON.parse(before)));
});

test('welcome close and free-craft actions persist the first craft milestone once, including the legacy dialog id',()=>{
 for(const route of ['close','free','legacy'])for(const timestamp of [undefined,100]){
  const {game,actions}=pausedGame('home');game.node=new Node('AtelierGame');
  game.save.firstSteps=timestamp?{craft:timestamp}:{};const before=JSON.stringify(game.save);let persisted;
  game.persist=()=>{persisted=JSON.stringify(game.save);};game.firstOrder();
  assert.equal(game.modal,'welcome-diy');
  if(route==='legacy')game.modal='first-order';
  if(route==='free')actions.get('自由做一条')();else actions.get('×')();
  assert.equal(game.screen,'craft');assert.equal(game.modal,'');assert.ok(game.save.firstSteps.craft);
  if(timestamp)assert.equal(game.save.firstSteps.craft,timestamp);
  assert.equal(persisted,JSON.stringify(game.save));assert.equal(game.save.firstSteps.secondOrder,undefined);
  assert.deepEqual({...JSON.parse(persisted),firstSteps:{}},{...JSON.parse(before),firstSteps:{}});
  const first=game.save.firstSteps.craft;game.firstOrder();game.dismiss();assert.equal(game.save.firstSteps.craft,first);
 }
});

test('busy welcome exits leave both save and modal untouched until navigation is available',()=>{
 for(const route of ['close','free']){
  const {game,actions}=pausedGame('home');game.node=new Node('AtelierGame');game.firstOrder();
  const before=JSON.stringify(game.save);let writes=0;game.persist=()=>{writes++;};game.busy=true;
  if(route==='free')actions.get('自由做一条')();else game.dismiss();
  assert.equal(JSON.stringify(game.save),before);assert.equal(writes,0);assert.equal(game.modal,'welcome-diy');assert.equal(game.screen,'home');
  game.busy=false;game.dismiss();assert.equal(game.screen,'craft');assert.ok(game.save.firstSteps.craft);assert.equal(writes,1);
 }
 const {game}=pausedGame('home');game.info('普通提示','保持普通关闭行为');game.dismiss();assert.equal(game.screen,'home');assert.equal(game.modal,'');assert.equal(game.save.firstSteps.craft,undefined);
});

test('starting and restarting gathering preserve partial energy recovery and restart the clock only from full',()=>{
 const {game}=pausedGame('home');game.node=new Node('AtelierGame');game.save.energy=5;
 const clock=Date.now()-120000;game.save.energyAt=clock;game.startMatch();
 assert.equal(game.save.energy,4);assert.equal(game.save.energyAt,clock);
 assert.equal(rules.refreshEnergy(game.save,clock+180000).energy,5);
 game.startMatch();assert.equal(game.save.energy,3);assert.equal(game.save.energyAt,clock);
 game.save.energy=10;game.save.energyAt=clock;const now=Date.now();game.startMatch();
 assert.equal(game.save.energy,9);assert.ok(game.save.energyAt>=now);
});

test('third furniture tiers expose their native room decorations and disable further upgrades',()=>{
 const {game,actions}=pausedGame('decor');game.node=new Node('AtelierGame');
 game.textures.set('pencil-floor',{name:'pencil-floor'});
 game.save.upgrades={chair:3,display:3,desk:3};game.render();
 for(const name of ['Cabinet gilded trim','Desk lamp shade','Chair embroidered cushion'])assert.ok(game.page.children.some(n=>n.name===name));
 assert.equal(actions.has('升级 undefined 金'),false);assert.equal(actions.has('已升满'),false);
});

test('early failed gathering banks every collected color once through result, Escape and reload; first order opens without a long story',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.scheduleOnce=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){},announce(){}};
 game.save={...rules.freshSave(),reduced:true};game.screen='cover';game.render();actions.get('打开小店  →')();assert.equal(game.modal,'welcome-diy');actions.get('自由做一条')();assert.equal(game.screen,'craft');
 const stock=game.save.inventory.slice();game.session={...rules.newSession(91,1),status:'lost',moves:0,collected:[20,10,30,0,0,10]};game.screen='match';game.result();
 assert.deepEqual(game.save.inventory,stock.map((n,i)=>n+(rules.gatheredMaterials(game.session)[game.session.materialTypes.indexOf(i)]||0)));const saved=JSON.stringify(game.save);game.result();assert.equal(JSON.stringify(game.save),saved);
 game.dismiss();assert.equal(game.screen,'craft');assert.equal(game.session,null);assert.equal(JSON.stringify(game.save),saved);
 assert.deepEqual(rules.normalizeSave(JSON.parse(saved)).inventory,game.save.inventory);
});

test('material taps add randomly when unselected and replace the selected slot with stock and undo guards',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),reduced:true,inventory:[2,2,0,2,0,0,...Array(42).fill(0)],gatheredStock:[2,2,0,2,0,0,...Array(42).fill(0)],materialUnlocked:Array(48).fill(true)};game.screen='craft';game.render();
 actions.get('第1槽：空槽')();assert.equal(game.save.draft.filter(n=>n!==null).length,0);
 for(const name of ['珍珠','玛瑙','翡翠','珍珠','玛瑙','翡翠']){
  const before=game.save.draft.slice();game.slot=-1;actions.get('放入'+name)();
  const changed=game.save.draft.map((n,i)=>n!==before[i]?i:-1).filter(i=>i>=0);assert.equal(changed.length,1);assert.equal(before[changed[0]],null);
 }
 const stock=game.save.inventory.slice(),draft=game.save.draft.slice();actions.get('放入珍珠')();assert.deepEqual(game.save.draft,draft);actions.get('放入蓝晶石')();assert.deepEqual(game.save.draft,draft);
 actions.get('撤销')();assert.equal(game.save.draft.filter(n=>n!==null).length,5);assert.deepEqual(game.save.inventory,stock);
 game.save.inventory=Array(48).fill(20);game.save.gatheredStock=Array(48).fill(20);game.save.draft=Array(12).fill(0);game.render();const full=game.save.draft.slice();actions.get('放入翡翠')();assert.deepEqual(game.save.draft,[...full,3]);
 actions.get('第1槽：珍珠')();actions.get('放入翡翠')();assert.equal(game.save.draft[0],3);assert.equal(game.save.draft.filter(n=>n!==null).length,13);actions.get('撤销')();assert.deepEqual(Array.from(game.save.draft),[...full,3]);
 actions.get('第1槽：珍珠')();const history=game.undo.length;actions.get('放入珍珠')();assert.equal(game.undo.length,history);assert.equal(game.slot,0);
 game.save.inventory[2]=0;actions.get('放入蓝晶石')();assert.deepEqual(Array.from(game.save.draft),[...full,3]);assert.equal(game.slot,0);assert.equal(game.undo.length,history);
 actions.get('替换')();assert.deepEqual(Array.from(game.save.draft),[...full,3]);
 game.save.draft=Array(12).fill(null);game.save.draft[4]=0;game.slot=4;game.render();actions.get('放入翡翠')();assert.equal(game.save.draft[4],3);assert.equal(game.save.draft.filter(n=>n!==null).length,1);
 game.slot=7;actions.get('放入玛瑙')();assert.equal(game.save.draft[7],1);assert.equal(game.save.draft.filter(n=>n!==null).length,2);
 assert.deepEqual(game.save.inventory,[20,20,0,20,20,20,...Array(42).fill(20)]);
});

test('double taps remove one bead across native rerenders, while slow taps, other slots, dragging and cancellation do not',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),reduced:true,draft:[0,1,2,...Array(9).fill(null)]};game.screen='craft';game.render();
 const touch=i=>{const p=game.slotPos(i);return {getUILocation:()=>({x:p.x,y:1280-p.y})};};
 const tap=i=>{const n=game.slotNodes[i];n.events.start(touch(i));n.events.end(touch(i));};
 const stock=game.save.inventory.slice();tap(0);const firstNode=game.slotNodes[0];assert.equal(game.slot,0);assert.equal(game.undo.length,0);
 tap(0);assert.notEqual(game.slotNodes[0],firstNode);assert.equal(game.save.draft[0],null);assert.equal(game.slot,-1);assert.equal(game.undo.length,1);
 actions.get('撤销')();assert.equal(game.save.draft[0],0);assert.equal(game.craftTap,null);
 tap(0);game.craftTap.at-=500;tap(0);assert.equal(game.save.draft[0],0);assert.equal(game.slot,-1);assert.equal(game.undo.length,0);
 game.craftTap=null;game.slot=0;tap(0);tap(0);assert.equal(game.save.draft[0],null,'double tap also removes an already selected bead');actions.get('撤销')();
 tap(0);tap(1);assert.equal(game.save.draft[0],0);assert.equal(game.save.draft[1],1);tap(1);assert.equal(game.save.draft[1],null);actions.get('撤销')();
 tap(8);tap(8);assert.equal(game.undo.length,0);assert.equal(game.save.draft[8],null);
 tap(0);game.slotNodes[0].events.start(touch(0));game.slotNodes[0].events.cancel();tap(0);assert.equal(game.save.draft[0],0);
 const n=game.slotNodes[0];n.events.start(touch(0));n.events.move(touch(1));n.events.end(touch(1));assert.equal(game.craftTap,null);assert.equal(game.save.draft[1],0);tap(1);assert.equal(game.save.draft[1],0);
 assert.deepEqual(game.save.inventory,stock);
});

test('native daily entry previews seven days, claims once, preserves materials and shows completed status',()=>{
 const {game,actions}=pausedGame('home');game.save.energy=5;game.save.energyAt=Date.now();game.render();
 assert.ok(actions.has('每日签到'));const stock=JSON.stringify([game.save.inventory,game.save.gatheredStock,game.save.materialUnlocked]);const coins=game.save.coins;
 actions.get('每日签到')();assert.equal(game.modal,'daily');assert.equal(game.save.coins,coins);assert.equal(game.overlay.children.filter(n=>n.name.startsWith('Daily day ')).length,7);
 const claim=actions.get('领取今日奖励');claim();claim();assert.equal(game.save.coins,coins+30);assert.equal(game.save.energy,6);assert.equal(game.save.daily.streak,1);
 assert.equal(actions.has('领取今日奖励'),false);assert.ok(game.page.children.some(n=>n.name==='Button: 今日已签到'));assert.equal(JSON.stringify([game.save.inventory,game.save.gatheredStock,game.save.materialUnlocked]),stock);
 game.dismiss();game.render();actions.get('今日已签到')();assert.equal(game.modal,'daily');assert.equal(game.save.coins,coins+30);
});
