import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('slow startup keeps loading, successful startup clears its timer, real failures retain recovery',()=>{
 const listeners={},nodes=new Map(),label={textContent:''};let timeout,cleared=false;
 const node=()=>({style:{},setAttribute(){},append(){},remove(){nodes.delete('atelier-loading');}});
 nodes.set('atelier-loading',node());
 const context={window:{devicePixelRatio:3,addEventListener:(name,fn)=>listeners[name]=fn},document:{addEventListener:(name,fn)=>listeners[name]=fn,querySelector:()=>label,getElementById:id=>nodes.get(id),createElement:()=>node(),body:{append:n=>nodes.set(n.id,n)}},navigator:{userAgent:'Android',deviceMemory:2,hardwareConcurrency:4},devicePixelRatio:3,performance:{now:()=>0},setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:()=>cleared=true,location:{reload(){}}};
 vm.runInNewContext(fs.readFileSync(new URL('../tools/performance-browser.js',import.meta.url),'utf8'),context);
 assert.equal(context.window.devicePixelRatio,3,'startup preserves native pixel density, including low-memory phones');
 timeout();assert.match(label.textContent,/继续加载/);assert.equal(nodes.has('atelier-recovery'),false);
 context.window.atelierLoadReady();assert.equal(cleared,true);assert.equal(nodes.has('atelier-loading'),false);
 listeners.webglcontextlost({preventDefault(){}});assert.equal(nodes.has('atelier-recovery'),true);
 context.window.atelierLoadReady();assert.equal(nodes.has('atelier-recovery'),true);
});
