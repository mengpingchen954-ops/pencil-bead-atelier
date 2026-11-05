import { BEADS, MATERIALS } from './content.ts';
export const materialPalette = (level:number) => {
  const step=(Math.max(1,level)-1)%12;
  // Two jewelry, two crystal, one wood and one charm; twelve levels cover all materials.
  return [0,1,0,1,2,3].map((category,i)=>{
    const cell=category<2?(step*2+Math.floor(i/2))%12:step;
    return MATERIALS.findIndex(m=>m.category===category&&m.cell===cell);
  });
};
// 40% jewelry, 40% crystal, 10% wood and 10% charms before avoiding opening matches.
export const MATERIAL_DROPS = [0,0,1,1,2,2,3,3,4,5];
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
