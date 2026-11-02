import { ORDERS, STORIES } from './content.ts';
import { SEA_QUESTIONS } from './heart.ts';

// These pages summarize earned story progress; they never grant rewards or edit saves.
export function characterMemories(save:any) {
  const profiles=[
    {id:'grandma',name:'奶奶',portrait:'grandma',unlock:true,base:'奶奶陪阿禾长大，如今也陪着她经营这间手串小店。',orders:['promise'],stages:['家人相伴','一起经营','彼此支撑','安心陪伴']},
    {id:'ahe',name:'阿禾',portrait:'girl',unlock:true,base:'阿禾想靠自己的手艺，把小店和往后的生活一点点做起来。',orders:ORDERS.map(o=>o.id),stages:['从今天开始','留下自己的名字','学着站稳','自己决定明天']},
    {id:'xiaoman',name:'小满',portrait:'',unlock:save.completed.includes('daisy'),base:'花店小满来到小店，想把天刚亮时的海戴在手上。',orders:['sea','violet'],stages:['初次来店','听见心意','渐渐熟悉','带着故事回来']},
    {id:'lin',name:'林阿姨',portrait:'',unlock:save.completed.includes('daisy'),base:'林阿姨把雏菊手串送给妈妈，也认真珍惜着阿禾的手作。',orders:['daisy','forest'],stages:['第一份委托','记住她的心意','老客的信任','日常里的陪伴']},
    {id:'teacher',name:'许老师',portrait:'',unlock:save.completed.includes('sea'),base:'许老师想为一位安静的学生，定制一条带着鼓励的手串。',orders:['rose'],stages:['初次来店','认真听见','彼此信任','温柔也有力量']},
  ];
  return profiles.map(person=>{
    const scenes=STORIES.filter(s=>save.seenStories.includes(s.id)&&s.lines.some(line=>line[0]===person.name));
    const known=person.unlock?[{title:'初识',text:person.base,storyId:''},...scenes.map(s=>({title:s.title,text:s.lines.find(line=>line[0]===person.name)![1],storyId:s.id}))]:[];
    if(person.id==='xiaoman'&&person.unlock){
      for(const id of save.seaHeart.facts){const q=SEA_QUESTIONS.find(q=>q.id===id);if(q)known.push({title:'出发前的聊天',text:q.detail,storyId:''});}
      if(save.seaHeart.visited)known.push({title:'小满的旅行回访',text:'小满第一次独自看了海边日出，带回留影和旅行纪念挂件。',storyId:''});
    }
    const orders=person.unlock?ORDERS.filter(o=>person.orders.includes(o.id)&&(save.completed.includes(o.id)||o.id===save.orderId)).map(o=>({...o,work:save.collection.find((w:any)=>w.id===o.id)||null})):[];
    const steps=person.unlock?Math.min(person.id==='xiaoman'&&!save.seaHeart.visited?3:4,known.length+orders.filter(o=>o.work).length):0;
    return {...person,known,orders,steps,stage:person.stages[Math.max(0,steps-1)]};
  });
}
