export const DAILY_REWARDS = [
  { coins:30, energy:1 }, { coins:40, energy:1 }, { coins:50, energy:1 },
  { coins:60, energy:2 }, { coins:70, energy:2 }, { coins:80, energy:2 },
  { coins:120, energy:3 },
];
export const ENERGY_EXCHANGE = 10;
const DAY = 86400000;
// shortcut: offline rewards use the device clock; use server time if accounts are introduced.
export const dailyDay = (now=Date.now()) => Math.floor((now+8*3600000)/DAY);
export function freshDaily() { return {lastDay:null,streak:0}; }
export function normalizeDaily(raw:any) {
  return Number.isInteger(raw?.lastDay)&&raw.lastDay>=0&&raw.lastDay<=3650000&&
    Number.isInteger(raw?.streak)&&raw.streak>0&&raw.streak<=100000
    ? {lastDay:raw.lastDay,streak:raw.streak} : freshDaily();
}
export function dailyStatus(save:any,now=Date.now()) {
  const today=dailyDay(now),daily=normalizeDaily(save.daily);
  const claimed=daily.lastDay!==null&&daily.lastDay>=today;
  const streak=claimed||daily.lastDay===today-1?daily.streak:0;
  const day=claimed?(streak-1)%7+1:streak%7+1;
  return {today,canClaim:Number.isFinite(today)&&today>=0&&!claimed,streak,day,
    completed:claimed?day:day-1,reward:DAILY_REWARDS[day-1]};
}
export function claimDaily(save:any,now=Date.now()) {
  const status=dailyStatus(save,now);
  if(!status.canClaim)return null;
  const energy=Math.min(10,save.energy+status.reward.energy);
  const overflow=save.energy+status.reward.energy-energy;
  return {...save,coins:save.coins+status.reward.coins+overflow*ENERGY_EXCHANGE,
    energy,energyAt:energy===10?now:save.energyAt,
    daily:{lastDay:status.today,streak:status.streak+1}};
}
