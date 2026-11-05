import { BEADS, MATERIALS } from './content.ts';
export const materialPalette = (level:number) => {
  const start=((Math.max(1,level)-1)%8)*6;
  // Interleave all four categories in every six-type board; eight levels cover the catalog.
  return Array.from({length:6},(_,i)=>{
    const position=start+i,category=position%4,cell=Math.floor(position/4);
    return MATERIALS.findIndex(m=>m.category===category&&m.cell===cell);
  });
};
export const materialStock = (save:any,type:number) => Math.max(0,Math.min(save.inventory?.[type]||0,save.gatheredStock?.[type]||0));
export const charmType = (charm:string) => MATERIALS.findIndex(m=>m.id===charm);
export const validBead = (n:any) => Number.isInteger(n)&&n>=0&&n<BEADS.length;
