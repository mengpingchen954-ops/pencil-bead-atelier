import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts');
const touch=(x=100,y=100)=>({getUILocation:()=>({x,y:1280-y})});
function fixture(reduced=false){
 const game=new AtelierGame();game.save={...rules.freshSave(),reduced};game.page=new Node('Page');
 let calls=0;const node=game.box('Icon',40,60,100,80);game.bindTap(node,()=>calls++);
 return {game,node,calls:()=>calls};
}
test('icons compress around their center, respond once, then return exactly to rest',()=>{
 const {game,node,calls}=fixture(),position={...node.position},scale={...node.scale};
 node.events.start(touch());assert.equal(node.scale.x,.96);assert.ok(node.position.x>position.x);
 assert.ok(node.getChildByName('Press feedback'));node.events.end(touch());assert.equal(calls(),1);
 for(let i=0;i<20;i++)game.update(1/60);
 assert.deepEqual({...node.position},position);assert.deepEqual({...node.scale},scale);
 assert.equal(game.uiPresses.size,0);assert.equal(node.getChildByName('Press feedback'),null);
});
test('moving away, cancelling and busy states never activate an icon',()=>{
 const {game,node,calls}=fixture();
 node.events.start(touch());node.events.move(touch(150));node.events.end(touch(150));assert.equal(calls(),0);
 node.events.start(touch());node.events.cancel();node.events.end(touch());assert.equal(calls(),0);
 game.busy=true;node.events.start(touch());node.events.end(touch());assert.equal(calls(),0);
});
test('reduced motion keeps the tint and action without changing icon size or position',()=>{
 const {game,node,calls}=fixture(true),position={...node.position};
 node.events.start(touch());assert.equal(node.scale.x,1);assert.deepEqual({...node.position},position);
 assert.ok(node.getChildByName('Press feedback'));node.events.end(touch());assert.equal(calls(),1);
 for(let i=0;i<20;i++)game.update(1/60);assert.equal(node.scale.x,1);assert.equal(game.uiPresses.size,0);
});
