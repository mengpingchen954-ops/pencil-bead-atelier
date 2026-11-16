import { BEADS, MATERIALS } from './content.ts';
const groups=[0,1,2,3].map(category=>MATERIALS.flatMap((m,i)=>!m.retired&&m.category===category?[i]:[]));
const legacyTones=['white','red','blue','green','yellow','purple','purple','pink','green','purple','blue','pink','yellow','white','brown','yellow','pink','green','pink','purple','green','brown','brown','pink'];
const tone=(i:number)=>MATERIALS[i].tone||legacyTones[i]||'brown';
const deep=(i:number)=>MATERIALS[i].deep||[1,14,17,20,21,22,25,27,28,29,31,32,34,35].includes(i);
export const isPaleMaterial=(i:number)=>!!MATERIALS[i]?.pale||[0,6,7,8,9,10,15,16,18,19].includes(i);
export function materialUnlockOrder(unlocked:boolean[],order:unknown) {
  const known=Array.isArray(order)?order.filter(i=>Number.isInteger(i)&&i>=0&&i<MATERIALS.length&&unlocked[i]===true):[];
  // Older saves have no unlock history; keep their existing catalog order.
  const legacy=MATERIALS.flatMap((_,i)=>unlocked[i]===true?[i]:[]).sort((a,b)=>MATERIALS[a].category-MATERIALS[b].category||MATERIALS[a].cell-MATERIALS[b].cell);
  return Array.from(new Set([...known,...legacy]));
}
export function categoryMaterials(category:number,contest=false,save?:any) {
  const types=MATERIALS.flatMap((m,i)=>!m.retired&&m.category===category&&(!contest||i<48)?[i]:[]).sort((a,b)=>MATERIALS[a].cell-MATERIALS[b].cell);
  if(!save||contest)return types;
  const order=materialUnlockOrder(save.materialUnlocked||[],save.materialUnlockOrder),rank=new Map(order.map((type,index)=>[type,index]));
  return types.sort((a,b)=>(rank.get(a)??MATERIALS.length)-(rank.get(b)??MATERIALS.length));
}
export const materialPalette = (level:number) => {
  const step=Math.max(1,Math.floor(level))-1,accent=groups[0][step%groups[0].length];
  let crystal=groups[1][step%groups[1].length],wood=groups[2][step%groups[2].length];
  if(deep(accent)){
    if(deep(crystal)){const light=groups[1].filter(i=>!deep(i));crystal=light[step%light.length];}
    if(deep(wood))wood=[24,26,30,33][step%4];
  };
  const used=[tone(accent),tone(crystal)];
  const primary=(category:number)=>{
    const pale=groups[category].filter(i=>isPaleMaterial(i)&&i!==accent&&i!==crystal&&!used.includes(tone(i)));
    const choices=[...pale.filter(i=>i>=48),...pale.filter(i=>i<48)],type=choices[step%choices.length];used.push(tone(type));return type;
  };
  return [primary(0),primary(1),accent,crystal,wood,groups[3][step%groups[3].length]];
};
// 60% jewelry, 20% crystal, 10% wood and 10% charms before avoiding opening matches.
export const MATERIAL_DROPS = [0,0,0,0,0,0,0,0,1,1,1,2,2,2,2,3,4,4,5,5];
export const materialStock = (save:any,type:number) => Math.max(0,Math.min(save.inventory?.[type]||0,save.gatheredStock?.[type]||0));
export const charmType = (charm:string) => MATERIALS.findIndex(m=>m.id===charm);
export const validBead = (n:any) => Number.isInteger(n)&&n>=0&&n<BEADS.length;
export const validMaterial = (n:any) => Number.isInteger(n)&&n>=0&&n<MATERIALS.length;
export const CRAFT_LIMIT = 20;
// Charms hang from a small loop, so their attachment uses less room on the wire.
export function ringAngle(beads:(number|null)[],index:number,sizes?:number[]) {
  if(beads.length===3&&!beads.includes(null)&&beads.filter(type=>!MATERIALS[type]?.id).length===2&&beads.some(type=>MATERIALS[type]?.id&&MATERIALS[type]?.threaded&&MATERIALS[type].bounds[2]-MATERIALS[type].bounds[0]<.6)){
    // Three pieces form a triangle: fit the visible spacer edges between full-size beads.
    const widths=beads.map((type,i)=>(MATERIALS[type]?.threaded?(MATERIALS[type].bounds[2]-MATERIALS[type].bounds[0]):MATERIALS[type]?.id ? .3 : 1)*(sizes?.[i]||8)/8);
    const sides=widths.map((w,i)=>(w+widths[(i+1)%3])/2+4/76),[a,b,c]=sides,s=(a+b+c)/2;
    const radius=a*b*c/(4*Math.sqrt(s*(s-a)*(s-b)*(s-c))),arcs=sides.map(side=>2*Math.asin(Math.min(1,side/(2*radius))));
    const longest=sides.indexOf(Math.max(...sides));if(sides[longest]**2>sides[(longest+1)%3]**2+sides[(longest+2)%3]**2)arcs[longest]=Math.PI*2-arcs[longest];
    return -Math.PI/2+arcs.slice(0,index).reduce((sum,a)=>sum+a,0);
  }
  const widths=beads.map((type,i)=>(MATERIALS[type]?.id ? .3 : 1)*(sizes?.[i]||8)/8);
  const total=widths.reduce((sum,width)=>sum+width,0)||1;
  let distance=0;for(let i=1;i<=index;i++)distance+=(widths[i-1]+widths[i])/2;
  return distance/total*Math.PI*2-Math.PI/2;
}
export function ringRadius(beads:(number|null)[],sizes:number[],diameter=76,minimum=150,vertical=1) {
  let radius=minimum;
  for(let i=0;i<beads.length;i++){
    if(beads[i]===null||MATERIALS[beads[i]]?.id)continue;
    for(let j=i+1;j<beads.length;j++){
      if(beads[j]===null||MATERIALS[beads[j]]?.id)continue;
      const a=ringAngle(beads,i,sizes),b=ringAngle(beads,j,sizes),distance=Math.hypot(Math.cos(a)-Math.cos(b),(Math.sin(a)-Math.sin(b))*vertical);
      if(distance>0)radius=Math.max(radius,(diameter*(sizes[i]+sizes[j])/16+4)/distance);
    }
  }
  return radius;
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
  const material=MATERIALS[type],points=material?.attachment||CHARM_POINTS[material?.id];
  if(material?.threaded)return {anchorX:.5,anchorY:.5,angle:-radialAngle*180/Math.PI-90,offsetX:0,offsetY:0};
  if(!points)return {anchorX:.5,anchorY:.5,angle:0,offsetX:0,offsetY:0};
  const [hx,hy,bx,by]=points,angle=Math.atan2(by-hy,bx-hx)-radialAngle-(facing==='in'?Math.PI:0),dx=.5-hx/192,dy=.5-hy/192;
  return {anchorX:hx/192,anchorY:1-hy/192,angle:angle*180/Math.PI,
    offsetX:Math.cos(angle)*dx+Math.sin(angle)*dy,offsetY:-Math.sin(angle)*dx+Math.cos(angle)*dy};
}
