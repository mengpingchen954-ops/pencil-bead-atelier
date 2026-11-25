(function(){
 'use strict';
 const state=window.__atelierPerformance={navigationStart:0,bootstrap:performance.now()};
 if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
  const ratio=Math.min(devicePixelRatio||1,((navigator.deviceMemory||4)<=4||(navigator.hardwareConcurrency||4)<=4)?1.25:1.5);
  try{Object.defineProperty(window,'devicePixelRatio',{configurable:true,get:function(){return ratio;}});}catch{}
 }
 let recovery;
 window.atelierLoadFailure=function(){
  if(recovery)return;
  recovery=document.createElement('div');recovery.id='atelier-recovery';recovery.setAttribute('role','status');
  recovery.style.cssText='position:fixed;z-index:99999;left:5%;right:5%;top:12px;padding:16px;background:#fff8e9;color:#514733;border:1px solid #ae9975;border-radius:12px;text-align:center;font:16px sans-serif';
  const message=document.createElement('span');message.textContent='加载暂时中断。进度会保留，检查网络后可重新打开。';
  const button=document.createElement('button');button.type='button';button.textContent='重新打开';button.style.cssText='margin-left:12px;padding:8px 14px';button.onclick=function(){location.reload();};
  recovery.append(message,button);document.body.append(recovery);
 };
 document.addEventListener('webglcontextlost',function(event){event.preventDefault();state.contextLosses=(state.contextLosses||0)+1;window.atelierLoadFailure();},true);
 window.addEventListener('error',function(event){if(event.message)window.atelierLoadFailure();});
 window.addEventListener('unhandledrejection',function(){window.atelierLoadFailure();});
 const timer=setTimeout(function(){
  if(state.sceneFrame)return;
  const label=document.querySelector('#atelier-loading span');
  if(label)label.textContent='网络较慢，正在继续加载，请稍候…';
 },15000);
 window.atelierLoadReady=function(){clearTimeout(timer);document.getElementById('atelier-loading')?.remove();};
 window.addEventListener('pagehide',function(){clearTimeout(timer);},{once:true});
})();
