import { MATERIALS, CHARMS } from './content.ts';

import { materialStock, charmType, validMaterial, normalizeBeadSizes, normalizeBeadFacings } from './materials.ts';
export const SALE_DELAY = 20000;
const beadPrices = [12, 16, 18, 10, 14, 20];
const buyers = ['林阿姨', '花店小满', '许老师', '隔壁邻居'];
export const CUSTOM_STYLES = [
  {id:'jewelry',name:'珠光雅致',rule:'至少6件珠材，珠宝占比不少于一半',reward:200,category:0,wish:'想要一条珠光柔和、日常也能戴的手串。'},
  {id:'cream',name:'温柔奶油',rule:'至少6件珠材，浅色珠宝占比不少于一半',reward:220,category:0,wish:'喜欢奶油一样温柔的浅色，想把它戴在手腕上。'},
  {id:'crystal',name:'清透水晶',rule:'至少6件珠材，水晶占比不少于一半',reward:220,category:1,wish:'想要清清透透的水晶风格，看起来像一小片晴空。'},
  {id:'forest',name:'自然森系',rule:'至少6件珠材，木质占比不少于一半',reward:240,category:2,wish:'想要木质为主的自然森系，像在林间散步。'},
  {id:'charm',name:'灵动点缀',rule:'至少6件珠材，其中至少1件饰品',reward:210,category:3,wish:'想要带一点小饰品的手串，配色和排列交给你。'},
];
const paleJewelry=[0,6,7,8,9,10];
const customStyle=(id:string)=>CUSTOM_STYLES.find(style=>style.id===id);
const requestId=(n:any)=>Number.isSafeInteger(n)&&n>0&&n<Number.MAX_SAFE_INTEGER-1;

const validBeads = (beads:any) => Array.isArray(beads) && beads.length > 0 &&
  Array.from(beads).every(validMaterial);
const validTime = (n:any) => Number.isSafeInteger(n) && n >= 0;

export function freshCommerce() { return { nextId:1, works:[] }; }
export function workName(value:any, fallback='') {
  return (typeof value==='string'?Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,24).join(''):'') || fallback;
}
const workNames=['春日花信','月光入怀','星河微澜','海盐晴空','蔷薇小梦','林间晨露','琉璃拾光','云边来信','落日余温','花间漫步','清风有约','一串欢喜'];
export function randomWorkName(current='') {
  const choices=workNames.filter(name=>name!==current);
  return choices[Math.floor(Math.random()*choices.length)];
}
export function renameWork(save:any,id:number,name:string) {
  const value=workName(name);
  if(!value || !save.commerce?.works.some((work:any)=>work.id===id))return null;
  return {...save,commerce:{...save.commerce,works:save.commerce.works.map((work:any)=>work.id===id?{...work,name:value}:work)}};
}
export function normalizeCommerce(raw:any) {
  const works:any[] = [], ids = new Set(), commissions = new Set();
  for (const work of Array.isArray(raw?.works) ? raw.works : []) {
    if (!work || !Number.isSafeInteger(work.id) || work.id < 1 || work.id >= Number.MAX_SAFE_INTEGER || ids.has(work.id) ||
      !validBeads(work.beads) || !Object.prototype.hasOwnProperty.call(CHARMS, work.charm) ||
      !['ready','listing','sold'].includes(work.status) || !validTime(work.createdAt)) continue;
    const commission=work.commission;
    if(commission&&(commissions.has(commission.id)||!requestId(commission.id)||!customStyle(commission.style)||work.status!=='sold'||work.claimed!==true||!buyers.includes(work.buyer)||work.price!==customStyle(commission.style)!.reward||!validTime(work.listedAt)||work.sellAt!==work.listedAt||work.listedAt<work.createdAt||!customerFit(commission.style,work.beads,work.charm).ok))continue;
    // Honor existing listings' original price and deadline, including the old squared wait.
    if (!commission && work.status !== 'ready' && (!validTime(work.listedAt) || !validTime(work.sellAt) ||
      !validPrice(work.beads,work.price,300) || ![saleDuration(work.beads,work.price),Math.round(SALE_DELAY*Math.pow(work.price/suggestedPrice(work.beads),2))].some(duration=>work.sellAt===work.listedAt+duration))) continue;
    ids.add(work.id);if(commission)commissions.add(commission.id);
    works.push({id:work.id,name:workName(work.name,'我的手作 · '+work.id),
      beads:[...work.beads],beadSize:[6,7,8,9,10,11,12].includes(work.beadSize)?work.beadSize:8,beadSizes:normalizeBeadSizes(work.beads,work.beadSizes,work.beadSize),beadFacings:normalizeBeadFacings(work.beads,work.beadFacings),charm:work.charm,status:work.status,createdAt:work.createdAt,
      ...(work.status!=='ready'?{price:work.price,listedAt:work.listedAt,sellAt:work.sellAt,
        ...(work.status==='sold'?{buyer:commission?work.buyer:buyers[(work.id-1)%buyers.length],claimed:work.claimed!==false,...(commission?{commission:{id:commission.id,style:commission.style}}:{})}:{})}: {})});
  }
  return {nextId:Math.max(1,...works.map(w=>w.id+1)),works};
}
export function suggestedPrice(beads:number[]) {
  const placed=Array.isArray(beads)?beads.filter(type=>type!==null):[];
  return validBeads(placed) ? placed.reduce((sum,type)=>sum+(beadPrices[type]||16),30) : 0;
}
export function priceBounds(beads:number[],rep=0) {
  const price=suggestedPrice(beads),cap=1.2+Math.min(.3,Math.max(0,Number.isFinite(rep)?rep:0)/1000);
  return {min:Math.ceil(price*.6),max:Math.floor(price*cap)};
}
function validPrice(beads:number[],price:number,rep=0) {
  const bounds=priceBounds(beads,rep);return Number.isInteger(price)&&price>=bounds.min&&price<=bounds.max;
}
export function saleDuration(beads:number[],price:number) {
  return Math.round(SALE_DELAY*Math.pow(price/suggestedPrice(beads),3));
}
export function craftChecks(save:any) {
  const counts = Array(MATERIALS.length).fill(0);
  for (const type of save.draft || []) if (validMaterial(type)) counts[type]++;
  const draft=save.draft;
  return {full:Array.isArray(draft)&&Array.from(draft).every(type=>type===null||validMaterial(type))&&validBeads(draft.filter(type=>type!==null)),charm:save.charm==='none'||charmType(save.charm)>=0&&materialStock(save,charmType(save.charm))>=(counts[charmType(save.charm)]||0)+1,
    stock:counts.every((n,i)=>n<=materialStock(save,i))};
}
export function finishWork(save:any, now=Date.now()) {
  if (!Object.values(craftChecks(save)).every(Boolean) || !validTime(now)) return null;
  const commerce=save.commerce || freshCommerce(), id=commerce.nextId;
  const inventory=[...save.inventory],gatheredStock=[...save.gatheredStock],beads=save.draft.filter(type=>type!==null);
  const spend=(type:number)=>{inventory[type]--;gatheredStock[type]--;};beads.forEach(spend);
  if(save.charm!=='none')spend(charmType(save.charm));
  const beadSizes=normalizeBeadSizes(save.draft,save.draftSizes,save.beadSize).filter((_,i)=>save.draft[i]!==null);
  const beadFacings=normalizeBeadFacings(save.draft,save.draftFacings).filter((_,i)=>save.draft[i]!==null);
  const work={id,name:workName(save.draftName,'我的手作 · '+id),beads,beadSize:[6,7,8,9,10,11,12].includes(save.beadSize)?save.beadSize:8,beadSizes,beadFacings,charm:save.charm,status:'ready',createdAt:now};
  return {...save,inventory,gatheredStock,charm:'none',draftName:'',draft:Array(12).fill(null),draftSizes:Array(12).fill(8),draftFacings:Array(12).fill('out'),commerce:{nextId:id+1,works:[...commerce.works,work]}};
}
export function listWork(save:any, id:number, price:number, now=Date.now()) {
  const work=save.commerce.works.find((w:any)=>w.id===id);
  if (!work || work.status!=='ready' || !validPrice(work.beads,price,save.rep) || !validTime(now)) return null;
  return {...save,commerce:{...save.commerce,works:save.commerce.works.map((w:any)=>w.id===id?
    {...w,status:'listing',price,listedAt:now,sellAt:now+saleDuration(w.beads,price)}:w)}};
}
export function withdrawWork(save:any,id:number,now=Date.now()) {
  const work=save.commerce.works.find((w:any)=>w.id===id);
  if (!work || work.status!=='listing' || !validTime(now) || now>=work.sellAt) return null;
  return {...save,commerce:{...save.commerce,works:save.commerce.works.map((w:any)=>{
    if(w.id!==id)return w;
    const {price,listedAt,sellAt,...ready}=w;return {...ready,status:'ready'};
  })}};
}
export function settleSales(save:any,now=Date.now()) {
  const due=save.commerce?.works.filter((w:any)=>w.status==='listing'&&now>=w.sellAt)||[];
  if(!due.length)return save;
  return {...save,rep:save.rep+due.length*10,
    commerce:{...save.commerce,works:save.commerce.works.map((w:any)=>due.includes(w)?
      {...w,status:'sold',claimed:false,buyer:buyers[(w.id-1)%buyers.length]}:w)}};
}
export function collectSale(save:any,id:number) {
  const work=save.commerce?.works.find((w:any)=>w.id===id);
  if(!work||work.status!=='sold'||work.claimed!==false)return null;
  return {...save,coins:save.coins+work.price,commerce:{...save.commerce,
    works:save.commerce.works.map((w:any)=>w.id===id?{...w,claimed:true}:w)}};
}
export function salesProgress(save:any) {
  return (save.completed?.length||0)+(save.commerce?.works.filter((w:any)=>w.status==='sold').length||0);
}


export function freshCustomers() { return {nextId:1,nextAt:0,lastStyle:'',active:null}; }
export function normalizeCustomers(raw:any,commerce:any) {
  const delivered=commerce.works.filter((work:any)=>work.commission).map((work:any)=>work.commission.id),a=raw?.active;
  const active=a&&requestId(a.id)&&customStyle(a.style)&&buyers.includes(a.buyer)&&['offered','accepted'].includes(a.status)&&validTime(a.createdAt)&&!delivered.includes(a.id)
    ?{id:a.id,style:a.style,buyer:a.buyer,status:a.status,createdAt:a.createdAt}:null;
  return {nextId:Math.max(requestId(raw?.nextId)?raw.nextId:1,...delivered.map((id:number)=>id+1),active?active.id+1:1),nextAt:validTime(raw?.nextAt)?raw.nextAt:0,lastStyle:customStyle(raw?.lastStyle)?raw.lastStyle:'',active};
}
export function customerFit(styleId:string,beads:any[],charm='none') {
  const style=customStyle(styleId),valid=Array.isArray(beads)&&Array.from(beads).every(type=>type===null||validMaterial(type));
  const parts=valid?beads.filter(type=>type!==null):[];
  if(charm!=='none'&&charmType(charm)>=0)parts.push(charmType(charm));
  const matching=style?parts.filter(type=>style.id==='cream'?paleJewelry.includes(type):MATERIALS[type].category===style.category).length:0;
  const required=styleId==='charm'?1:Math.max(3,Math.ceil(parts.length/2)),full=parts.length>=6,theme=matching>=required;
  return {total:parts.length,matching,required,full,theme,ok:!!style&&valid&&full&&theme};
}
export function updateCustomers(save:any,now=Date.now(),random=Math.random) {
  const state=save.customers||freshCustomers();
  if(!save.started||state.active||!validTime(now))return save;
  if(!state.nextAt)return {...save,customers:{...state,nextAt:now+15000+Math.floor(random()*15001)}};
  if(now<state.nextAt||!requestId(state.nextId))return save;
  const stock=MATERIALS.flatMap((_,type)=>Array(Math.min(6,materialStock(save,type))).fill(type));
  const pool=CUSTOM_STYLES.filter(style=>{
    const matching=stock.filter(type=>style.id==='cream'?paleJewelry.includes(type):MATERIALS[type].category===style.category).length;
    return stock.length>=6&&matching>=(style.id==='charm'?1:3)||save.commerce.works.some((work:any)=>work.status==='ready'&&customerFit(style.id,work.beads,work.charm).ok);
  });
  const choices=pool.filter(style=>style.id!==state.lastStyle),options=choices.length?choices:pool.length?pool:[CUSTOM_STYLES[0]];
  const style=options[Math.min(options.length-1,Math.floor(random()*options.length))];
  const active={id:state.nextId,style:style.id,buyer:buyers[Math.min(buyers.length-1,Math.floor(random()*buyers.length))],status:'offered',createdAt:now};
  return {...save,customers:{...state,nextId:state.nextId+1,active}};
}
export function acceptCustomer(save:any,id:number) {
  const active=save.customers?.active;if(!active||active.id!==id||active.status!=='offered')return null;
  return {...save,customers:{...save.customers,active:{...active,status:'accepted'}}};
}
export function declineCustomer(save:any,id:number,now=Date.now(),random=Math.random) {
  const active=save.customers?.active;if(!active||active.id!==id||!validTime(now))return null;
  return {...save,customers:{...save.customers,lastStyle:active.style,active:null,nextAt:now+60000+Math.floor(random()*60001)}};
}
export function deliverCustomer(save:any,request:number,workId:number,now=Date.now(),random=Math.random) {
  const active=save.customers?.active,work=save.commerce?.works.find((w:any)=>w.id===workId),style=customStyle(active?.style);
  if(!active||active.id!==request||active.status!=='accepted'||!style||!work||work.status!=='ready'||!customerFit(style.id,work.beads,work.charm).ok||!validTime(now)||now<work.createdAt||save.commerce.works.some((w:any)=>w.commission?.id===request))return null;
  const released=declineCustomer(save,request,now,random);
  return {...released,coins:save.coins+style.reward,rep:save.rep+12,commerce:{...save.commerce,works:save.commerce.works.map((w:any)=>w.id===workId?
    {...w,status:'sold',price:style.reward,listedAt:now,sellAt:now,buyer:active.buyer,claimed:true,commission:{id:request,style:style.id}}:w)}};
}
