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
export const validMaterial = (n:any) => Number.isInteger(n)&&n>=0&&n<MATERIALS.length;
export function ringMaterials(beads:(number|null)[],sizes:number[]|undefined,charm='none',fallback=8) {
  const parts=[...beads],dimensions=normalizeBeadSizes(parts,sizes,fallback),type=charmType(charm);
  if(type>=0){const empty=parts.indexOf(null),index=empty<0?parts.length:empty;parts[index]=type;dimensions[index]=8;}
  return {beads:parts,sizes:dimensions};
}
export const normalizeBeadSizes = (beads:any[],sizes:any,fallback=8) =>
  Array.from(beads,(_,i)=>[6,8,10,12].includes(sizes?.[i])?sizes[i]:[6,8,10,12].includes(fallback)?fallback:8);
