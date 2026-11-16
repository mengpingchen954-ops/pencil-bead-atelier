import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {freshSave,normalizeSave} from '../assets/scripts/model.ts';
import {MUSIC_TRACKS,normalizeMusic} from '../assets/scripts/music-settings.ts';
const require=createRequire(import.meta.url);
const {load,root}=require('../tools/generate-editor-layouts.cjs');
const {BackgroundMusic}=load(root+'/assets/scripts/BackgroundMusic.ts');

test('music preferences migrate safely, clamp volume and retain the selected song',()=>{
  const legacy=freshSave();delete legacy.music;
  assert.deepEqual(normalizeSave(legacy).music,{track:'glimmer',volume:.35,enabled:true});
  const save={...freshSave(),music:{track:'piano',volume:.67,enabled:false}};
  assert.deepEqual(normalizeSave(save).music,save.music);
  assert.deepEqual(normalizeMusic({track:'bad',volume:Infinity,enabled:false}),{track:'glimmer',volume:.35,enabled:false});
  assert.equal(normalizeMusic({volume:3}).volume,1);assert.equal(normalizeMusic({volume:-3}).volume,0);
  assert.equal(new Set(MUSIC_TRACKS.map(t=>t.id)).size,6);
});

function player(){
  const source={playing:false,clip:null,volume:0,plays:0,stops:0,pauses:0,play(){this.playing=true;this.plays++;},pause(){this.playing=false;this.pauses++;},stop(){this.playing=false;this.stops++;}};
  const pending=[],failures=[],tracks=[],events=new Map();
  source.node={on:(event,fn,target)=>events.set(event,source=>fn.call(target,source)),off:event=>events.delete(event)};
  const music=new BackgroundMusic(source,(path,done)=>pending.push({path,done}),()=>failures.push(true),track=>tracks.push(track));
  return {music,source,pending,failures,tracks,events};
}

test('music plays independently and volume changes or gameplay clicks do not restart playback',()=>{
  const {music,source,pending}=player();
  music.update({track:'glimmer',volume:.35});
  assert.equal(pending[0].path,'music/glimmer');assert.equal(source.loop,false);
  pending[0].done(null,{name:'glimmer'});assert.equal(source.plays,1);
  music.update({track:'glimmer',volume:.8});music.update({track:'glimmer',volume:.8});
  assert.equal(source.volume,.8);assert.equal(source.plays,1);assert.equal(pending.length,1);
  music.update({track:'glimmer',volume:0});assert.equal(source.playing,false);
  music.update({track:'glimmer',volume:.5});assert.equal(source.playing,true);
  music.setHidden(true);assert.equal(source.playing,false);
  music.setHidden(false);assert.equal(source.playing,true);
  music.update({track:'glimmer',volume:.5,enabled:false});
  music.setHidden(true);music.setHidden(false);assert.equal(source.playing,false);
});

test('rapid song switching, pause while loading and disposed loaders never play stale tracks',()=>{
  const {music,source,pending,failures}=player();
  music.update({track:'glimmer',volume:.3});music.update({track:'piano',volume:.4});
  pending[0].done(null,{name:'glimmer'});assert.equal(source.clip,null);
  music.update({track:'piano',volume:.4,enabled:false});
  pending[1].done(null,{name:'piano'});assert.equal(source.clip.name,'piano');assert.equal(source.playing,false);
  music.update({track:'piano',volume:.4});assert.equal(source.playing,true);
  music.update({track:'time',volume:.4});pending[2].done(new Error('Unavailable'));
  assert.equal(failures.length,1);assert.equal(music.snapshot().failed,true);
  music.update({track:'calm',volume:.4});music.dispose();
  pending[3].done(null,{name:'calm'});assert.equal(source.clip,null);assert.equal(source.playing,false);
});

test('a disabled saved player loads only when music is enabled',()=>{
  const {music,source,pending}=player();
  music.update({track:'healing',volume:.25,enabled:false});assert.equal(pending.length,0);
  music.update({track:'healing',volume:.25,enabled:true});assert.equal(pending.length,1);
  pending[0].done(null,{name:'healing'});assert.equal(source.playing,true);
});

test('natural song endings advance the playlist once, wrap, and stop after disposal',()=>{
 const {music,source,pending,tracks,events}=player(),ended=source=>events.get('ended')?.(source);
 music.update({track:'glimmer',volume:.35});pending[0].done(null,{name:'glimmer'});
 ended({});assert.equal(tracks.length,0);ended();assert.equal(pending[1].path,'music/calm');assert.deepEqual(tracks,['calm']);
 pending[1].done(null,{name:'calm'});assert.equal(source.playing,true);
 music.setHidden(true);ended();assert.equal(tracks.length,1);music.setHidden(false);
 music.update({track:'healing',volume:.35});pending[2].done(null,{name:'healing'});ended();
 assert.equal(pending[3].path,'music/glimmer');assert.deepEqual(tracks,['calm','glimmer']);
 music.update({track:'glimmer',enabled:false});ended();assert.equal(tracks.length,2);
 music.dispose();assert.equal(events.size,0);ended();assert.equal(tracks.length,2);
});
