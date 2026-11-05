import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {freshSave,normalizeSave} from '../assets/scripts/model.ts';
import {finishWork,listWork,settleSales,suggestedPrice,renameWork,randomWorkName,workName} from '../assets/scripts/commerce.ts';

const prepared=()=>({...freshSave(),started:true,reduced:true,inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30),draft:[0,43],draftSizes:[6,12],draftFacings:['out','in'],draftName:'  月光与蔷薇  '});
test('manual names persist through completion, listing, sale and reload without changing transactions',()=>{
  const before=prepared(),ready=finishWork(before,1000);
  assert.equal(ready.commerce.works[0].name,'月光与蔷薇');assert.equal(ready.draftName,'');assert.equal(before.draftName,'  月光与蔷薇  ');
  for(const save of [ready,listWork(ready,1,suggestedPrice([0,43]),2000),settleSales(listWork(ready,1,suggestedPrice([0,43]),2000),100000)]){
    const snapshot=structuredClone(save),renamed=renameWork(save,1,'  星河小梦  ');
    assert.deepEqual(save,snapshot);assert.equal(renamed.commerce.works[0].name,'星河小梦');
    assert.deepEqual({...renamed,commerce:save.commerce},save);
    assert.deepEqual({...renamed.commerce.works[0],name:save.commerce.works[0].name},save.commerce.works[0]);
    assert.equal(normalizeSave(JSON.parse(JSON.stringify(renamed))).commerce.works[0].name,'星河小梦');
  }
  assert.equal(renameWork(ready,1,' \n\t '),null);assert.equal(renameWork(ready,99,'无此作品'),null);
});
test('names handle empty/old saves, Unicode and random choices without immediate repeats',()=>{
  assert.equal(workName('珠\n宝\t手作'),'珠 宝 手作');assert.equal(workName(null),'');
  assert.equal(Array.from(workName('🌸'.repeat(30))).length,24);
  assert.equal(finishWork({...prepared(),draftName:''},1000).commerce.works[0].name,'我的手作 · 1');
  const old=finishWork(prepared(),1000);delete old.draftName;delete old.commerce.works[0].name;
  assert.equal(normalizeSave(old).draftName,'');assert.equal(normalizeSave(old).commerce.works[0].name,'我的手作 · 1');
  assert.equal(normalizeSave(prepared()).draftName,'月光与蔷薇');
  let last='';for(let i=0;i<100;i++){const next=randomWorkName(last);assert.ok(next.length>0&&next.length<=24);assert.notEqual(next,last);last=next;}
});

const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
test('native completion and edit dialog support manual/random naming, cancel and blank validation',()=>{
  const game=new AtelierGame(),actions=new Map();
  game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  let message='';game.persist=()=>{};game.toast=value=>{message=value;};game.play=()=>{};
  game.accessibility={clear(){actions.clear();},text(){},button(name,fn,modal,enabled){if(enabled)actions.set(name,fn);},showDialog(){},closeDialog(){}};
  game.save=prepared();game.screen='packing';game.render();
  actions.get('随机名称')();const random=game.save.draftName;assert.ok(random&&random!=='  月光与蔷薇  ');
  actions.get('保存作品')();assert.equal(game.save.commerce.works[0].name,random);
  const snapshot=plain(game.save);game.freeWorkPreview(1);actions.get('编辑名称')();
  actions.get('随机名称')();actions.get('取消改名')();assert.deepEqual(plain(game.save),snapshot);
  actions.get('编辑名称')();let field=game.overlay.children.find(n=>n.name==='Work name'),edit=field.components.find(c=>c.constructor.name==='EditBox');
  edit.string='  ';field.events['text-changed']();actions.get('保存名称')();assert.match(message,/请先输入/);assert.equal(game.modal,'work-name');
  edit.string='我的第一串';field.events['text-changed']();actions.get('保存名称')();
  assert.equal(game.save.commerce.works[0].name,'我的第一串');assert.equal(game.modal,'free-work');
  assert.deepEqual({...plain(game.save),commerce:snapshot.commerce},snapshot);
});
