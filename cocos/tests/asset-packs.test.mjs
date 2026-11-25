import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire}from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(path.resolve(import.meta.dirname,'../assets/scripts/AssetPacks.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(fail=false){
 const requests=[],handlers={};
 const image=(url,options,done)=>{requests.push(url);done(fail&&url.endsWith('.webp')?Error('unavailable'):null,url);};
 const audio=(url,options,done)=>done(null,url);const downloader={_downloaders:{'.png':image,'.jpg':image,'.jpeg':image,'.wav':audio},register:(key,fn)=>handlers[key]=fn};
 const context={require:()=>({assetManager:{downloader}}),exports:{},URL,document:{baseURI:'https://example.test/pencil-bead-atelier/'},
  __atelierStartup:{nativeManifest:{files:{'a.png':'page-assets/a.webp','b.png':'page-assets/b.webp'},bytes:6,originalBytes:30},audio:{'tap.wav':'data:audio/wav;base64,AQID'}},
 };
 vm.runInNewContext(source,context);context.exports.installAssetPacks();
 const download=(extension,url)=>new Promise((resolve,reject)=>handlers[extension](url,{},(error,value)=>error?reject(error):resolve(value)));
 return {context,requests,download};
}
test('only requested images download, using compressed files under the repository subpath',async()=>{
 const f=fixture();assert.equal(f.requests.length,0);
 assert.equal(await f.download('.png','a.png'),'https://example.test/pencil-bead-atelier/page-assets/a.webp');
 assert.equal(f.requests.length,1);assert.equal(f.context.__atelierPacks.snapshot().images,1);
 assert.equal(await f.download('.jpg','unmapped.jpg'),'unmapped.jpg');
 assert.equal(await f.download('.wav','tap.wav'),'data:audio/wav;base64,AQID');
 assert.equal(await f.download('.wav','music.wav'),'music.wav');
 f.context.exports.installAssetPacks();assert.equal(f.requests.length,2,'installation stays idempotent');
});
test('failed compressed images fall back to their original image',async()=>{
 const f=fixture(true);assert.equal(await f.download('.png','a.png'),'a.png');
 assert.deepEqual(f.requests,['https://example.test/pencil-bead-atelier/page-assets/a.webp','a.png']);
});
