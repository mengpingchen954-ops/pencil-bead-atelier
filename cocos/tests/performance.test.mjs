import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{prepare}=require('../tools/prepare-performance.cjs');
const {load,root,Node}=require('../tools/generate-editor-layouts.cjs'),{AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts');
const cc=load('cc');
test('production startup retains editor edits without serializing the editor layout tree or artwork dependencies',()=>{
 const scene=root+'/assets/scenes/Atelier.scene',before=fs.readFileSync(scene),result=prepare();
 assert(fs.readFileSync(scene).equals(before));assert(result.compact.length<60);
 assert(!result.compact.some(n=>n._name==='EditableLayouts'||n.__type__==='cc.Sprite'));
 const originals=JSON.parse(before);const key=originals.find(n=>n.key&&n.key.startsWith('craft/')).key;
 const layout=originals.find(n=>n.key===key),node=originals[layout.node.__id__];
 const g=new AtelierGame();g.layoutData=result.data;g.page=new Node('Page');g.screen='craft';
 const coordinates=key.split('/').at(-1).split(':')[0].split(',').map(Number);
 g.layoutCounts.set(key.slice(0,key.lastIndexOf(':')),Number(key.split(':').at(-1)));
 const box=g.box('probe',...coordinates);
 assert(Math.abs(box.position.x-node._lpos.x)<1e-9);assert(Math.abs(box.position.y-node._lpos.y)<1e-9);
 assert(result.paths['pencil-cover']);assert(Object.keys(result.data).length<originals.filter(n=>n.key).length);
});
test('visible image requests are deduplicated, bounded and hold live sprites while releasing unused cache entries',async()=>{
 const original=cc.resources.load,pending=[];
 cc.resources.load=(path,type,done)=>pending.push({path,done});
 try{
  const g=new AtelierGame(),a=g.loadFrame('bead-0'),again=g.loadFrame('bead-0');assert.equal(a,again);
  const requests=[a,...['bead-1','bead-2','bead-3','bead-4','bead-5'].map(k=>g.loadFrame(k))];
  assert.equal(pending.length,4);assert(pending.every(p=>p.path.endsWith('/spriteFrame')));
  function frame(){return {originalSize:{width:192,height:192},refCount:0,addRef(){this.refCount++;return this;},decRef(){this.refCount--;return this;}};}
  const first=frame();pending[0].done(null,first);assert.equal(pending.length,5);
  for(let i=1;i<6;i++)pending[i].done(null,frame());await Promise.all(requests);
  let destroyed;const n={once:(key,fn)=>destroyed=fn};g.retainFrame(n,first);assert.equal(first.refCount,2);
  g.textureBytes=100*1024*1024;g.trimTextures();assert(g.textures.has('bead-0'));assert.equal(first.refCount,2);
  destroyed();g.trimTextures();assert.equal(first.refCount,0);assert(!g.textures.has('bead-0'));
 }finally{cc.resources.load=original;}
});
test('music switching and disposal release the previous decoded clip, including stale loading callbacks',()=>{
 const {BackgroundMusic}=load(root+'/assets/scripts/BackgroundMusic.ts'),pending=[];
 const source={node:{on(){},off(){}},clip:null,playing:false,stop(){this.playing=false;},pause(){this.playing=false;},play(){this.playing=true;}};
 const music=new BackgroundMusic(source,(path,done)=>pending.push(done));
 const frame=()=>({refCount:0,addRef(){this.refCount++;},decRef(){this.refCount--;}}),first=frame(),second=frame();
 music.update({track:'glimmer',enabled:true,volume:.3});pending[0](null,first);assert.equal(first.refCount,1);
 music.update({track:'calm',enabled:true,volume:.3});assert.equal(first.refCount,0);pending[1](null,second);assert.equal(second.refCount,1);
 music.update({track:'piano',enabled:true,volume:.3});assert.equal(second.refCount,0);
 music.update({track:'calm',enabled:true,volume:.3});pending[3](null,second);assert.equal(second.refCount,1);
 pending[2](null,second);assert.equal(second.refCount,1,'stale callbacks cannot release a currently playing clip');
 music.dispose();assert.equal(second.refCount,0);assert.equal(source.clip,null);
});

test('a deferred image keeps its Sprite and caller tint until the frame arrives',async()=>{
 const original=cc.resources.load;let done;cc.resources.load=(path,type,callback)=>done=callback;
 try{
  const g=new AtelierGame();g.page=new Node('Page');g.screen='decor';
  const image=g.image('pencil-floor',10,20,100,100),sprite=image.getComponent(cc.Sprite);assert(sprite);
  const tint={r:10,g:20,b:30,a:255};sprite.color=tint;
  const frame={originalSize:{width:192,height:192},refCount:0,addRef(){this.refCount++;},decRef(){this.refCount--;}};
  done(null,frame);await g.frameRequests.get('pencil-floor');await Promise.resolve();
  assert.equal(image.getComponent(cc.Sprite),sprite);assert.equal(sprite.color,tint);assert.equal(sprite.spriteFrame,frame);
 }finally{cc.resources.load=original;}
});

test('painted button backgrounds remain behind text when their image arrives asynchronously',()=>{
 const g=new AtelierGame(),button=new Node('Button'),label=new Node('Title');label.parent=button;button.addComponent(cc.UITransform).setContentSize(200,60);
 const frame={addRef(){},decRef(){}};g.textures.set('pencil-ui-primary',frame);
 const positions=[],before=Node.prototype.setSiblingIndex;Node.prototype.setSiblingIndex=function(index){positions.push({node:this.name,index});};
 try{g.skin(button,'pencil-ui-primary');assert.deepEqual(positions,[{node:'Painted surface',index:0}]);assert(button.children.includes(label));}
 finally{Node.prototype.setSiblingIndex=before;}
});
