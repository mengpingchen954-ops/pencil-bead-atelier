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

test('entry scene contains ten real editable layouts, visible home art, labels and UI camera', () => {
  const scene = JSON.parse(fs.readFileSync(root + '/assets/scenes/Atelier.scene', 'utf8'));
  const layouts = scene.find(n => n._name === 'EditableLayouts');
  assert.ok(layouts);
  const pages = layouts._children.map(r => scene[r.__id__]);
  assert.deepEqual(pages.map(n => n._name), ['home','cover','orders','craft','match','decor','album','journal','contest','contestCraft']);
  assert.equal(pages.filter(n => n._active).length, 1);
  assert.ok(pages[0]._active);
  assert.ok(scene.some(n => n.__type__ === 'cc.Camera' && n._orthoHeight === 640));
  assert.ok(scene.filter(n => n.__type__ === 'cc.Sprite').length > 100);
  assert.ok(scene.filter(n => n.__type__ === 'cc.Label').length > 100);
  const homeArt = pages[0]._children.map(r => scene[r.__id__]).find(n => n._name === 'pencil-shop');
  assert.ok(homeArt?._components.some(r => scene[r.__id__].__type__ === 'cc.Sprite'));
  const keys = scene.filter(n => n.key).map(n => n.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const object of scene) {
    for (const r of [...(object._children || []), ...(object._components || [])]) assert.ok(scene[r.__id__]);
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
  game.layouts.set(layoutKey('match',48,440,72,72,new Map()),cell);
  assert.deepEqual(game.boardPos(0),new Vec3(60,-450));
  assert.deepEqual(game.boardPos(0,false),new Vec3(48,-440));
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
  game.confirmDelivery();assert.equal(game.modal,'sea-packing');
  actions.get('害怕的时候，也可以慢慢走。')();
  actions.get('晨空蓝纸')();actions.get('海风蓝丝带')();
  actions.get('确认包装交付')();assert.equal(game.modal,'sea-response');
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
  game.persist=()=>{};game.scheduleOnce=()=>{};
  game.accessibility={clear(modal){if(!modal)actions.clear();},text(){},button(name,action,modal,enabled){if(enabled)actions.set(name,action);},showDialog(){actions.clear();},closeDialog(){actions.clear();},announce(){}};
  game.save={...rules.freshSave(),started:true,reduced:true,completed:['daisy'],draft:[0,...Array(11).fill(null)],charm:'heart'};
  const commission=game.save.draft.slice(),stock=game.save.inventory.slice(),coins=game.save.coins;
  game.screen='home';game.render();actions.get('参加比赛')();assert.equal(game.screen,'contest');
  actions.get('报名参加')();assert.equal(game.screen,'contestCraft');
  actions.get('参考配色')();actions.get('以此为起点排珠')();
  actions.get('第1槽：森绿玉珠')();actions.get('放入月光珍珠')();
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
  assert.ok(actions.has('按单制作'));actions.get('按单制作')();
  assert.equal(game.currentOrder().customer,'林阿姨');
  assert.equal(actions.has('欣赏作品'),false);
  actions.get('包装交付  ·  180 金币')();assert.equal(game.modal,'');
  assert.match(messages.at(-1),/串满/);
  actions.get('参考配色')();actions.get('按参考排珠')();
  actions.get('包装交付  ·  180 金币')();assert.equal(game.modal,'delivery');
  actions.get('确认交付')();
  assert.equal(game.save.repeatOrders,1);assert.equal(game.save.coins,260);
  assert.equal(game.save.completed.length,6);assert.equal(game.save.repeatCollection.length,1);
  actions.get('按单制作')();assert.equal(game.currentOrder().customer,'花店小满');
  assert.equal(actions.has('听故事'),false);
  actions.get('参考配色')();actions.get('按参考排珠')();
  actions.get('包装交付  ·  220 金币')();assert.equal(game.modal,'delivery');
  actions.get('确认交付')();assert.equal(game.save.repeatOrders,2);
  game.navigate('album');actions.get('查看回头客作品')();
  assert.ok(actions.has('欣赏再送妈妈一朵花'));
  assert.ok(actions.has('欣赏送给旅途中的朋友'));
});
