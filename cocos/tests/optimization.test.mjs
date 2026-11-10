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
