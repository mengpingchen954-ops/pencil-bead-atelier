import { CHARMS } from './content.ts';

export const SALE_DELAY = 20000;
const beadPrices = [12, 16, 18, 10, 14, 20];
const buyers = ['林阿姨', '花店小满', '许老师', '隔壁邻居'];
const validBeads = (beads:any) => Array.isArray(beads) && beads.length === 12 &&
  Array.from(beads).every(n => Number.isInteger(n) && n >= 0 && n < 6);
const validTime = (n:any) => Number.isSafeInteger(n) && n >= 0;

export function freshCommerce() { return { nextId:1, works:[] }; }
export function normalizeCommerce(raw:any) {
  const works:any[] = [], ids = new Set();
  for (const work of Array.isArray(raw?.works) ? raw.works : []) {
    if (!work || !Number.isSafeInteger(work.id) || work.id < 1 || work.id >= Number.MAX_SAFE_INTEGER || ids.has(work.id) ||
      !validBeads(work.beads) || !Object.prototype.hasOwnProperty.call(CHARMS, work.charm) ||
      !['ready','listing','sold'].includes(work.status) || !validTime(work.createdAt)) continue;
    if (work.status !== 'ready' && (!validTime(work.listedAt) || !validTime(work.sellAt) ||
      !validPrice(work.beads,work.price) || work.sellAt !== work.listedAt + saleDuration(work.beads,work.price))) continue;
    ids.add(work.id);
    works.push({id:work.id,name:typeof work.name==='string'?work.name.slice(0,24):'我的手作 · '+work.id,
      beads:[...work.beads],charm:work.charm,status:work.status,createdAt:work.createdAt,
      ...(work.status!=='ready'?{price:work.price,listedAt:work.listedAt,sellAt:work.sellAt,
        ...(work.status==='sold'?{buyer:buyers[(work.id-1)%buyers.length]}:{})}: {})});
  }
  return {nextId:Math.max(1,...works.map(w=>w.id+1)),works};
}
export function suggestedPrice(beads:number[]) {
  return validBeads(beads) ? beads.reduce((sum,type)=>sum+beadPrices[type],30) : 0;
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
  const counts = Array(6).fill(0);
  for (const type of save.draft || []) if (Number.isInteger(type) && type >= 0 && type < 6) counts[type]++;
  return {full:validBeads(save.draft),charm:Object.prototype.hasOwnProperty.call(CHARMS,save.charm),
    stock:counts.every((n,i)=>n<=(save.inventory?.[i]||0))};
}
export function finishWork(save:any, now=Date.now()) {
  if (!Object.values(craftChecks(save)).every(Boolean) || !validTime(now)) return null;
  const commerce=save.commerce || freshCommerce(), id=commerce.nextId;
  const inventory=[...save.inventory];save.draft.forEach((type:number)=>inventory[type]--);
  const work={id,name:'我的手作 · '+id,beads:[...save.draft],charm:save.charm,status:'ready',createdAt:now};
  return {...save,inventory,draft:Array(12).fill(null),commerce:{nextId:id+1,works:[...commerce.works,work]}};
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
  return {...save,coins:save.coins+due.reduce((sum,w)=>sum+w.price,0),rep:save.rep+due.length*10,
    commerce:{...save.commerce,works:save.commerce.works.map((w:any)=>due.includes(w)?
      {...w,status:'sold',buyer:buyers[(w.id-1)%buyers.length]}:w)}};
}
export function salesProgress(save:any) {
  return (save.completed?.length||0)+(save.commerce?.works.filter((w:any)=>w.status==='sold').length||0);
}
