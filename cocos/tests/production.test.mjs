import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const local=path.join(root,'build/web-mobile');
const release=path.resolve(root,'../cocos-web');
const web=process.env.COCOS_BUILD || (fs.existsSync(local)?local:release);
const bundleDir=path.join(web,'assets/main');

test('Creator production bundle preserves collection iteration and complete game transactions', {skip:!fs.existsSync(bundleDir)},()=>{
  const definitions=new Map(),loaded=new Map();
  const sandbox={System:{register(name,dependencies,factory){
    if(typeof name!=='string'){assert.equal(name.length,0);dependencies(()=>{},{}).execute();return;}
    definitions.set(name,{dependencies,factory});
  }},console};
  const context=vm.createContext(sandbox);
  const chunks=path.join(web,'src/chunks');
  for(const name of fs.readdirSync(chunks).filter(n=>n.endsWith('.js')))vm.runInContext(fs.readFileSync(path.join(chunks,name),'utf8'),context);
  for(const name of fs.readdirSync(bundleDir).filter(n=>/^index.*\.js$/.test(n)))vm.runInContext(fs.readFileSync(path.join(bundleDir,name),'utf8'),context);
  function load(name){
    if(loaded.has(name))return loaded.get(name);
    const definition=definitions.get(name);assert.ok(definition,`Missing compiled module ${name}`);
    const exports={};loaded.set(name,exports);
    const module=definition.factory((key,value)=>{if(typeof key==='object')return Object.assign(exports,key);exports[key]=value;return value;},{meta:{url:name}});
    definition.dependencies.forEach((dep,i)=>module.setters[i](dep==='cc'?{cclegacy:{_RF:{push(){},pop(){}}}}:load(new URL(dep,name).href)));
    module.execute();return exports;
  }
  const model=load([...definitions.keys()].find(n=>n.endsWith('/model.ts')));
  const content=load([...definitions.keys()].find(n=>n.endsWith('/content.ts')));
  const story=load([...definitions.keys()].find(n=>n.endsWith('/story.ts')));
  const normalized=model.normalizeSave(model.freshSave());
  assert.equal(normalized.completed.length,0);
  assert.equal(normalized.seenStories.length,0);
  assert.equal(normalized.renovation.cleared.length,0);
  const board=Array.from({length:64},(_,i)=>(i%8+Math.floor(i/8))%6);
  assert.equal(model.matches(board).length,0);
  [0,1,8,9].forEach(i=>board[i]=5);
  assert.equal(model.matches(board).length,4);
  for(let seed=1;seed<=15;seed++){
    let session=model.newSession(seed,1);assert.equal(model.matches(session.board).length,0);
    const [a,b]=model.findMove(session.board);const result=model.move(session,a,b);
    assert.equal(result.valid,true);assert.equal(result.session.moves,15);
    assert.equal(model.matches(result.session.board).length,0);
    assert.ok(result.frames[0].hit.every(i=>Number.isInteger(i)));
  }
  let save=model.freshSave();save.inventory=[200,200,200,200,200,200];
  for(const order of content.ORDERS){save.orderId=order.id;save.draft=Array.from(order.palette);save.charm=order.charm;const next=model.deliver(save);assert.ok(next);assert.equal(model.deliver(next),null);save=next;}
  assert.equal(save.completed.length,6);assert.equal(save.collection.length,6);
  for(const spot of content.CLEAN_SPOTS)save=model.cleanSpot(save,spot.id);
  for(const repair of content.REPAIRS)save=model.repairShop(save,repair.id);
  for(const f of content.FURNITURE)for(let tier=1;tier<=2;tier++)save=model.purchase(save,f.id,tier);
  assert.equal(model.shopProgress(save).percent,100);
  for(const s of content.STORIES)save=story.finishStory(save,s.id);
  assert.equal(save.seenStories.length,10);
  const heart=load([...definitions.keys()].find(n=>n.endsWith('/heart.ts')));
  save=heart.askSea(save,'fear');save=heart.askSea(save,'sunrise');
  assert.equal(save.seaHeart.facts.length,2);
  assert.equal(heart.seaVisitReady(save),true);
  save=heart.finishSeaVisit(save,'heart');
  assert.equal(heart.finishSeaVisit(save,'daisy'),null);
  assert.equal(save.collection.find(x=>x.id==='sea').travelCharm,'heart');
  const restored=model.normalizeSave(JSON.parse(JSON.stringify(save)));
  const nextOrder=model.currentOrder(restored);
  assert.equal(nextOrder.customer,'林阿姨');assert.equal(nextOrder.name,'再送妈妈一朵花');
  const repeat=model.deliver({...restored,draft:Array.from(nextOrder.palette),charm:nextOrder.charm});
  assert.equal(repeat.repeatOrders,1);assert.equal(repeat.coins,restored.coins+nextOrder.reward);
  assert.equal(repeat.collection.length,6);assert.equal(repeat.repeatCollection.length,1);
  assert.equal(model.deliver(repeat),null);assert.equal(model.currentOrder(repeat).id,'sea');
  assert.equal(restored.seaHeart.facts.length,2);assert.equal(restored.seaHeart.visited,true);
  const competitions=load([...definitions.keys()].find(n=>n.endsWith('/competition.ts')));
  const originalStock=Array.from(restored.inventory),originalDraft=Array.from(restored.draft),beforeCoins=restored.coins;
  let entry=competitions.beginCompetition(restored,'spring');
  entry.competitions.draft.beads=competitions.competitionPalette('spring');
  entry=competitions.submitCompetition(entry);
  assert.equal(entry.coins,beforeCoins+60);assert.equal(entry.competitions.entries[0].score,100);
  assert.deepEqual(Array.from(entry.inventory),originalStock);assert.deepEqual(Array.from(entry.draft),originalDraft);
  assert.equal(competitions.submitCompetition(entry),null);assert.equal(competitions.beginCompetition(entry,'spring'),null);
  assert.equal(model.normalizeSave(JSON.parse(JSON.stringify(entry))).competitions.entries[0].score,100);
  assert.equal(restored.completed.length,6);assert.equal(restored.renovation.cleared.length,11);assert.equal(restored.seenStories.length,10);
});
