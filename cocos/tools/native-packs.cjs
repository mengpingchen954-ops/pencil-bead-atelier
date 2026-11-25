'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
module.exports=function(web,root){
 const manifest=JSON.parse(execFileSync(process.env.ATELIER_PYTHON||'python',[path.join(__dirname,'optimize-web-images.py'),web],{encoding:'utf8',maxBuffer:4*1024*1024}));
 const audio={},base='assets/resources/native';
 for(const file of fs.readdirSync(path.join(web,base),{recursive:true}).filter(n=>n.endsWith('.wav'))){
  const target=base+'/'+file.replace(/\\/g,'/');
  audio[target]='data:audio/wav;base64,'+fs.readFileSync(path.join(web,target)).toString('base64');
 }
 return {manifest,audio};
};
