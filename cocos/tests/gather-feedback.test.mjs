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
  session=rules.newSession(seed,19);result=rules.move(session,...rules.findMove(session.board,session.specials,session.obstacles));
  if(result.frames.length>1)break;
 }
 assert.ok(result.frames.length>1);
 const {game,messages,scheduled}=fixture(session),amount=rules.total(result.session.collected);
 await game.resolve(result);
 assert.deepEqual(messages.filter(m=>m.startsWith('本次采集')),['本次采集 +'+amount]);assert.equal(rules.total(game.save.inventory),amount);
 assert.equal(amount,result.frames.reduce((n,f)=>n+f.hit.length,0));
 const before=plain(game.save);game.result();game.result();assert.deepEqual(plain(game.save),before);
 assert.ok(labels(game.overlay).some(s=>s.startsWith('本关采集 '+amount+' 件珠材')));
 assert.equal(game.gatherEffects.children.length,1);assert.equal(game.gatherEffects.children[0].name,'Gather count');
 assert.ok(labels(game.gatherEffects).includes('本次采集 +'+amount));
 game.gatherEffects.children[0].isValid=true;scheduled.forEach(fn=>fn());assert.equal(game.gatherEffects.children.length,0);
});

test('success and failure report exact totals, including previous turns, without replaying flights',async()=>{
 for(const won of [true,false]){
  const session=rules.newSession(19,19);session.collected=[2,1,3,0,1,0];session.moves=1;
  const pair=rules.findMove(session.board,session.specials,session.obstacles),preview=rules.move(session,...pair);
  const type=preview.session.collected.findIndex((n,i)=>n>session.collected[i]);
  session.objectives=[{kind:'color',type,target:won?1:99999}];
  const {game,messages}=fixture(session);game.bankGather();
  const result=rules.move(game.session,...pair);assert.equal(result.session.status,won?'won':'lost');
  await game.resolve(result);
  const total=rules.total(result.session.collected),delta=total-rules.total(session.collected);
  assert.equal(rules.total(game.save.inventory),total);assert.deepEqual(messages.filter(m=>m.startsWith('本次采集')),['本次采集 +'+delta]);
  assert.equal(game.modal,'result');assert.ok(labels(game.overlay).some(s=>s.startsWith('本关采集 '+total+' 件珠材')));
  const stock=plain(game.save.inventory);game.result();assert.deepEqual(plain(game.save.inventory),stock);assert.equal(messages.filter(m=>m.startsWith('本次采集')).length,1);
 }
});

test('invalid actions and non-collecting shuffle have no receipt; tools share the exact delta hook',async()=>{
 const session=rules.newSession(971,19),{game,messages}=fixture(session);
 await game.resolve({valid:false});await game.resolve(rules.useTool(session,'shuffle'));
 assert.deepEqual(messages,[]);assert.equal(game.gatherEffects,undefined);assert.equal(rules.total(game.save.inventory),0);
 for(const tool of ['hammer','bloom']){
  const before=rules.total(game.session.collected),result=rules.useTool(game.session,tool,27);
  await game.resolve(result);assert.equal(messages.at(-1),'本次采集 +'+(rules.total(result.session.collected)-before));
  assert.equal(rules.total(game.save.inventory),rules.total(result.session.collected));
 }
 game.navigate('home');assert.equal(game.gatherEffects.children.length,0);
});
