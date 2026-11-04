import { BEADS, MATERIALS } from './content.ts';
export const materialPalette = (level:number) => {
  const group=Math.floor((Math.max(1,level)-1)/2)%4, half=(Math.max(1,level)-1)%2;
  // Six types keep the existing match difficulty while every reference material can be gathered.
  return MATERIALS.map((m,i)=>({m,i})).filter(({m})=>m.category===group&&Math.floor(m.cell/6)===half).map(({i})=>i);
};
export const materialStock = (save:any,type:number) => Math.max(0,Math.min(save.inventory?.[type]||0,save.gatheredStock?.[type]||0));
export const charmType = (charm:string) => MATERIALS.findIndex(m=>m.id===charm);
export const validBead = (n:any) => Number.isInteger(n)&&n>=0&&n<BEADS.length;
