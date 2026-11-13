import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts');
function fixture(){
 const game=new AtelierGame();game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.save={...rules.freshSave(),started:true,reduced:false,draft:Array(12).fill(0),inventory:Array(48).fill(30),gatheredStock:Array(48).fill(30)};
 game.screen='craft';game.render();
 game.slotNodes.forEach(n=>n.children.forEach(c=>{c.isValid=true;}));return game;
}
const positions=nodes=>nodes.map(n=>({...n.position}));
const step=(game,n)=>{for(let i=0;i<n;i++)game.update(1/60);};
test('neighbors flow visually during drag and return exactly without moving slots or changing saves',()=>{
 const game=fixture(),saved=JSON.stringify(game.save),slots=positions(game.slotNodes);
 const art=game.slotNodes.map(n=>n.children.find(c=>c.name.startsWith('bead-'))),rest=positions(art);
 game.dragCraftNeighbors(0,60,30);step(game,18);
 assert.deepEqual({...art[0].position},rest[0]);assert.ok(art[1].position.x-rest[1].x>art[5].position.x-rest[5].x);
 assert.deepEqual(positions(game.slotNodes),slots);assert.equal(JSON.stringify(game.save),saved);
 game.releaseCraftFlow();step(game,180);assert.equal(game.craftFlows.size,0);assert.deepEqual(positions(art),rest);
 game.bumpCraftNeighbors(0);step(game,6);assert.notDeepEqual(positions(art),rest);
 step(game,180);assert.deepEqual(positions(art),rest);assert.equal(JSON.stringify(game.save),saved);
});
test('flow survives a redraw, ends on navigation, and respects reduced motion',()=>{
 const game=fixture();game.dragCraftNeighbors(0,60,0);step(game,12);game.releaseCraftFlow();
 const previous=game.slotNodes[1].children.find(c=>c.name.startsWith('bead-')).position.x;game.render();
 assert.equal(game.slotNodes[1].children.find(c=>c.name.startsWith('bead-')).position.x,previous);
 game.navigate('home');assert.equal(game.craftFlows.size,0);
 game.screen='craft';game.save.reduced=true;game.render();game.dragCraftNeighbors(0,60,30);game.bumpCraftNeighbors(0);
 assert.equal(game.craftFlows.size,0);
});
