import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire}from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(path.resolve(import.meta.dirname,'../assets/scripts/AssetPacks.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(fail=false){
 const blobs=new Map(),requests=[],fallback=[],handlers={};let serial=0;
 class LocalURL extends URL {static createObjectURL(blob){const id='blob:fixture-'+serial++;blobs.set(id,blob);return id;}static revokeObjectURL(id){blobs.delete(id);}}
 const image=(url,options,done)=>{const blob=blobs.get(url);if(!blob)fallback.push(url);done(null,blob||url);};
 const audio=(url,options,done)=>done(null,url);const downloader={_downloaders:{'.png':image,'.jpg':image,'.jpeg':image,'.wav':audio},register:(key,fn)=>handlers[key]=fn};
 const context={require:()=>({assetManager:{downloader}}),exports:{},URL:LocalURL,Blob,atob,document:{baseURI:'https://example.test/pencil-bead-atelier/'},console,
  __atelierStartup:{nativeManifest:{files:{'a.png':'one','b.png':'one'},groups:{one:'page-assets/one.json'},bytes:6},audio:{'tap.wav':'data:audio/wav;base64,AQID'}},
  fetch:async url=>{requests.push(url);if(fail)throw Error('offline');return {ok:true,json:async()=>({'a.png':{type:'image/png',data:'AQID'},'b.png':{type:'image/png',data:'BAUG'}})};},
 };
 vm.runInNewContext(source,context);context.exports.installAssetPacks();
 const download=(extension,url)=>new Promise((resolve,reject)=>handlers[extension](url,{},(error,value)=>error?reject(error):resolve(value)));
 return {context,requests,fallback,blobs,download};
}
test('page images share one pack, preserve bytes and release temporary object URLs',async()=>{
 const f=fixture(),images=await Promise.all([f.download('.png','a.png'),f.download('.png','b.png')]);
 assert.equal(f.requests.length,1);assert.deepEqual(Array.from(new Uint8Array(await images[0].arrayBuffer())),[1,2,3]);assert.equal(f.blobs.size,0);
 await f.context.__atelierPacks.warm();await f.download('.png','a.png');assert.equal(f.requests.length,1);assert.equal(f.context.__atelierPacks.snapshot().bytes,6);
 assert.equal(await f.download('.wav','tap.wav'),'data:audio/wav;base64,AQID');assert.equal(await f.download('.wav','music.wav'),'music.wav');
});
test('a failed optional pack preserves the original image downloader',async()=>{
 const f=fixture(true);assert.equal(await f.download('.png','a.png'),'a.png');assert.deepEqual(f.fallback,['a.png']);
});
