import { assetManager } from 'cc';

// Download only visible images; the browser caches each compressed file independently.
export function installAssetPacks() {
  const host=globalThis as any,startup=host.__atelierStartup;
  if(!startup?.nativeManifest||host.__atelierPacks)return;
  const manifest=startup.nativeManifest,loaded=new Set<string>();
  const absolute=(url:string)=>new URL(url,document.baseURI).href;
  const files=new Map(Object.entries(manifest.files).map(([url,file])=>[absolute(url),absolute(file as string)]));
  const audio=new Map(Object.entries(startup.audio||{}).map(([url,value])=>[absolute(url),value as string]));
  const embedded=new Map(Object.entries(startup.images||{}).map(([url,value])=>[absolute(url),value as string]));
  const downloader=assetManager.downloader as any;
  for(const extension of ['.png','.jpg','.jpeg']){
    const original=downloader._downloaders[extension];
    downloader.register(extension,(url:string,options:any,done:any)=>{
      const optimized=embedded.get(absolute(url))||files.get(absolute(url));
      if(!optimized){original(url,options,done);return;}
      let finished=false;
      const timer=setTimeout(()=>{if(finished)return;finished=true;original(url,options,done);},8000);
      original(optimized,options,(error:Error|null,image:any)=>{
        if(finished)return;finished=true;clearTimeout(timer);
        if(error){original(url,options,done);return;}
        loaded.add(optimized);done(null,image);
      });
    });
  }
  const originalAudio=downloader._downloaders['.wav'];
  downloader.register('.wav',(url:string,options:any,done:any)=>originalAudio(audio.get(absolute(url))||url,options,done));
  host.__atelierPacks={snapshot:()=>({images:loaded.size,maxBytes:manifest.bytes,originalBytes:manifest.originalBytes})};
}
