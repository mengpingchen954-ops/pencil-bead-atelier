'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function(web,root){
 const {load}=require('./generate-editor-layouts.cjs'),{MATERIALS}=load(path.join(root,'assets/scripts/content.ts'));
 const groups={},audio={},manifest={files:{},groups:{},bytes:0};
 const base='assets/resources/native',native=fs.readdirSync(path.join(web,base),{recursive:true}).filter(n=>/\.(png|jpg|wav)$/.test(n)).map(n=>base+'/'+n.replace(/\\/g,'/'));
 function groupFor(key){
  if(/^bead-/.test(key)){const id=Number(key.slice(5));return 'materials-'+(MATERIALS[id]?.category??0);}
  if(/^charm-/.test(key))return 'materials-3';
  if(/icon-|pencil-(ui-|home-page|navigation|resource-|daily|settings|music|paper|frame)/.test(key))return 'common';
  if(/^pencil-(plaster|floor|chair-)|^botanical$/.test(key))return 'decor';
  if(/pencil-(diy|workshop|tray)/.test(key))return 'workshop';
  if(/showcase|orders/.test(key))return 'showcase';
  if(/album|contest|work-preview|collection/.test(key))return 'collection';
  return 'stories';
 }
 for(const folder of ['art','beads','audio'])for(const file of fs.readdirSync(path.join(root,'assets/resources',folder))){
  if(!/\.(png|jpg|wav)$/.test(file)||file==='pencil-cover.jpg')continue;
  const uuid=JSON.parse(fs.readFileSync(path.join(root,'assets/resources',folder,file+'.meta'))).uuid;
  const target=native.find(n=>path.posix.basename(n).startsWith(uuid+'.'));if(!target)throw Error('Native asset missing: '+file);
  const bytes=fs.readFileSync(path.join(web,target));
  if(folder==='audio'){audio[target]='data:audio/wav;base64,'+bytes.toString('base64');continue;}
  const baseGroup=groupFor(path.parse(file).name);let list=groups[baseGroup];
  if(!list)groups[baseGroup]=list=[{files:{},bytes:0}];let group=list.at(-1);
  if(group.bytes>0&&group.bytes+bytes.length>512*1024){group={files:{},bytes:0};list.push(group);}
  group.files[target]={type:file.endsWith('.jpg')?'image/jpeg':'image/png',data:bytes.toString('base64')};group.bytes+=bytes.length;manifest.bytes+=bytes.length;
 }
 fs.mkdirSync(path.join(web,'page-assets'),{recursive:true});
 for(const name of ['common','workshop','materials-0','showcase','decor','collection','materials-1','materials-2','materials-3','stories'])for(const [index,group]of (groups[name]||[]).entries()){
  const key=name+'-'+index,content=JSON.stringify(group.files),file='page-assets/'+key+'.'+crypto.createHash('md5').update(content).digest('hex').slice(0,8)+'.json';
  fs.writeFileSync(path.join(web,file),content);manifest.groups[key]=file;
  for(const asset of Object.keys(group.files))manifest.files[asset]=key;
 }
 const retained=new Set(Object.values(manifest.groups).map(file=>path.basename(file)));
 for(const file of fs.readdirSync(path.join(web,'page-assets')))if(/^[a-z0-9-]+\.[a-f0-9]{8}\.json$/.test(file)&&!retained.has(file))fs.unlinkSync(path.join(web,'page-assets',file));
 return {manifest,audio};
};
