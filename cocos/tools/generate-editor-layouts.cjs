// Build real Cocos layouts from the same renderer used by the game.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
let compiler = process.env.TYPESCRIPT_PATH;
if (!compiler) { try { compiler = require.resolve('typescript'); } catch { compiler = 'C:/ProgramData/cocos/editors/Creator/3.8.2/resources/app.asar.unpacked/node_modules/typescript'; } }
const ts = require(compiler);
const ids = { AtelierLayout:'4d96886c-0123-4a9b-bcde-a718954e1b44', AtelierLayouts:'b2c3146c-0123-4a9b-bcde-a718954e1b44' };
// Cocos encodes the last 27 hex digits in pairs of base64 characters (12 bits each).
function classId(uuid) {
  const h=uuid.replaceAll('-',''), alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out=h.slice(0,5);
  for(let i=5;i<h.length;i+=3){const n=parseInt(h.slice(i,i+3),16);out+=alphabet[n>>6]+alphabet[n&63];}
  return out;
}
if(require.main === module) for(const [name,uuid] of Object.entries(ids)) {
  const meta=path.join(root,'assets/scripts',name+'.ts.meta');
  if(!fs.existsSync(meta))fs.writeFileSync(meta,JSON.stringify({ver:'4.0.24',importer:'typescript',imported:true,uuid,files:[],subMetas:{},userData:{}},null,2));
}
class Vec3 {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  clone(){return new Vec3(this.x,this.y,this.z);}
  static distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
}
class Color {
  constructor(r=255,g=255,b=255,a=255){Object.assign(this,{r,g,b,a});}
  fromHEX(hex){const s=hex.replace('#','');[this.r,this.g,this.b,this.a]=[0,2,4,6].map((i)=>i<s.length?parseInt(s.slice(i,i+2),16):255);return this;}
  toHEX(){return [this.r,this.g,this.b,this.a].map(n=>n.toString(16).padStart(2,'0')).join('');}
}
class Component {}
class UITransform {setAnchorPoint(x,y){this.anchorPoint=typeof x==='object'?x:{x,y};}setContentSize(w,h){this.contentSize=typeof w==='object'?{width:w.width,height:w.height}:{width:w,height:h};}}
class Graphics {
  constructor(){this.commands=[];}
  set fillColor(c){this.commands.push(['fillColor',c.r,c.g,c.b,c.a]);}
  set strokeColor(c){this.commands.push(['strokeColor',c.r,c.g,c.b,c.a]);}
  set lineWidth(w){this.commands.push(['lineWidth',w]);}
}
for(const op of ['moveTo','lineTo','bezierCurveTo','roundRect','rect','ellipse','circle','close','fill','stroke'])Graphics.prototype[op]=function(...args){this.commands.push([op,...args]);};
class Label {}
Label.Overflow={SHRINK:2};Label.HorizontalAlign={LEFT:0,CENTER:1};Label.VerticalAlign={CENTER:1};
class Sprite {}
Sprite.SizeMode={CUSTOM:0};
class Node {
  constructor(name){this.name=name;this.children=[];this.components=[];this.position=new Vec3();this.scale=new Vec3(1,1,1);this.rotation={x:0,y:0,z:0,w:1};this.active=true;}
  set parent(n){this._parent=n;if(n)n.children.push(this);}get parent(){return this._parent;}
  setPosition(x,y,z=0){this.position=typeof x==='object'?x.clone():new Vec3(x,y,z);}
  setScale(x,y,z=1){this.scale=typeof x==='object'?x.clone():new Vec3(x,y,z);}
  setRotation(r){this.rotation={...r};}
  addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c;}
  getComponent(Type){return this.components.find(c=>c instanceof Type)||null;}
  on(event,fn){(this.events ||= {})[event]=fn;}
  setSiblingIndex(){}
  removeFromParent(){this.parent.children=this.parent.children.filter(n=>n!==this);this._parent=null;}destroy(){}
}
Node.EventType={TOUCH_END:'end',TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_CANCEL:'cancel'};
const decorator=(...args)=>args.length===1&&typeof args[0]==='function'?args[0]:()=>{};
const cc={_decorator:{ccclass:()=>x=>x,property:decorator,executeInEditMode:x=>x},Component,Node,UITransform,Graphics,Color,Label,Sprite,Vec3,Enum:x=>x,Layers:{Enum:{UI_2D:1<<25}},SpriteFrame:class{},AudioSource:class{},BlockInputEvents:class{},Tween:{stopAllByTarget(){}}};
const cache={};
function load(file){
  if(file==='cc')return cc;if(file==='cc/env')return {EDITOR:false};
  file=path.resolve(file);if(cache[file])return cache[file].exports;
  const mod={exports:{}};cache[file]=mod;
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true}}).outputText;
  vm.runInNewContext('(function(require,module,exports){'+source+'\n})',{console})(id=>load(id.startsWith('.')?path.resolve(path.dirname(file),id.endsWith('.ts')?id:id+'.ts'):id),mod,mod.exports);
  return mod.exports;
}
if(require.main === module) {
const existing=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/Atelier.scene'),'utf8'));
if(existing.some(n=>n._name==='EditableLayouts') && !process.argv.includes('--reset-layouts')) throw Error('Layouts already exist. --reset-layouts explicitly discards scene layout edits; back up the scene first.');
const {AtelierGame}=load(path.join(root,'assets/scripts/AtelierGame.ts'));
const rules=load(path.join(root,'assets/scripts/model.ts'));
const textures=new Map();
for(const folder of ['art','beads'])for(const file of fs.readdirSync(path.join(root,'assets/resources',folder))){
  if(!/\.(png|jpg)$/.test(file))continue;
  const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/resources',folder,file+'.meta'),'utf8'));
  const name=path.parse(file).name,data=meta.subMetas.f9941.userData;
  textures.set(name,{name,uuid:meta.subMetas.f9941.uuid,originalSize:{width:data.rawWidth,height:data.rawHeight}});
}
let serial=0;
const all=[];
const ref=(id)=>({__id__:id});
function add(value){const id=all.length;all.push(value);return ref(id);}
const vec=(v)=>({__type__:'cc.Vec3',...v});
function node(n,parent){
  const record={__type__:'cc.Node',_name:n.name,_objFlags:0,_parent:parent,_children:[],_active:n.active,_components:[],_prefab:null,_lpos:vec(n.position),_lrot:{__type__:'cc.Quat',...n.rotation},_lscale:vec(n.scale),_layer:1<<25,_euler:vec(new Vec3()),_id:'layout-node-'+serial++};
  const r=add(record);
  const comp=(type,fields={})=>{const c=add({__type__:type,_name:'',_objFlags:0,node:r,_enabled:true,__prefab:null,...fields,_id:'layout-component-'+serial++});record._components.push(c);return c;};
  let drawing='',originalLabel='',originalImage='';
  for(const c of n.components){
    if(c instanceof UITransform)comp('cc.UITransform',{_contentSize:{__type__:'cc.Size',...c.contentSize},_anchorPoint:{__type__:'cc.Vec2',...c.anchorPoint}});
    if(c instanceof Label){
      const fields=['string','fontSize','lineHeight','fontFamily','enableWrapText','overflow','horizontalAlign','verticalAlign'];
      const values=Object.fromEntries(fields.map(k=>[k,c[k]]));
      originalLabel=JSON.stringify({...values,color:c.color.toHEX()});
      comp('cc.Label',{...Object.fromEntries(fields.map(k=>['_'+k,c[k]])),_color:{__type__:'cc.Color',...c.color},_isSystemFontUsed:true,_font:null,_cacheMode:0});
    }
    if(c instanceof Sprite){originalImage=c.spriteFrame.name;comp('cc.Sprite',{_spriteFrame:{__uuid__:c.spriteFrame.uuid,__expectedType__:'cc.SpriteFrame'},_sizeMode:0,_type:0,_color:{__type__:'cc.Color',r:255,g:255,b:255,a:255},_srcBlendFactor:2,_dstBlendFactor:4});}
    if(c instanceof Graphics)drawing=JSON.stringify(c.commands);
  }
  if(n.layoutKey)comp(classId(ids.AtelierLayout),{key:n.layoutKey,drawing,originalDrawing:drawing,originalLabel,originalImage});
  record._children=n.children.map(child=>node(child,r));
  return r;
}
const old=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/Atelier.scene'),'utf8'));
all.push(old[0],{...old[1],_children:[]});
const controller=new Node('AtelierGame');
const canvas=new Node('Canvas');canvas.parent=controller;canvas.addComponent(UITransform).setAnchorPoint(.5,.5);canvas.getComponent(UITransform).setContentSize(720,1280);
const camera=new Node('UI Camera');camera.parent=canvas;camera.setPosition(0,0,1000);
const origin=new Node('Atelier');origin.parent=canvas;origin.setPosition(-360,640);origin.addComponent(UITransform).setAnchorPoint(0,1);origin.getComponent(UITransform).setContentSize(720,1280);
const layouts=new Node('EditableLayouts');layouts.parent=origin;
for(const page of ['home','cover','orders','craft','match','decor','album','journal','contest','contestCraft']){
  const game=new AtelierGame();game.textures=textures;game.save=rules.freshSave();game.screen=page;
  game.page=new Node(page);game.page.parent=layouts;game.page.addComponent(UITransform).setAnchorPoint(0,1);game.page.getComponent(UITransform).setContentSize(720,1280);
  game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
  if(page==='match')game.session=rules.newSession(42,1);
  if(page==='contest'||page==='contestCraft')game.save.completed=['daisy'];
  if(page==='contestCraft')game.save.competitions.draft={id:'spring',beads:Array(12).fill(null),charm:'daisy'};
  game.render();game.layoutKeys.forEach((key,n)=>n.layoutKey=key);
  game.page.active=page==='home';
}
all[1]._children=[node(controller,ref(1))];
function component(n,type,fields){const index=all.findIndex(o=>o.__type__==='cc.Node'&&o._name===n);const r=add({__type__:type,_name:'',_objFlags:0,node:ref(index),_enabled:true,__prefab:null,...fields,_id:crypto.randomUUID()});all[index]._components.push(r);return r;}
component('AtelierGame','2ef3cl6uPRKwqfRDqahvsUy',{});
const cam=component('UI Camera','cc.Camera',{_projection:0,_priority:0,_orthoHeight:640,_near:.1,_far:2000,_color:{__type__:'cc.Color',r:232,g:223,b:202,a:255},_depth:1,_stencil:0,_clearFlags:7,_visibility:1<<25,_rect:{__type__:'cc.Rect',x:0,y:0,width:1,height:1}});
component('Canvas','cc.Canvas',{_cameraComponent:cam,_alignCanvasWithScreen:false});
component('EditableLayouts',classId(ids.AtelierLayouts),{page:0});
fs.writeFileSync(path.join(root,'assets/scenes/Atelier.scene'),JSON.stringify(all,null,2)+'\n');
console.log(`Generated 10 editable layouts, ${all.filter(o=>o.__type__==='cc.Node').length} native nodes.`);
}
module.exports={load,Node,UITransform,Label,Sprite,Graphics,Vec3,root};
