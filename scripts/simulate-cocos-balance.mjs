import fs from 'node:fs';
import {newSession,move,activateSpecial,useTool,goalProgress,total,adjacent,matches} from '../cocos/assets/scripts/model.ts';
const samples=Number(process.env.BALANCE_SAMPLES||1000),dir=process.env.BALANCE_ARTIFACTS||'artifacts/balance-simulation';
if(!Number.isInteger(samples)||samples<1)throw Error('BALANCE_SAMPLES must be a positive integer');
fs.mkdirSync(dir,{recursive:true});
const merit=s=>goalProgress(s).reduce((sum,g)=>sum+Math.min(g.current,g.target)/g.target,0)*100+s.specials.filter(Boolean).length*1.8+total(s.collected)*.005;
const results=[];
for(let level=4;level<=15;level++){
 let wins=0,turns=0;
 for(let seed=1;seed<=samples;seed++){
  let s=newSession(seed,level);
  for(let guard=0;s.status==='playing'&&guard<80;guard++){
   let best=null,value=-Infinity;
   const choose=r=>{if(!r.valid)return;const score=merit(r.session)+(r.session.status==='won'?10000:0);if(score>value){value=score;best=r.session;}};
   for(let i=0;i<64;i++){
    for(const j of [i+1,i+8]){
     if(!adjacent(i,j))continue;
     if(!s.specials[i]&&!s.specials[j]){
      if(s.board[i]===s.board[j])continue;
      const board=[...s.board];[board[i],board[j]]=[board[j],board[i]];if(!matches(board).length)continue;
     }
     choose(move(s,i,j));
    }
    if(s.specials[i])choose(activateSpecial(s,i));
    if(s.moves<=4)for(const tool of ['hammer','bloom'])if(s.tools[tool])choose(useTool(s,tool,i));
   }
   if(!best)throw Error(`No action at level ${level}, seed ${seed}`);
   s=best;turns++;
  }
  if(s.status==='won')wins++;
  if(seed%250===0)console.log(`Level ${level}: ${seed}/${samples}, wins ${wins}`);
 }
 results.push({level,samples,wins,winRate:wins/samples,meanActions:turns/samples});
 fs.writeFileSync(dir+'/report.json',JSON.stringify({policy:'Deterministic greedy search over legal moves and real cascades; tools considered in last four moves. Bot rates are not player win rates.',results},null,2));
 console.log(JSON.stringify(results.at(-1)));
}
