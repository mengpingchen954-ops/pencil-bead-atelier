import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {load,Node,Label,UITransform,root}=createRequire(import.meta.url)('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const rules=load(root+'/assets/scripts/model.ts');
const {MATERIALS}=load(root+'/assets/scripts/content.ts');
const {materialPalette,categoryMaterials}=load(root+'/assets/scripts/materials.ts');
function fixture(){
 const g=new AtelierGame(),actions=new Map();
 g.node=new Node('AtelierGame');g.page=new Node('Page');g.overlay=new Node('Dialogs');g.notices=new Node('Notices');
 g.save={...rules.freshSave(),started:true,reduced:true};g.screen='home';g.persist=()=>{};g.play=()=>{};g.toast=()=>{};
 g.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){actions.clear();},closeDialog(){},announce(){}};
 return {g,actions};
}
const text=g=>g.overlay.getComponentsInChildren(Label).map(l=>l.string).join('\n');
test('floral daily calendar shows actual rewards and switches to a disabled claimed state',()=>{
 const {g,actions}=fixture(),before=g.save.coins;g.dailyDialog();
 assert.ok(g.overlay.getChildByName('Daily floral panel'));assert.match(text(g),/30 金币/);assert.match(text(g),/120 金币/);
 assert.equal(g.save.coins,before);assert.ok(actions.has('领取今日奖励'));
 actions.get('领取今日奖励')();assert.equal(g.save.daily.streak,1);assert.equal(actions.has('领取今日奖励'),false);assert.equal(actions.has('今日已领取'),false);assert.match(text(g),/已领取/);
});
test('floral settings preserves toggles, save access, reset confirmation and music controls',()=>{
 const {g,actions}=fixture();g.settings();assert.ok(g.overlay.getChildByName('Settings floral panel'));
 actions.get('操作音效  开启')();assert.equal(g.save.sound,false);assert.ok(actions.has('操作音效  关闭'));
 actions.get('减少动态效果  开启')();assert.equal(g.save.reduced,false);
 actions.get('背景音乐 · 切歌 / 音量')();assert.equal(g.modal,'music');
 assert.ok(g.overlay.getChildByName('Music floral panel'));assert.match(text(g),/35%/);
 actions.get('+')();assert.equal(g.save.music.volume,.45);assert.match(text(g),/45%/);
 actions.get('治愈少女')();assert.equal(g.save.music.track,'girl');assert.ok(actions.has('✓ 治愈少女'));
 actions.get('暂停音乐')();assert.equal(g.save.music.enabled,false);assert.ok(actions.has('播放音乐'));
 actions.get('下一首')();assert.equal(g.save.music.track,'time');assert.equal(g.save.music.enabled,true);
 g.settings();assert.ok(actions.has('导出 / 导入存档'));const before=JSON.stringify(g.save);actions.get('重新开始')();assert.equal(g.modal,'reset');assert.equal(JSON.stringify(g.save),before);assert.ok(actions.has('保留进度'));
});
test('flat wooden spacer is retired while legacy inventory and works keep their material IDs',()=>{
 assert.equal(MATERIALS[144].name,'扁木隔片');assert.equal(MATERIALS[144].retired,true);
 const save={...rules.freshSave(),draft:[0,144,1],inventory:Array(MATERIALS.length).fill(4),gatheredStock:Array(MATERIALS.length).fill(4),materialUnlocked:Array(MATERIALS.length).fill(true)};
 const restored=rules.normalizeSave(save);assert.equal(restored.inventory[144],4);assert.deepEqual(Array.from(restored.draft),save.draft);assert.equal(rules.canPlace(restored,144,3),false);
 assert.equal(categoryMaterials(2).includes(144),false);for(let level=1;level<=1000;level++)assert.equal(materialPalette(level).includes(144),false);
});
test('all floral menu tap targets stay inside the game frame',()=>{
 const {g}=fixture();for(const menu of ['dailyDialog','settings','musicDialog']){
  g[menu]();const check=(node,x=0,y=0)=>{
   x+=node.position.x;y-=node.position.y;
   if(node.name.startsWith('Button:')){const {width,height}=node.getComponent(UITransform).contentSize;assert.ok(x>=0&&y>=0&&x+width<=720&&y+height<=1280,node.name);}
   for(const child of node.children)check(child,x,y);
  };check(g.overlay);
 }
});

test('the framed album paginates six real works and preserves the archive and crafting actions',()=>{
 const {g,actions}=fixture(),{finishWork}=load(root+'/assets/scripts/commerce.ts');
 for(let i=0;i<7;i++)g.save=finishWork({...g.save,draft:[0,1,2],inventory:Array(MATERIALS.length).fill(20),gatheredStock:Array(MATERIALS.length).fill(20),materialUnlocked:Array(MATERIALS.length).fill(true)},1000+i);
 g.screen='album';g.render();const cards=()=>g.page.children.filter(n=>n.name.startsWith('DIY collection '));
 assert.equal(cards().length,6);assert.ok(actions.has('欣赏作品 · 7'));assert.ok(actions.has('时光珍藏'));assert.ok(actions.has('制作新手串'));
 actions.get('后页 →')();assert.equal(g.galleryPage,1);assert.equal(cards().length,1);assert.equal(cards()[0].name,'DIY collection 1');
 actions.get('← 前页')();assert.equal(cards().length,6);assert.equal(g.save.commerce.works.length,7);
});
