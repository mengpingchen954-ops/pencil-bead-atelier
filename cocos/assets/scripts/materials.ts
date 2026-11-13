import { BEADS, MATERIALS } from './content.ts';
export const materialPalette = (level:number) => {
  const step=(Math.max(1,level)-1)%12;
  const paleJewelry=[0,7,8,6,9,10],paleCrystal=[19,16,15,18];
  const accentJewelry=[7,0,1,2,3,4,5,6,8,9,10,11][step];
  const accentCrystal=[12,13,15,14,17,20,16,21,22,18,19,23][step];
  const wood=[24,25,30,27,28,29,26,31,32,33,34,35][step];
  // Pale main colors dominate; rotate accents so all 48 materials remain collectible.
  const primary=(palette:number[],accent:number)=>{const choices=palette.filter(type=>type!==accent);return choices[step%choices.length];};
  return [primary(paleJewelry,accentJewelry),primary(paleCrystal,accentCrystal),accentJewelry,accentCrystal,wood,36+step];
};
// 60% jewelry, 20% crystal, 10% wood and 10% charms before avoiding opening matches.
export const MATERIAL_DROPS = [0,0,0,0,0,0,0,0,1,1,1,2,2,2,2,3,4,4,5,5];
export const materialStock = (save:any,type:number) => Math.max(0,Math.min(save.inventory?.[type]||0,save.gatheredStock?.[type]||0));
export const charmType = (charm:string) => MATERIALS.findIndex(m=>m.id===charm);
export const validBead = (n:any) => Number.isInteger(n)&&n>=0&&n<BEADS.length;
export const validMaterial = (n:any) => Number.isInteger(n)&&n>=0&&n<MATERIALS.length;
export const CRAFT_LIMIT = 20;
// Charms hang from a small loop, so their attachment uses less room on the wire.
export function ringAngle(beads:(number|null)[],index:number) {
  const widths=beads.map(type=>MATERIALS[type]?.id ? .3 : 1);
  const total=widths.reduce((sum,width)=>sum+width,0)||1;
  let distance=0;for(let i=1;i<=index;i++)distance+=(widths[i-1]+widths[i])/2;
  return distance/total*Math.PI*2-Math.PI/2;
}
export function ringBeadScale(beads:(number|null)[],sizes:number[],radius:number,diameter:number,vertical=1) {
  let scale=1;
  for(let i=0;i<beads.length;i++){
    if(beads[i]===null||MATERIALS[beads[i]]?.id)continue;
    for(let j=i+1;j<beads.length;j++){
      if(beads[j]===null||MATERIALS[beads[j]]?.id)continue;
      const a=ringAngle(beads,i),b=ringAngle(beads,j),distance=radius*Math.hypot(Math.cos(a)-Math.cos(b),(Math.sin(a)-Math.sin(b))*vertical);
      scale=Math.min(scale,Math.max(0,distance-radius*.04)/(diameter*(sizes[i]+sizes[j])/16));
    }
  }
  return scale;
}
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
