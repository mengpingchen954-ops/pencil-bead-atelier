import { assetManager } from 'cc';

// Keep compressed bytes ready between pages; decode and upload only visible images.
export function installAssetPacks() {
  const host=globalThis as any,startup=host.__atelierStartup;
  if(!startup?.nativeManifest||host.__atelierPacks)return;
  const manifest=startup.nativeManifest,blobs=new Map<string,Blob>(),pending=new Map<string,Promise<void>>();
  const absolute=(url:string)=>new URL(url,document.baseURI).href;
  const files=new Map(Object.entries(manifest.files).map(([url,group])=>[absolute(url),group as string]));
  const audio=new Map(Object.entries(startup.audio||{}).map(([url,value])=>[absolute(url),value as string]));
  let bytes=0;
  const load=(group:string)=>{
    let request=pending.get(group);if(request)return request;
    request=fetch(manifest.groups[group],{cache:'force-cache'}).then(response=>{if(!response.ok)throw Error('Asset pack '+response.status);return response.json();}).then(data=>{
      for(const [url,entry]of Object.entries(data) as [string,{type:string;data:string}][]){
        const text=atob(entry.data),buffer=new Uint8Array(text.length);for(let i=0;i<text.length;i++)buffer[i]=text.charCodeAt(i);
        blobs.set(absolute(url),new Blob([buffer],{type:entry.type}));bytes+=buffer.length;delete data[url];
      }
    }).catch(error=>{pending.delete(group);throw error;});
    pending.set(group,request);return request;
  };
  const downloader=assetManager.downloader as any;
  for(const extension of ['.png','.jpg','.jpeg']){
    const original=downloader._downloaders[extension];
    downloader.register(extension,(url:string,options:any,done:any)=>{
      const key=absolute(url),group=files.get(key);
      if(!group){original(url,options,done);return;}
      load(group).then(()=>{
        const blob=blobs.get(key);if(!blob){original(url,options,done);return;}
        const objectURL=URL.createObjectURL(blob);
        original(objectURL,options,(error:Error|null,image:any)=>{URL.revokeObjectURL(objectURL);done(error,image);});
      },()=>original(url,options,done));
    });
  }
  const originalAudio=downloader._downloaders['.wav'];
  downloader.register('.wav',(url:string,options:any,done:any)=>originalAudio(audio.get(absolute(url))||url,options,done));
  host.__atelierPacks={
    warm:async()=>{for(const group of Object.keys(manifest.groups)){try{await load(group);}catch(error){console.warn('Optional background asset preparation failed',error);}}},
    snapshot:()=>({groups:pending.size,images:blobs.size,bytes,maxBytes:manifest.bytes}),
  };
}
