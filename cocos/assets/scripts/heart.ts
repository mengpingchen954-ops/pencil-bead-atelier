// First emotional commission: Xiaoman's journey. All choices stay on device.
export const SEA_QUESTIONS = [
  { id:'sunrise', ask:'你最期待什么？', answer:'想一个人去看海边的日出。天亮前有点黑，可我想试试。', follow:'阿禾：那就把天刚亮的颜色，留在你的手腕上。', detail:'她想亲眼看一次海边日出。' },
  { id:'fear', ask:'有什么让你担心的吗？', answer:'怕坐错车，也怕一个人吃饭时显得很孤单。我是不是想太多了？', follow:'阿禾：会害怕也可以出发。走慢一点，想休息就休息。', detail:'第一次独自出门，她需要允许自己慢慢走。' },
  { id:'home', ask:'有什么想带在身边？', answer:'家里人写给我的一张小纸条：走得再远，记得回来吃饭。', follow:'阿禾：那我们也留一句话，让你随时都能想起家。', detail:'家人的小纸条，让她记得有人等她回来。' },
];
export const SEA_BLESSINGS = [
  { id:'scenery', text:'愿你遇见喜欢的风景。', requires:'', response:'小满：我会认真看看这个世界，也替你们带一阵海风回来。' },
  { id:'slow', text:'害怕的时候，也可以慢慢走。', requires:'fear', response:'小满：看到这句，我忽然不急着证明自己勇敢了。慢慢走，我也能到。' },
  { id:'home', text:'走得再远，也有人等你回来。', requires:'home', response:'小满：像家里那张纸条。我会回来，给你们讲路上的事。' },
];
export const SEA_PAPERS = [{id:'cream',name:'奶油信纸',requires:''},{id:'sky',name:'晨空蓝纸',requires:'sunrise'}];
export const SEA_RIBBONS = [{id:'sage',name:'鼠尾草丝带',requires:''},{id:'blue',name:'海风蓝丝带',requires:'sunrise'}];
export function freshSeaHeart() {
  return { facts:[] as string[], gift:{blessing:'scenery',paper:'cream',ribbon:'sage'}, visited:false, travelCharm:'daisy' };
}
const options = { blessing:SEA_BLESSINGS, paper:SEA_PAPERS, ribbon:SEA_RIBBONS };
export function normalizeSeaHeart(raw:any, completed:string[]) {
  const state=freshSeaHeart();
  state.facts=Array.from(new Set<string>((Array.isArray(raw?.facts)?raw.facts:[]).filter((id:string)=>SEA_QUESTIONS.some(q=>q.id===id))));
  for(const field of ['blessing','paper','ribbon']) {
    const choice=(options as any)[field].find((o:any)=>o.id===raw?.gift?.[field]&&(!o.requires||state.facts.includes(o.requires)));
    if(choice)(state.gift as any)[field]=choice.id;
  }
  state.visited=completed.includes('sea')&&completed.includes('rose')&&raw?.visited===true;
  state.travelCharm=state.visited&&raw?.travelCharm==='heart'?'heart':'daisy';
  return state;
}
export function askSea(save:any,id:string) {
  if(!save.completed.includes('daisy')||!SEA_QUESTIONS.some(q=>q.id===id))return null;
  if(save.seaHeart.facts.includes(id))return save;
  return {...save,seaHeart:{...save.seaHeart,facts:[...save.seaHeart.facts,id]}};
}
export function chooseSeaGift(save:any,field:string,id:string) {
  if(!Object.prototype.hasOwnProperty.call(options,field))return null;
  const choice=(options as any)[field].find((o:any)=>o.id===id);
  if(save.completed.includes('sea')||!save.completed.includes('daisy')||!choice||(choice.requires&&!save.seaHeart.facts.includes(choice.requires)))return null;
  return {...save,seaHeart:{...save.seaHeart,gift:{...save.seaHeart.gift,[field]:id}}};
}
export function seaVisitReady(save:any) {
  return save.completed.includes('sea')&&save.completed.includes('rose')&&!save.seaHeart.visited;
}
export function finishSeaVisit(save:any,charm:string) {
  if(!seaVisitReady(save)||!['daisy','heart'].includes(charm))return null;
  return {...save,seaHeart:{...save.seaHeart,visited:true,travelCharm:charm},
    collection:save.collection.map((item:any)=>item.id==='sea'?{...item,travelCharm:charm}:item)};
}
export function seaResponse(save:any) {
  const gift=save.collection.find((item:any)=>item.id==='sea')?.gift || save.seaHeart.gift;
  return (SEA_BLESSINGS.find(b=>b.id===gift.blessing)||SEA_BLESSINGS[0]).response;
}
