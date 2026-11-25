'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),web=path.join(root,'build/web-mobile');
function find(dir,prefix,suffix){return fs.readdirSync(path.join(web,dir)).find(n=>n.startsWith(prefix)&&n.endsWith(suffix));}
function rehash(dir,name,content){const renamed=name.replace(/\.[a-f0-9]{5}\./,'.'+crypto.createHash('md5').update(content).digest('hex').slice(0,5)+'.');fs.writeFileSync(path.join(web,dir,renamed),content);if(name!==renamed)fs.unlinkSync(path.join(web,dir,name));return renamed;}
const settingsName=find('src','settings.','.json'),settings=JSON.parse(fs.readFileSync(path.join(web,'src',settingsName)));
settings.splashScreen={...settings.splashScreen,totalTime:0,logo:{type:'none'},background:{type:'color',color:{x:.91,y:.87,z:.79,w:1}}};
const renamedSettings=rehash('src',settingsName,JSON.stringify(settings));
const appName=find('','application.','.js'),app=fs.readFileSync(path.join(web,appName),'utf8').replace(settingsName,renamedSettings).replace("'src/"+renamedSettings+"'",JSON.stringify('data:application/json;base64,'+Buffer.from(JSON.stringify(settings)).toString('base64'))),renamedApp=rehash('',appName,app);
const indexName=find('','index.','.js'),index=fs.readFileSync(path.join(web,indexName),'utf8').replace(appName,renamedApp),renamedIndex=rehash('',indexName,index);
const runtime=fs.readFileSync(path.join(__dirname,'performance-browser.js'),'utf8'),runtimeName='performance.'+crypto.createHash('md5').update(runtime).digest('hex').slice(0,8)+'.js';fs.writeFileSync(path.join(web,runtimeName),runtime);
let html=fs.readFileSync(path.join(web,'index.html'),'utf8').replace(indexName,renamedIndex).replace(/<title>.*?<\/title>/,'<title>珠光小店 · 铅笔珠工坊</title>');
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><link rel="icon" href="data:,">');
const preloads=[];
for(const file of fs.readdirSync(path.join(web,'cocos-js')).filter(n=>n.endsWith('.js')))preloads.push('<link rel="preload" as="script" href="cocos-js/'+file+'">');
for(const file of [renamedApp,renamedIndex])preloads.push('<link rel="preload" as="script" href="'+file+'">');
for(const dir of ['resources','main','internal'])for(const file of fs.readdirSync(path.join(web,'assets',dir)).filter(n=>/^config\..*\.json$/.test(n)))preloads.push('<link rel="preload" as="fetch" href="assets/'+dir+'/'+file+'" crossorigin>');
function preloadFetch(file){preloads.push('<link rel="preload" as="fetch" href="'+file+'" crossorigin>');}
preloadFetch('src/'+renamedSettings);
for(const file of fs.readdirSync(path.join(web,'src/chunks')).filter(n=>n.endsWith('.js')))preloads.push('<link rel="preload" as="script" href="src/chunks/'+file+'">');
function filesBelow(dir){return fs.readdirSync(path.join(web,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesBelow(dir+'/'+e.name):[dir+'/'+e.name]);}
for(const bundle of ['internal','main','resources']){
 const dir='assets/'+bundle;
 for(const file of fs.readdirSync(path.join(web,dir)).filter(n=>/^index\..*\.js$/.test(n)))preloads.push('<link rel="preload" as="script" href="'+dir+'/'+file+'">');
 if(bundle!=='resources')for(const file of filesBelow(dir+'/import').filter(n=>n.endsWith('.json')))preloadFetch(file);
}
const resourceDir='assets/resources',config=JSON.parse(fs.readFileSync(path.join(web,resourceDir,find(resourceDir,'config.','.json')))),imports=filesBelow(resourceDir+'/import'),native=filesBelow(resourceDir+'/native');
function artPreloads(keys){const files=new Set();
 for(const key of keys){
  const candidates=fs.readdirSync(path.join(root,'assets/resources/art')).filter(n=>n===key+'.jpg.meta'||n===key+'.png.meta');if(!candidates.length)continue;
  const uuid=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/art',candidates[0]))).uuid;
  const ids=Object.entries(config.paths).filter(([id,value])=>value[0]==='art/'+key||value[0].startsWith('art/'+key+'/')).map(([id])=>Number(id));
  imports.filter(n=>path.basename(n).startsWith(uuid)).forEach(n=>files.add(n));
  for(const [pack,idsInPack] of Object.entries(config.packs||{}))if(ids.some(id=>idsInPack.includes(id)))imports.filter(n=>path.basename(n).startsWith(pack+'.')).forEach(n=>files.add(n));
  native.filter(n=>path.basename(n).startsWith(uuid+'.')).forEach(n=>files.add(n));
 }return [...files];}
const artGroups={cover:artPreloads(['pencil-cover']),home:artPreloads(['pencil-home-page','pencil-navigation','pencil-resource-beads','pencil-resource-coins','pencil-resource-energy','icon-home','icon-orders','icon-craft','icon-chair','icon-album'])};
const jsonFiles=['src/'+renamedSettings],scriptFiles=[];
for(const bundle of ['internal','main','resources']){
 const dir='assets/'+bundle;jsonFiles.push(...filesBelow(dir).filter(n=>/\/config\.[^/]+\.json$/.test(n)));
 scriptFiles.push(...fs.readdirSync(path.join(web,dir)).filter(n=>/^index\..*\.js$/.test(n)).map(n=>dir+'/'+n));
 if(bundle==='internal'||bundle==='main')jsonFiles.push(...filesBelow(dir+'/import').filter(n=>n.endsWith('.json')));
}
jsonFiles.push(...imports.filter(n=>n.endsWith('.json')));
const nativePacks=require('./native-packs.cjs')(web,root);
const cache=require('./startup-cache.cjs')(web,jsonFiles,scriptFiles);
for(let i=preloads.length-1;i>=0;i--){if(!preloads[i].includes('cocos-js/'))preloads.splice(i,1);else preloads[i]=preloads[i].replace(/cc\.[a-f0-9]{5}\.js/,cache.engineName);}
preloads.push('<script>'+cache.code+';window.__atelierStartup.nativeManifest='+JSON.stringify(nativePacks.manifest)+';window.__atelierStartup.audio='+JSON.stringify(nativePacks.audio)+';window.__atelierStartup.images='+JSON.stringify(nativePacks.images)+'</script>');
for(const page of Object.keys(artGroups))artGroups[page]=artGroups[page].filter(file=>/\.(jpg|png)$/.test(file)).map(file=>nativePacks.manifest.files[file]||file);
preloads.push('<script>(function(groups){var page="cover";try{var save=JSON.parse(localStorage.getItem("pencil-bead-atelier-v1")||"null");if(save&&save.started)page="home";}catch{}for(var file of groups[page]){var link=document.createElement("link");link.rel="preload";link.href=file;link.as="image";link.crossOrigin="anonymous";document.head.appendChild(link);}})('+JSON.stringify(artGroups)+');</script>');
const mapName=find('src','import-map.','.json');
const inlineMap=JSON.parse(fs.readFileSync(path.join(web,'src',mapName),'utf8'));for(const [key,value]of Object.entries(inlineMap.imports))inlineMap.imports[key]='./'+path.posix.normalize('src/'+value);
html=html.replace(/<script[^>]*src="src\/import-map[^>]*>\s*<\/script>/,'<script type="systemjs-importmap">'+JSON.stringify(inlineMap)+'</script>');
let registrations='';
for(const file of [renamedApp,...fs.readdirSync(path.join(web,'src/chunks')).filter(n=>n.endsWith('.js')).map(n=>'src/chunks/'+n),renamedIndex]){
 const source=fs.readFileSync(path.join(web,file),'utf8');
 if(!source.startsWith('System.register('))throw Error('Unsupported anonymous bootstrap module: '+file);
 registrations+=source.replace('System.register(','System.register(new URL('+JSON.stringify(file)+',document.baseURI).href,')+'\n';
}
html=html.replace("System.import('./"+renamedIndex+"')",()=>registrations+"System.import('./"+renamedIndex+"')");
html=html.replace('</head>',preloads.join('\n')+'\n<style>html,body{background:#e8dfca}#atelier-loading{position:fixed;inset:0;z-index:9999;display:grid;place-content:center;text-align:center;gap:12px;color:#514733;background:#f4efdf;font:18px sans-serif;pointer-events:none}#atelier-loading strong{font-size:28px;color:#7b8b6e}</style>\n</head>');
html=html.replace('<body>','<body><div id="atelier-loading" role="status"><strong>珠光小店</strong><span>正在打开奶奶的珠盒…</span></div><script>'+runtime+'</script>');
fs.writeFileSync(path.join(web,'index.html'),html);
console.log('Fast startup: parallel engine loading, no fixed splash delay, mobile pixel cap and recoverable load failures.');
