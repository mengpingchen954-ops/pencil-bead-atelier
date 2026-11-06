import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{load,Node,root}=require('../tools/generate-editor-layouts.cjs');
const {AtelierGame}=load(root+'/assets/scripts/AtelierGame.ts'),rules=load(root+'/assets/scripts/model.ts');
const plain=value=>JSON.parse(JSON.stringify(value));

function fixture(session){
 const game=new AtelierGame(),messages=[],scheduled=[];
 game.node=new Node('AtelierGame');game.page=new Node('Page');game.overlay=new Node('Dialogs');game.notices=new Node('Notices');
 game.save={...rules.freshSave(),started:true,reduced:true};game.session=session;game.screen='match';
 game.persist=()=>{};game.play=()=>{};game.toast=()=>{};game.scheduleOnce=fn=>scheduled.push(fn);
 game.accessibility={clear(){},text(){},button(){},busy(){},showDialog(){},closeDialog(){},announce(message){messages.push(message);}};
 game.render();return {game,messages,scheduled};
}
const labels=node=>node.children.flatMap(n=>[...n.components.filter(c=>typeof c.string==='string').map(c=>c.string),...labels(n)]);

test('one settlement counts all cascades once; feedback and result reopening never award stock',async()=>{
 let session,result;
 for(let seed=1;seed<100;seed++){
  session=rules.newSession(seed,19);session.collected=Array(6).fill(9);session.moves=1;result=rules.move(session,...rules.findMove(session.board,session.specials,session.obstacles));
  if(result.frames.length>1)break;
 }
 assert.ok(result.frames.length>1);
 const {game,messages,scheduled}=fixture(session),amount=rules.total(rules.gatheredMaterials(result.session));
 await game.resolve(result);
 assert.deepEqual(messages.filter(m=>m.startsWith('本关采集')),['本关采集 +'+amount+' 颗']);assert.equal(rules.total(game.save.inventory),amount);
 assert.equal(rules.total(result.session.collected)-54,result.frames.reduce((n,f)=>n+f.hit.length,0));
 const before=plain(game.save);game.result();game.result();assert.deepEqual(plain(game.save),before);
 assert.ok(labels(game.overlay).some(s=>s.startsWith('本关获得 '+rules.gatheredMaterials(result.session).filter(Boolean).length+' 种珠材，共 '+amount+' 颗')));
 assert.equal(game.gatherEffects.children.length,1);assert.equal(game.gatherEffects.children[0].name,'Gather count');
 assert.ok(labels(game.gatherEffects).includes('本关采集 +'+amount+' 颗'));
 game.gatherEffects.children[0].isValid=true;scheduled.forEach(fn=>fn());assert.equal(game.gatherEffects.children.length,0);
});

test('success and failure report exact totals, including previous turns, without replaying flights',async()=>{
 for(const won of [true,false]){
  const session=rules.newSession(19,19);session.collected=[19,19,19,19,19,19];session.moves=1;
  const pair=rules.findMove(session.board,session.specials,session.obstacles),preview=rules.move(session,...pair);
  const type=preview.session.collected.findIndex((n,i)=>n>session.collected[i]);
  session.objectives=[{kind:'color',type,target:won?1:99999}];
  const {game,messages}=fixture(session);game.bankGather();
  const result=rules.move(game.session,...pair);assert.equal(result.session.status,won?'won':'lost');
  await game.resolve(result);
  const total=rules.total(rules.gatheredMaterials(result.session)),delta=total-rules.total(rules.gatheredMaterials(session));
  assert.equal(rules.total(game.save.inventory),total);assert.deepEqual(messages.filter(m=>m.startsWith('本关采集')),['本关采集 +'+delta+' 颗']);
  assert.equal(game.modal,'result');assert.ok(labels(game.overlay).some(s=>s.startsWith('本关获得 '+rules.gatheredMaterials(result.session).filter(Boolean).length+' 种珠材，共 '+total+' 颗')));
  const stock=plain(game.save.inventory);game.result();assert.deepEqual(plain(game.save.inventory),stock);assert.equal(messages.filter(m=>m.startsWith('本关采集')).length,1);
 }
});

test('invalid actions and non-collecting shuffle have no receipt; tools share the exact delta hook',async()=>{
 const session=rules.newSession(971,19),{game,messages}=fixture(session);
 await game.resolve({valid:false});await game.resolve(rules.useTool(session,'shuffle'));
 assert.deepEqual(messages,[]);assert.equal(game.gatherEffects,undefined);assert.equal(rules.total(game.save.inventory),0);
 for(const tool of ['hammer','bloom']){
  const before=rules.total(rules.gatheredMaterials(game.session)),result=rules.useTool(game.session,tool,27),messageCount=messages.filter(m=>m.startsWith('本关采集')).length;
  await game.resolve(result);const delta=rules.total(rules.gatheredMaterials(result.session))-before;
  if(delta)assert.equal(messages.at(-1),'本关采集 +'+delta+' 颗');else assert.equal(messages.filter(m=>m.startsWith('本关采集')).length,messageCount);
  assert.equal(rules.total(game.save.inventory),rules.total(rules.gatheredMaterials(result.session)));
 }
 game.navigate('home');assert.equal(game.gatherEffects?.children.length||0,0);
});
