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
  const restored=model.normalizeSave(JSON.parse(JSON.stringify(save)));
  assert.equal(restored.completed.length,6);assert.equal(restored.renovation.cleared.length,11);assert.equal(restored.seenStories.length,10);
});
