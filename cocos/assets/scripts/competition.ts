import { salesProgress } from "./commerce.ts";
import { BEADS, CHARMS } from './content.ts';
import { normalizeBeadSizes } from './materials.ts';
export const COMPETITIONS = [
  { id:'spring', title:'街角花园灵感赛', theme:'把春天留在手腕上', description:'用绿玉与花珠，做一条像街角小花园的手串。', unlock:1, main:3, accent:5, charm:'daisy', reward:120 },
  { id:'sea', title:'海风配色交流赛', theme:'天刚亮时的海', description:'用蓝晶与珍珠，留住海面初亮时的一点宁静。', unlock:3, main:2, accent:0, charm:'moon', reward:160 },
  { id:'light', title:'小城星光手作赛', theme:'为普通日子留一束光', description:'用金星与红心，给平凡的一天添上一点闪光。', unlock:5, main:4, accent:1, charm:'heart', reward:200 },
];
export const CONTEST_CHARMS = Object.keys(CHARMS);
export function freshCompetitions() { return { draft:null, entries:[] }; }
const validBeads = (beads:any, partial=false) => Array.isArray(beads)&&beads.length===12&&Array.from(beads).every((n:any)=>(partial&&n===null)||(Number.isInteger(n)&&n>=0&&n<BEADS.length));
export function evaluateCompetition(id:string, beads:any, charm:string,legacy=false) {
  const event=COMPETITIONS.find(e=>e.id===id);
  if(!event||!validBeads(beads)||!CONTEST_CHARMS.includes(charm))return null;
  const count=(type:number)=>beads.filter((n:number)=>n===type).length;
  const main=count(event.main);
  const theme=legacy?Math.round(Math.min(1,main/6)*45):Math.round(main<=6?main*5:30+Math.min(2,main-6)*7.5);
  const accent=Math.round(Math.min(1,count(event.accent)/3)*20);
  const detail=charm===event.charm?10:0;
  const echo=Math.round(beads.slice(0,6).filter((n:number,i:number)=>n===beads[i+6]).length/6*25);
  const score=theme+accent+detail+echo;
  const medal=score>=90?'金色灵感奖':score>=75?'银色巧思奖':score>=60?'铜色心意奖':'参与纪念奖';
  const reward=Math.round(event.reward*(score>=90?1:score>=75?.7:score>=60?.4:.15));
  return { score, theme, accent, detail, echo, medal, reward };
}
export function normalizeCompetitions(raw:any, completed:string[]) {
  const entries:any[]=[];
  for(const event of COMPETITIONS) {
    const entry=Array.isArray(raw?.entries)?raw.entries.find((x:any)=>x?.id===event.id):null;
    const result=entry&&completed.length>=event.unlock?evaluateCompetition(event.id,entry.beads,entry.charm,entry.scoringVersion!==2):null;
    // Completed contests retain the old paid amount; upgrades never pay them again.
    if(result)entries.push({id:event.id,beads:entry.beads.slice(),beadSizes:normalizeBeadSizes(entry.beads,entry.beadSizes),charm:entry.charm,...result,reward:entry.reward===result.reward/2?entry.reward:result.reward,...(entry.scoringVersion===2?{scoringVersion:2}:{})});
  }
  const event=COMPETITIONS.find(e=>e.id===raw?.draft?.id);
  const draft=event&&completed.length>=event.unlock&&!entries.some(e=>e.id===event.id)&&validBeads(raw.draft.beads,true)&&CONTEST_CHARMS.includes(raw.draft.charm)
    ?{id:event.id,beads:raw.draft.beads.slice(),beadSizes:normalizeBeadSizes(raw.draft.beads,raw.draft.beadSizes),charm:raw.draft.charm}:null;
  return {draft,entries};
}
export function beginCompetition(save:any,id:string,replace=false) {
  const event=COMPETITIONS.find(e=>e.id===id);
  if(!event||salesProgress(save)<event.unlock||save.competitions.entries.some((e:any)=>e.id===id))return null;
  const draft=save.competitions.draft;
  if(draft?.id===id)return save;
  if(draft&&!replace)return null;
  return {...save,competitions:{...save.competitions,draft:{id,beads:Array(12).fill(null),beadSizes:Array(12).fill(8),charm:'daisy'}}};
}
export function submitCompetition(save:any) {
  const draft=save.competitions.draft,event=COMPETITIONS.find(e=>e.id===draft?.id);
  if(!event||salesProgress(save)<event.unlock||save.competitions.entries.some((e:any)=>e.id===event.id))return null;
  const result=evaluateCompetition(event.id,draft.beads,draft.charm);
  if(!result)return null;
  return {...save,coins:save.coins+result.reward,competitions:{draft:null,
    entries:[...save.competitions.entries,{id:event.id,beads:draft.beads.slice(),beadSizes:normalizeBeadSizes(draft.beads,draft.beadSizes),charm:draft.charm,...result,scoringVersion:2}]}};
}
export function competitionPalette(id:string) {
  const event=COMPETITIONS.find(e=>e.id===id);
  return event?[...Array(6).fill(event.main),event.main,event.main,event.accent,event.accent,event.accent,event.accent]:null;
}
