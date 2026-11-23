'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),web=path.join(root,'build/web-mobile');
function find(dir,prefix,suffix){return fs.readdirSync(path.join(web,dir)).find(n=>n.startsWith(prefix)&&n.endsWith(suffix));}
function rehash(dir,name,content){const renamed=name.replace(/\.[a-f0-9]{5}\./,'.'+crypto.createHash('md5').update(content).digest('hex').slice(0,5)+'.');fs.writeFileSync(path.join(web,dir,renamed),content);if(name!==renamed)fs.unlinkSync(path.join(web,dir,name));return renamed;}
const settingsName=find('src','settings.','.json'),settings=JSON.parse(fs.readFileSync(path.join(web,'src',settingsName)));
settings.splashScreen={...settings.splashScreen,totalTime:0,logo:{type:'none'},background:{type:'color',color:{x:.91,y:.87,z:.79,w:1}}};
const renamedSettings=rehash('src',settingsName,JSON.stringify(settings));
const appName=find('','application.','.js'),app=fs.readFileSync(path.join(web,appName),'utf8').replace(settingsName,renamedSettings),renamedApp=rehash('',appName,app);
const indexName=find('','index.','.js'),index=fs.readFileSync(path.join(web,indexName),'utf8').replace(appName,renamedApp),renamedIndex=rehash('',indexName,index);
const runtime=fs.readFileSync(path.join(__dirname,'performance-browser.js'),'utf8'),runtimeName='performance.'+crypto.createHash('md5').update(runtime).digest('hex').slice(0,8)+'.js';fs.writeFileSync(path.join(web,runtimeName),runtime);
let html=fs.readFileSync(path.join(web,'index.html'),'utf8').replace(indexName,renamedIndex).replace(/<title>.*?<\/title>/,'<title>珠光小店 · 铅笔珠工坊</title>');
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><link rel="icon" href="data:,">');
const preloads=[];
for(const file of fs.readdirSync(path.join(web,'cocos-js')).filter(n=>n.endsWith('.js')))preloads.push('<link rel="preload" as="script" href="cocos-js/'+file+'">');
for(const file of [renamedApp,renamedIndex])preloads.push('<link rel="preload" as="script" href="'+file+'">');
for(const dir of ['resources','main','internal'])for(const file of fs.readdirSync(path.join(web,'assets',dir)).filter(n=>/^config\..*\.json$/.test(n)))preloads.push('<link rel="preload" as="fetch" href="assets/'+dir+'/'+file+'" crossorigin>');
const cover=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/art/pencil-cover.jpg.meta'))).uuid;
const coverDir='assets/resources/native/'+cover.slice(0,2),coverFile=fs.readdirSync(path.join(web,coverDir)).find(n=>n.startsWith(cover)&&n.endsWith('.jpg'));
if(coverFile)preloads.push('<link rel="preload" as="image" href="'+coverDir+'/'+coverFile+'" fetchpriority="high" crossorigin="anonymous">');
html=html.replace('</head>',preloads.join('\n')+'\n<style>html,body{background:#e8dfca}#atelier-loading{position:fixed;inset:0;z-index:9999;display:grid;place-content:center;text-align:center;gap:12px;color:#514733;background:#f4efdf;font:18px sans-serif;pointer-events:none}#atelier-loading strong{font-size:28px;color:#7b8b6e}</style>\n</head>');
html=html.replace('<body>','<body><div id="atelier-loading" role="status"><strong>珠光小店</strong><span>正在打开奶奶的珠盒…</span></div><script src="'+runtimeName+'"></script>');
fs.writeFileSync(path.join(web,'index.html'),html);
console.log('Fast startup: parallel engine loading, no fixed splash delay, mobile pixel cap and recoverable load failures.');
