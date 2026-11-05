import { MATERIALS, CHARMS } from './content.ts';

import { materialStock, charmType, validMaterial, normalizeBeadSizes, normalizeBeadFacings } from './materials.ts';
export const SALE_DELAY = 20000;
const beadPrices = [12, 16, 18, 10, 14, 20];
const buyers = ['林阿姨', '花店小满', '许老师', '隔壁邻居'];
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
  const works:any[] = [], ids = new Set();
  for (const work of Array.isArray(raw?.works) ? raw.works : []) {
    if (!work || !Number.isSafeInteger(work.id) || work.id < 1 || work.id >= Number.MAX_SAFE_INTEGER || ids.has(work.id) ||
      !validBeads(work.beads) || !Object.prototype.hasOwnProperty.call(CHARMS, work.charm) ||
      !['ready','listing','sold'].includes(work.status) || !validTime(work.createdAt)) continue;
    if (work.status !== 'ready' && (!validTime(work.listedAt) || !validTime(work.sellAt) ||
      !validPrice(work.beads,work.price) || work.sellAt !== work.listedAt + saleDuration(work.beads,work.price))) continue;
    ids.add(work.id);
    works.push({id:work.id,name:workName(work.name,'我的手作 · '+work.id),
      beads:[...work.beads],beadSize:[6,7,8,9,10,11,12].includes(work.beadSize)?work.beadSize:8,beadSizes:normalizeBeadSizes(work.beads,work.beadSizes,work.beadSize),beadFacings:normalizeBeadFacings(work.beads,work.beadFacings),charm:work.charm,status:work.status,createdAt:work.createdAt,
      ...(work.status!=='ready'?{price:work.price,listedAt:work.listedAt,sellAt:work.sellAt,
        ...(work.status==='sold'?{buyer:buyers[(work.id-1)%buyers.length],claimed:work.claimed!==false}:{})}: {})});
  }
  return {nextId:Math.max(1,...works.map(w=>w.id+1)),works};
}
export function suggestedPrice(beads:number[]) {
  const placed=Array.isArray(beads)?beads.filter(type=>type!==null):[];
  return validBeads(placed) ? placed.reduce((sum,type)=>sum+(beadPrices[type]||16),30) : 0;
}
export function priceBounds(beads:number[]) {
  const price=suggestedPrice(beads);return {min:Math.ceil(price*.6),max:Math.floor(price*1.5)};
}
function validPrice(beads:number[],price:number) {
  const bounds=priceBounds(beads);return Number.isInteger(price)&&price>=bounds.min&&price<=bounds.max;
}
export function saleDuration(beads:number[],price:number) {
  return Math.round(SALE_DELAY*Math.pow(price/suggestedPrice(beads),2));
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
  if (!work || work.status!=='ready' || !validPrice(work.beads,price) || !validTime(now)) return null;
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
