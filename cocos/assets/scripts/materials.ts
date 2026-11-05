import { BEADS, MATERIALS } from './content.ts';
export const materialPalette = (level:number) => {
  const step=(Math.max(1,level)-1)%12;
  // Two jewelry, two crystal, one wood and one charm; twelve levels cover all materials.
  return [0,1,0,1,2,3].map((category,i)=>{
    const cell=category<2?(step*2+Math.floor(i/2))%12:step;
    return MATERIALS.findIndex(m=>m.category===category&&m.cell===cell);
  });
};
// 60% jewelry, 20% crystal, 10% wood and 10% charms before avoiding opening matches.
export const MATERIAL_DROPS = [0,0,0,1,2,2,2,3,4,5];
export const materialStock = (save:any,type:number) => Math.max(0,Math.min(save.inventory?.[type]||0,save.gatheredStock?.[type]||0));
export const charmType = (charm:string) => MATERIALS.findIndex(m=>m.id===charm);
export const validBead = (n:any) => Number.isInteger(n)&&n>=0&&n<BEADS.length;
export const validMaterial = (n:any) => Number.isInteger(n)&&n>=0&&n<MATERIALS.length;
export function ringMaterials(beads:(number|null)[],sizes:number[]|undefined,charm='none',fallback=8,facings?:string[]) {
  const parts=[...beads],dimensions=normalizeBeadSizes(parts,sizes,fallback),directions=normalizeBeadFacings(parts,facings),type=charmType(charm);
  if(type>=0){const empty=parts.indexOf(null),index=empty<0?parts.length:empty;parts[index]=type;dimensions[index]=8;directions[index]='out';}
  return {beads:parts,sizes:dimensions,facings:directions};
}
export const normalizeBeadSizes = (beads:any[],sizes:any,fallback=8) =>
  Array.from(beads,(_,i)=>[6,7,8,9,10,11,12].includes(sizes?.[i])?sizes[i]:[6,7,8,9,10,11,12].includes(fallback)?fallback:8);
export const normalizeBeadFacings = (beads:any[],facings:any) =>
  Array.from(beads,(type,i)=>MATERIALS[type]?.id&&facings?.[i]==='in'?'in':'out');
// Hole and body points measured on the existing 192px charm sprites; bow threads through its knot.
const CHARM_POINTS:Record<string,number[]> = {
  sakura:[130,32,90,105],butterfly:[99,32,99,118],star:[99,31,99,118],moon:[99,31,83,120],
  bow:[90,83,90,139],pearl:[99,32,99,118],drop:[98,32,98,122],leaf:[29,55,116,103],
  bell:[90,31,90,116],tassel:[105,32,101,127],daisy:[48,40,96,110],heart:[99,31,99,112],
};
export function materialPlacement(type:number,radialAngle:number,facing='out') {
  const points=CHARM_POINTS[MATERIALS[type]?.id];
  if(!points)return {anchorX:.5,anchorY:.5,angle:0,offsetX:0,offsetY:0};
  const [hx,hy,bx,by]=points,angle=Math.atan2(by-hy,bx-hx)-radialAngle-(facing==='in'?Math.PI:0),dx=.5-hx/192,dy=.5-hy/192;
  return {anchorX:hx/192,anchorY:1-hy/192,angle:angle*180/Math.PI,
    offsetX:Math.cos(angle)*dx+Math.sin(angle)*dy,offsetY:-Math.sin(angle)*dx+Math.cos(angle)*dy};
}
