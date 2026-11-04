import test from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_REWARDS,dailyDay,dailyStatus,claimDaily,normalizeDaily} from '../assets/scripts/daily.ts';
import {freshSave,normalizeSave} from '../assets/scripts/model.ts';
const DAY=86400000,now=Date.parse('2026-11-04T02:00:00Z');
test('daily reward is an immutable transaction, claimed once and preserved through normalization',()=>{
 const save={...freshSave(),energy:5,energyAt:now},before=structuredClone(save),next=claimDaily(save,now);
 assert.deepEqual(save,before);assert.equal(next.coins,110);assert.equal(next.energy,6);assert.equal(next.energyAt,now);
 assert.equal(next.daily.streak,1);assert.equal(dailyStatus(next,now).canClaim,false);assert.equal(claimDaily(next,now),null);
 assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(next))),next);
 for(const key of ['inventory','gatheredStock','materialUnlocked','draft','commerce','level','rep'])assert.deepEqual(next[key],save[key]);
});
test('seven-day rewards cycle, missed days reset, and viewing the panel never grants a reward',()=>{
 let save={...freshSave(),energy:0,energyAt:now};let coins=save.coins;
 for(let day=0;day<9;day++){
  const state=dailyStatus(save,now+day*DAY);assert.equal(state.day,day%7+1);assert.equal(state.canClaim,true);assert.equal(save.coins,coins);
  const reward=DAILY_REWARDS[day%7],overflow=Math.max(0,save.energy+reward.energy-10);
  save=claimDaily(save,now+day*DAY);coins+=reward.coins+overflow*10;assert.equal(save.coins,coins);assert.equal(save.daily.streak,day+1);
 }
 const missed=dailyStatus(save,now+11*DAY);assert.equal(missed.day,1);assert.equal(missed.completed,0);assert.equal(claimDaily(save,now+11*DAY).daily.streak,1);
});
test('Beijing midnight resets exactly, while same-day and backward device clocks cannot repeat a claim',()=>{
 const before=Date.parse('2026-11-04T15:59:59.999Z'),midnight=before+1,save=claimDaily(freshSave(),before);
 assert.equal(dailyDay(midnight),dailyDay(before)+1);assert.equal(claimDaily(save,before),null);assert.equal(claimDaily(save,before-DAY),null);
 assert.equal(dailyStatus(save,midnight).day,2);assert.equal(claimDaily(save,midnight).daily.streak,2);
 assert.equal(claimDaily(save,NaN),null);
});
test('full or partially full energy converts only the overflowing points into coins',()=>{
 for(const [energy,gain,bonus]of [[0,3,0],[9,1,20],[10,0,30]]){
  const save={...freshSave(),energy,energyAt:now-1234,daily:{lastDay:dailyDay(now)-1,streak:6}},next=claimDaily(save,now);
  assert.equal(next.energy-energy,gain);assert.equal(next.coins-save.coins,120+bonus);
  assert.equal(next.energyAt,energy+3>=10?now:save.energyAt);
 }
});
test('old and malformed saves get no invented claim, payout, or material unlock',()=>{
 const old={...freshSave(),coins:1342,energy:4};delete old.daily;
 const migrated=normalizeSave(old);assert.equal(migrated.coins,1342);assert.equal(dailyStatus(migrated,now).canClaim,true);assert.deepEqual(migrated.daily,{lastDay:null,streak:0});
 for(const raw of [null,{}, {lastDay:'date',streak:2},{lastDay:-1,streak:1},{lastDay:dailyDay(now),streak:0},{lastDay:dailyDay(now),streak:Infinity}])assert.deepEqual(normalizeDaily(raw),{lastDay:null,streak:0});
});
