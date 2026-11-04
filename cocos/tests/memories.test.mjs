import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSave,deliver,normalizeSave} from '../assets/scripts/model.ts';
import {finishStory} from '../assets/scripts/story.ts';
import {askSea,finishSeaVisit} from '../assets/scripts/heart.ts';
import {ORDERS} from '../assets/scripts/content.ts';
import {characterMemories} from '../assets/scripts/memories.ts';

test('new character memories introduce family and keep unmet people and unread history locked',()=>{
 const save=freshSave(),people=characterMemories(save);
 assert.deepEqual(people.filter(p=>p.unlock).map(p=>p.id),['grandma','ahe']);
 assert.equal(people[0].known.length,1);assert.equal(people[0].steps,1);assert.equal(people[0].stage,'家人相伴');
 assert.equal(people[0].known.some(k=>k.text.includes('遗产')),false);
 for(const p of people.filter(p=>!p.unlock)){assert.deepEqual(p.known,[]);assert.deepEqual(p.orders,[]);assert.equal(p.steps,0);}
});
test('reading a known story updates memories without changing rewards or exposing the next scene',()=>{
 const before=freshSave(),save=finishStory(before,'old-table'),snapshot=JSON.stringify(save);
 const grandma=characterMemories(save)[0];assert.equal(grandma.known.length,2);assert.equal(grandma.known[1].storyId,'old-table');
 assert.equal(grandma.known.some(k=>k.storyId==='first-receipt'),false);
 assert.equal(save.coins,before.coins);assert.deepEqual(save.inventory,before.inventory);assert.equal(JSON.stringify(save),snapshot);
});
test('customer memories derive from actual chat, paid works and the saved return visit',()=>{
 let save={...freshSave(),charm:"daisy",inventory:Array(6).fill(1000)};
 save=deliver({...save,draft:[...ORDERS[0].palette].reverse()});
 save=askSea(save,'fear');let people=characterMemories(save),xiaoman=people.find(p=>p.id==='xiaoman');
 assert.equal(xiaoman.unlock,true);assert.ok(xiaoman.known.some(k=>k.text.includes('慢慢走')));assert.equal(people.find(p=>p.id==='teacher').unlock,false);
 assert.notEqual(xiaoman.stage,'带着故事回来');
 const lin=people.find(p=>p.id==='lin');assert.deepEqual(lin.orders[0].work.beads,save.collection[0].beads);
 for(const o of ORDERS.slice(1,3))save=deliver({...save,draft:o.palette,charm:o.charm});
 save=finishSeaVisit(save,'heart');people=characterMemories(normalizeSave(JSON.parse(JSON.stringify(save))));
 xiaoman=people.find(p=>p.id==='xiaoman');assert.equal(people.find(p=>p.id==='teacher').unlock,true);assert.ok(xiaoman.known.some(k=>k.title==='小满的旅行回访'));
 assert.equal(xiaoman.orders[0].id,'sea');assert.equal(xiaoman.orders.some(o=>o.id==='violet'),false);
 assert.ok(people.every(p=>p.steps>=0&&p.steps<=4));
});
