'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
module.exports=function(web,root){
 const manifest=JSON.parse(execFileSync(process.env.ATELIER_PYTHON||'python',[path.join(__dirname,'optimize-web-images.py'),web],{encoding:'utf8',maxBuffer:4*1024*1024}));
 const audio={},images={},base='assets/resources/native';
 const {load}=require('./generate-editor-layouts.cjs');
 const {materialPalette}=load(path.join(root,'assets/scripts/materials.ts')),{MATERIALS}=load(path.join(root,'assets/scripts/content.ts'));
 const native=fs.readdirSync(path.join(web,base),{recursive:true}).map(file=>base+'/'+file.replace(/\\/g,'/'));
 for(const type of materialPalette(1)){
  const material=MATERIALS[type],folder=material.id?'art':'beads',key=material.id?'charm-'+material.id:'bead-'+type;
  const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/resources',folder,key+'.png.meta')));
  const target=native.find(file=>path.basename(file).startsWith(meta.uuid+'.')&&file.endsWith('.png'));
  if(!target)throw Error('First-level image missing: '+key);
  const file=manifest.files[target]||target,mime=file.endsWith('.webp')?'image/webp':'image/png';
  images[target]='data:'+mime+';base64,'+fs.readFileSync(path.join(web,file)).toString('base64');
 }

 for(const file of fs.readdirSync(path.join(web,base),{recursive:true}).filter(n=>n.endsWith('.wav'))){
  const target=base+'/'+file.replace(/\\/g,'/');
  audio[target]='data:audio/wav;base64,'+fs.readFileSync(path.join(web,target)).toString('base64');
 }
 return {manifest,audio,images};
};
