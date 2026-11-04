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

test('commission pages keep every order reachable and open on the current customer without changing saves', () => {
  const game=new AtelierGame(),actions=new Map();
  game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){},closeDialog(){}};
  game.save={...rules.freshSave(),started:true};
  const before=JSON.stringify(game.save);
  game.navigate('orders');
  const cards=()=>game.page.children.filter(n=>n.name.startsWith('Order '));
  assert.deepEqual(cards().map(n=>n.name),['Order daisy','Order sea','Order rose']);
  assert.ok(actions.has('按单制作 180金'));assert.equal(actions.has('← 前三份'),false);
  actions.get('后三份 →')();assert.equal(game.ordersPage,1);assert.equal(cards().length,3);
  assert.equal(actions.has('后三份 →'),false);actions.get('← 前三份')();assert.equal(game.ordersPage,0);
  assert.equal(JSON.stringify(game.save),before);
  const content=load(root+'/assets/scripts/content.ts');
  game.save.completed=content.ORDERS.slice(0,4).map(o=>o.id);game.save.orderId=content.ORDERS[4].id;
  game.navigate('orders');assert.equal(game.ordersPage,1);
  actions.get('按单制作 '+content.ORDERS[4].reward+'金')();assert.equal(game.screen,'orderArrival');
  assert.equal(game.currentOrder().id,content.ORDERS[4].id);
  game.save.completed=content.ORDERS.map(o=>o.id);game.save.repeatOrders=4;game.navigate('orders');
  assert.equal(game.ordersPage,1);assert.ok(cards().some(n=>n.name==='Order '+game.currentOrder().id));
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
  assert.ok(pages[0]._children.map(r=>scene[r.__id__]).some(n=>n._name==='Commission palette preview'));
  assert.ok(scene.some(n=>n.__type__==='cc.Sprite'&&n._type===1));
  const keys = scene.filter(n => n.key).map(n => n.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const object of scene) {
    for (const r of [...(object._children || []), ...(object._components || [])]) assert.ok(scene[r.__id__]);
  }
});

test('home previews the current commission recipe and charm without consuming stock or changing the player draft',()=>{
  const game=new AtelierGame();game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  const {ORDERS,RETURN_ORDERS}=load(root+'/assets/scripts/content.ts');
  for(let i=0;i<=ORDERS.length;i++){
    const order=i===ORDERS.length?RETURN_ORDERS[0]:ORDERS[i];
    game.save={...rules.freshSave(),started:true,completed:ORDERS.slice(0,i).map(o=>o.id),orderId:order.id,draft:Array(12).fill(1)};
    const before=JSON.stringify(game.save);game.screen='home';game.render();
    const preview=game.page.children.find(n=>n.name==='Commission palette preview');
    assert.deepEqual(preview.children.filter(n=>/^bead-\d$/.test(n.name)).map(n=>Number(n.name.at(-1))),Array.from(order.palette));
    assert.ok(preview.children.some(n=>n.name==='charm-'+order.charm));
    assert.equal(JSON.stringify(game.save),before);
  }
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
    const recess=slot.children.find(n=>n.name==='Slot recess').getComponent(UITransform).contentSize;
    assert.equal(recess.width,recess.height);
  }
});

test('commission workshop previews its real draft and validates before entering packing', () => {
  const game=new AtelierGame(),actions=new Map();
  game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.toast=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){}};
  game.save={...rules.freshSave(),reduced:true,inventory:Array(6).fill(100)};game.screen='craft';game.render();
  const before=JSON.stringify(game.save),rendered=[];
  const original=game.bracelet.bind(game);game.bracelet=(beads,...args)=>{rendered.push([...beads]);return original(beads,...args);};
  actions.get('完成制作')();assert.equal(game.screen,'craft');
  actions.get('放入月光珍珠')();assert.equal(game.workingDraft.filter(n=>n!==null).length,1);
  const partial=JSON.stringify(game.save);actions.get('预览')();
  assert.equal(game.modal,'craft-preview');assert.deepEqual(rendered.at(-1),Array.from(game.save.draft));assert.equal(JSON.stringify(game.save),partial);
  actions.get('继续制作')();assert.equal(game.modal,'');
  const index=game.save.draft.findIndex(n=>n!==null);actions.get(`第${index+1}槽：月光珍珠`)();actions.get('移除')();
  assert.ok(game.save.draft.every(n=>n===null));actions.get('撤销')();assert.equal(game.save.draft[index],0);
  actions.get('参考配色')();actions.get('按参考排珠')();
  const stocked=JSON.stringify(game.save);actions.get('完成制作')();assert.equal(game.modal,'first-finished');actions.get('装进礼盒')();assert.equal(game.screen,'packing');assert.equal(JSON.stringify(game.save),stocked);
  assert.equal(game.save.coins,JSON.parse(before).coins);assert.deepEqual(game.save.inventory,Array(6).fill(100));
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
  game.pauseMatch();actions.get('重新开始')();actions.get('重新制作本单')();assert.ok(game.save.draft.every(n=>n===null));actions.get('撤销')();assert.equal(JSON.stringify(game.save.draft),draft);
  game.save.competitions.draft={id:'spring',beads:[3,...Array(11).fill(null)],charm:'moon'};game.screen='contestCraft';game.pauseMatch();actions.get('重新开始')();actions.get('重新制作本单')();assert.ok(game.save.competitions.draft.beads.every(n=>n===null));assert.equal(JSON.stringify(game.save.draft),draft);assert.equal(game.save.energy,energy);
  game.pauseMatch();actions.get('返回店铺')();assert.equal(game.screen,'home');assert.equal(game.save.competitions.draft.charm,'moon');assert.equal(JSON.stringify(game.save.draft),draft);
});

test('native controller connects chat, gift selection, delivery response, return visit and album memory', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.startStory=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  game.save={...rules.freshSave(),started:true,completed:['daisy'],orderId:'sea',inventory:Array(6).fill(100)};
  const order=load(root+'/assets/scripts/content.ts').ORDERS.find(o=>o.id==='sea');
  game.save.draft=Array.from(order.palette);game.save.charm=order.charm;
  game.screen='craft';game.render();actions.get('听故事')();
  assert.equal(game.modal,'sea-chat');actions.get('有什么让你担心的吗？')();
  actions.get('你最期待什么？')();actions.get('把这份心意记住')();
  game.confirmDelivery();assert.equal(game.screen,'packing');actions.get('挑选祝福与包装')();assert.equal(game.modal,'sea-packing');
  actions.get('害怕的时候，也可以慢慢走。')();
  actions.get('晨空蓝纸')();actions.get('海风蓝丝带')();
  actions.get('保存包装选择')();assert.equal(game.screen,'packing');actions.get('完成包装')();assert.equal(game.screen,'delivery');actions.get('继续营业')();assert.equal(game.modal,'sea-response');
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
  actions.get('放入月光珍珠')();actions.get('第1槽：森绿玉珠')();actions.get('替换')();
  assert.equal(game.save.competitions.draft.beads[0],0);
  actions.get('撤销')();assert.equal(game.save.competitions.draft.beads[0],3);
  assert.deepEqual(game.save.draft,commission);assert.equal(game.save.charm,'heart');assert.deepEqual(game.save.inventory,stock);
  actions.get('提交参赛作品')();assert.equal(game.modal,'contest-submit');
  actions.get('提交评审')();assert.equal(game.modal,'contest-result');assert.equal(game.save.coins,coins+60);
  actions.get('收好这份纪念')();game.render();actions.get('查看参赛作品')();assert.equal(game.save.coins,coins+60);
  game.save=rules.normalizeSave(JSON.parse(JSON.stringify(game.save)));
  game.navigate('craft');assert.deepEqual(Array.from(game.workingDraft),commission);assert.equal(game.workingCharm,'heart');
  assert.equal(game.save.competitions.entries[0].medal,'金色灵感奖');
});

test('an old completed save opens a real customer order, delivers it and keeps receiving commissions', () => {
  const game=new AtelierGame(),actions=new Map(),messages=[];
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=message=>messages.push(message);
  game.startStory=()=>assert.fail('Returning orders must not replay first-time stories');
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(100),completed:['daisy','sea','rose','forest','violet','promise'],orderId:'promise'};
  game.save=rules.normalizeSave(game.save);game.screen='home';game.render();
  assert.ok(actions.has('按单制作'));actions.get('按单制作')();actions.get('开始制作')();
  assert.equal(game.currentOrder().customer,'林阿姨');
  assert.equal(actions.has('欣赏作品'),false);
  actions.get('完成制作')();assert.equal(game.modal,'');
  assert.match(messages.at(-1),/串满/);
  actions.get('参考配色')();actions.get('按参考排珠')();
  actions.get('完成制作')();assert.equal(game.screen,'packing');
  actions.get('完成包装')();
  assert.equal(game.save.repeatOrders,1);assert.equal(game.save.coins,260);
  assert.equal(game.save.completed.length,6);assert.equal(game.save.repeatCollection.length,1);
  assert.equal(game.screen,'delivery');actions.get('继续营业')();
  actions.get('按单制作')();actions.get('开始制作')();assert.equal(game.currentOrder().customer,'花店小满');
  assert.equal(actions.has('听故事'),false);
  actions.get('参考配色')();actions.get('按参考排珠')();
  actions.get('完成制作')();assert.equal(game.screen,'packing');
  actions.get('完成包装')();assert.equal(game.save.repeatOrders,2);
  actions.get('继续营业')();
  game.navigate('album');actions.get('查看回头客作品')();
  assert.ok(actions.has('欣赏再送妈妈一朵花'));
  assert.ok(actions.has('欣赏送给旅途中的朋友'));
});

test('collection catalog derives real works, locked cards, chapter progress and native search without changing saves', () => {
  const game=new AtelierGame(),actions=new Map();let inputSearch;
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},search(value,input){inputSearch=input;},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  const {ORDERS}=load(root+'/assets/scripts/content.ts');
  game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(100),draft:[0,...Array(11).fill(null)],charm:'heart'};
  game.navigate('album');assert.equal(game.snapshot().album.percent,0);assert.equal(game.snapshot().album.items.length,6);assert.ok(actions.has('未收集 · 给奶奶的一朵花'));
  actions.get('未收集 · 给奶奶的一朵花')();assert.equal(game.modal,'info');game.closeModal();game.render();
  const custom=[...ORDERS[0].palette].reverse();game.save=rules.deliver({...game.save,draft:custom,charm:ORDERS[0].charm});
  game.save.deliveryReceipt=null;game.navigate('album');const before=JSON.stringify(game.save);let view=game.snapshot().album;
  assert.equal(view.percent,17);assert.equal(view.collected,1);assert.deepEqual(Array.from(view.items[0].work.beads),custom);
  actions.get('欣赏给奶奶的一朵花')();assert.equal(game.modal,'collection');game.closeModal();game.render();
  actions.get('系列筛选 ▾')();actions.get('第一章')();view=game.snapshot().album;assert.equal(view.total,2);assert.equal(view.percent,50);assert.equal(view.items.length,2);
  inputSearch('小满');actions.get('搜索')();view=game.snapshot().album;assert.equal(view.items.length,1);assert.equal(view.items[0].id,'sea');assert.equal(view.percent,50,'Search must not pretend the series completion changed');
  inputSearch('<没有这件作品>');actions.get('搜索')();assert.equal(game.snapshot().album.items.length,0);assert.ok(actions.has('清空搜索'));actions.get('清空搜索')();assert.equal(game.snapshot().album.items.length,2);
  const nativeField=game.page.children.find(n=>n.name==='Collection search'),edit=nativeField.components.find(c=>c.maxLength===32);edit.string='珍珠';nativeField.events['text-changed']();nativeField.events['editing-return']();assert.equal(game.albumQuery,'珍珠');
  assert.equal(JSON.stringify(game.save),before);actions.get('制作新手串')();assert.equal(game.screen,'orderArrival');assert.equal(JSON.stringify(game.save),before);
  game.navigate('album');actions.get('任务')();assert.equal(game.screen,'orders');game.navigate('album');actions.get('我的')();assert.equal(game.screen,'journal');game.navigate('album');actions.get('店铺')();assert.equal(game.screen,'home');
});

test('returning collection uses recent actual works and retains exact bracelets and story collection', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  const {ORDERS,RETURN_ORDERS}=load(root+'/assets/scripts/content.ts');
  game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(100)};
  for(const order of ORDERS)game.save=rules.deliver({...game.save,draft:Array.from(order.palette),charm:order.charm});
  for(let i=0;i<8;i++){const o=rules.currentOrder(game.save);game.save=rules.deliver({...game.save,draft:Array.from(o.palette).reverse(),charm:o.charm});}
  game.save.deliveryReceipt=null;const before=JSON.stringify(game.save);game.navigate('album');actions.get('查看回头客作品')();let view=game.albumView();
  assert.equal(view.series,'回头客 · 近六单');assert.equal(view.collected,6);assert.equal(view.percent,100);assert.equal(view.items.find(o=>o.id===RETURN_ORDERS[1].id).work.number,8);
  assert.deepEqual(Array.from(view.items[0].work.beads),Array.from(RETURN_ORDERS[0].palette).reverse());actions.get('欣赏再送妈妈一朵花')();assert.equal(game.modal,'collection');game.closeModal();game.render();actions.get('查看剧情作品')();assert.equal(game.albumView().series,'全部剧情');assert.equal(JSON.stringify(game.save),before);
});

test('incoming commission shows live requirements and skips guidance without changing the saved order or draft', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  const {ORDERS,RETURN_ORDERS}=load(root+'/assets/scripts/content.ts');
  for(let i=0;i<=ORDERS.length;i++){
    const o=i===ORDERS.length?RETURN_ORDERS[0]:ORDERS[i];
    game.save=rules.normalizeSave({...rules.freshSave(),started:true,reduced:true,completed:ORDERS.slice(0,i).map(o=>o.id),orderId:o.id,inventory:[2,1,0,3,4,5],draft:[0,...Array(11).fill(null)],charm:'heart'});
    const before=JSON.stringify(game.save);game.navigate('home');actions.get('查看当前订单')();
    assert.equal(game.screen,'orderArrival');let s=game.snapshot().incomingOrder;
    assert.equal(s.id,o.id);assert.equal(s.customer,o.customer);assert.equal(s.mainNeed,o.mainNeed);assert.equal(s.accentNeed,o.accentNeed);assert.equal(s.charm,o.charm);
    assert.equal(s.deficits[o.main],Math.max(0,o.mainNeed-game.save.inventory[o.main]));assert.equal(s.repeatNumber,i===ORDERS.length?1:null);
    assert.ok(actions.has('跳过引导'));actions.get('跳过引导')();assert.equal(game.orderGuide,false);assert.ok(actions.has('开始制作'));assert.equal(actions.has('跳过引导'),false);
    assert.equal(JSON.stringify(game.save),before);actions.get('开始制作')();assert.equal(game.screen,'craft');assert.equal(JSON.stringify(game.save),before);
    game.navigate('orderArrival');assert.equal(game.orderGuide,true);actions.get('查看订单并开始制作')();assert.equal(game.screen,'craft');assert.equal(JSON.stringify(game.save),before);
    game.navigate('orderArrival');actions.get('返回小店')();assert.equal(game.screen,'home');assert.equal(JSON.stringify(game.save),before);
  }
  game.save=rules.normalizeSave({...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(0)});
  game.navigate('orderArrival');const before=JSON.stringify(game.save);assert.ok(actions.has('去采珠'));actions.get('去采珠')();assert.equal(game.modal,'intro');assert.equal(JSON.stringify(game.save),before);
  game.closeModal();game.navigate('orders');actions.get('按单制作 180金')();assert.equal(game.screen,'orderArrival');
});

test('native goal HUD supports four objectives and claiming a win grants the displayed order supply exactly once', () => {
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
  game.accessibility={clear(){},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){},announce(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,level:15};
  game.session=rules.newSession(19,15,game.currentOrder());game.screen='match';game.render();
  assert.equal(game.goalLabels.length,4);assert.equal(game.boardNodes.length,64);
  assert.ok(game.obstacleNodes.filter(Boolean).length>0);
  game.session.status='won';game.session.collected=[4,2,1,2,0,1];
  const before=game.save.inventory.slice(),reward=rules.sessionRewards(game.session,game.save);
  game.result();actions.get('收好珠材 · 回工坊')();
  assert.equal(game.screen,'craft');assert.equal(game.save.level,16);
  assert.deepEqual(game.save.inventory,before.map((n,i)=>n+reward[i]));
  game.claim();assert.deepEqual(game.save.inventory,before.map((n,i)=>n+reward[i]));
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
  game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(20),draft:[...order.palette]};
  game.screen='craft';game.deliverOrder();
  assert.equal(game.screen,'delivery');assert.equal(game.modal,'');assert.equal(stories,0);
  assert.equal(stored.coins,260);assert.deepEqual(rules.pendingDelivery(stored).work.beads,Array.from(order.palette));
  game.deliverOrder();assert.equal(game.save.coins,260);assert.equal(game.save.collection.length,1);
  game.save=rules.normalizeSave(stored);game.render();assert.ok(actions.has('继续营业'));
  actions.get('继续营业')();assert.equal(game.modal,'first-feedback');assert.equal(stories,0);assert.equal(game.save.deliveryReceipt,null);
  actions.get('领取下一份委托')();assert.equal(game.screen,'orderArrival');assert.equal(game.currentOrder().id,'sea');
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
  const save=JSON.stringify(game.save);game.firstOrder();assert.deepEqual(portraits(),['pencil-dialogue-lin']);
  assert.equal(JSON.stringify(game.save),save);assert.equal(game.dialogueState.speaker,'林阿姨');
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
 actions.get('回忆阿禾')();assert.equal(game.memoryView().id,'ahe');actions.get('开始制作 · 当前委托')();assert.equal(game.screen,'craft');assert.equal(game.currentOrder().id,'daisy');
 assert.equal(JSON.stringify(game.save),before);
});

test('packing previews the real commission, returns to editing, and delivers only once on explicit confirmation',()=>{
 const game=new AtelierGame(),actions=new Map(),order=load(root+'/assets/scripts/content.ts').ORDERS[0];
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(50),draft:Array.from(order.palette).reverse()};game.screen='craft';
 const before=JSON.stringify(game.save);game.confirmDelivery();assert.equal(game.modal,'first-finished');actions.get('装进礼盒')();assert.equal(game.screen,'packing');assert.equal(JSON.stringify(game.save),before);
 assert.equal(game.snapshot().packing.orderId,'daisy');assert.deepEqual(game.snapshot().packing.beads,game.save.draft);
 actions.get('返回修改')();assert.equal(game.screen,'craft');assert.equal(JSON.stringify(game.save),before);
 game.confirmDelivery();actions.get('装进礼盒')();actions.get('完成包装')();assert.equal(game.screen,'delivery');assert.equal(game.save.coins,260);
 const paid=JSON.stringify(game.save);game.completePacking();assert.equal(JSON.stringify(game.save),paid);
});

test('sea packing keeps chosen blessings on completion and resets only gift choices for default wrapping',()=>{
 const heart=load(root+'/assets/scripts/heart.ts'),orders=load(root+'/assets/scripts/content.ts').ORDERS;
 for(const useDefault of [false,true]){
  const game=new AtelierGame();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
  game.save=rules.deliver({...rules.freshSave(),inventory:Array(6).fill(50),draft:Array.from(orders[0].palette)});game.save.deliveryReceipt=null;
  game.save=heart.askSea(heart.askSea(game.save,'fear'),'sunrise');
  for(const [field,id] of [['blessing','slow'],['paper','sky'],['ribbon','blue']])game.save=heart.chooseSeaGift(game.save,field,id);
  game.save={...game.save,reduced:true,draft:Array.from(orders[1].palette),charm:orders[1].charm};game.screen='craft';
  const facts=JSON.stringify(game.save.seaHeart.facts),stock=game.save.inventory.slice();game.confirmDelivery();
  game.completePacking(useDefault);const work=game.save.collection.find(w=>w.id==='sea');
  assert.equal(work.gift.blessing,useDefault?'scenery':'slow');assert.equal(work.gift.paper,useDefault?'cream':'sky');assert.equal(work.gift.ribbon,useDefault?'sage':'blue');
  assert.equal(JSON.stringify(game.save.seaHeart.facts),facts);assert.deepEqual(game.save.inventory,stock.map((n,i)=>n-rules.draftCounts(orders[1].palette)[i]));
 }
});

test('story map opens actual unlocked stories, shows locked conditions and keeps commissions and resources unchanged',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.scheduleOnce=()=>{};game.toast=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
 game.save={...rules.freshSave(),started:true,reduced:true};const before=JSON.stringify(game.save);game.screen='home';game.render();
 actions.get('故事解锁')();assert.equal(game.screen,'storyMap');actions.get('解锁条件 · 饰品小店')();assert.equal(game.modal,'');assert.equal(JSON.stringify(game.save),before);
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
 game.save={...rules.freshSave(),started:true,reduced:true,inventory:Array(6).fill(100)};
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
 actions.get('再做一条')();actions.get('按此配色继续委托')();assert.equal(game.screen,'craft');assert.equal(game.currentOrder().id,'rose');
 assert.deepEqual(Array.from(game.save.draft),Array.from(ORDERS[1].palette).reverse());assert.equal(game.save.collection[1].charm,'moon');assert.equal(game.save.coins,JSON.parse(before).coins);
 assert.equal(JSON.stringify(game.save.inventory),JSON.stringify(JSON.parse(before).inventory));assert.equal(Object.values(rules.checkOrder(game.save)).every(Boolean),false);
 actions.get('撤销')();assert.equal(JSON.stringify(game.save),before);
 game.collectionPreview('missing');assert.equal(game.modal,'info');assert.equal(game.snapshot().collectionDetail,null);assert.equal(JSON.stringify(game.save),before);
});

test('early failed gathering banks every collected color once through result, Escape and reload; first order opens without a long story',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.scheduleOnce=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){},announce(){}};
 game.save={...rules.freshSave(),reduced:true};game.screen='cover';game.render();actions.get('打开小店  →')();assert.equal(game.modal,'first-order');actions.get('开始做手串')();assert.equal(game.screen,'craft');assert.ok(game.save.firstSteps.craft);
 const stock=game.save.inventory.slice();game.session={...rules.newSession(91,1),status:'lost',moves:0,collected:[2,1,3,0,0,1]};game.screen='match';game.result();
 assert.deepEqual(game.save.inventory,stock.map((n,i)=>n+game.session.collected[i]));const saved=JSON.stringify(game.save);game.result();assert.equal(JSON.stringify(game.save),saved);
 game.dismiss();assert.equal(game.screen,'craft');assert.equal(game.session,null);assert.equal(JSON.stringify(game.save),saved);
 assert.deepEqual(rules.normalizeSave(JSON.parse(saved)).inventory,game.save.inventory);
});

test('material taps reserve random empty slots, ignore selection, guard stock/full drafts and undo safely',()=>{
 const game=new AtelierGame(),actions=new Map();game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.persist=()=>{};game.toast=()=>{};game.play=()=>{};
 game.accessibility={clear(){actions.clear();},text(){},button(name,action){actions.set(name,action);},showDialog(){},closeDialog(){}};
 game.save={...rules.freshSave(),reduced:true,inventory:[2,2,0,2,0,0]};game.screen='craft';game.render();
 actions.get('第1槽：空槽')();assert.equal(game.save.draft.filter(n=>n!==null).length,0);
 for(const name of ['月光珍珠','蔷薇红晶','森绿玉珠','月光珍珠','蔷薇红晶','森绿玉珠']){
  const before=game.save.draft.slice();game.slot=0;actions.get('放入'+name)();
  const changed=game.save.draft.map((n,i)=>n!==before[i]?i:-1).filter(i=>i>=0);assert.equal(changed.length,1);assert.equal(before[changed[0]],null);
 }
 const stock=game.save.inventory.slice(),draft=game.save.draft.slice();actions.get('放入月光珍珠')();assert.deepEqual(game.save.draft,draft);actions.get('放入雾蓝水晶')();assert.deepEqual(game.save.draft,draft);
 actions.get('撤销')();assert.equal(game.save.draft.filter(n=>n!==null).length,5);assert.deepEqual(game.save.inventory,stock);
 game.save.inventory=Array(6).fill(20);game.save.draft=Array(12).fill(0);game.render();const full=game.save.draft.slice();actions.get('放入森绿玉珠')();assert.deepEqual(game.save.draft,full);
 actions.get('第1槽：月光珍珠')();actions.get('替换')();assert.equal(game.save.draft[0],3);actions.get('撤销')();assert.deepEqual(Array.from(game.save.draft),full);
});
