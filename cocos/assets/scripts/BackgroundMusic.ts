import { AudioSource, AudioClip, resources } from 'cc';
import { normalizeMusic, MUSIC_TRACKS } from './music-settings';

export class BackgroundMusic {
  private settings=normalizeMusic(null);
  private track='';
  private generation=0;
  private hidden=false;
  private disposed=false;
  private loading=false;
  private failed=false;

  constructor(private source:AudioSource,
    private load=(path:string,done:(error:Error|null,clip?:AudioClip)=>void)=>resources.load(path,AudioClip,done),
    private onError=()=>{},private onTrack=(track:string)=>{}) {
    source.playOnAwake=false;source.loop=false;
    source.node?.on('ended',this.advance,this);
  }
  private advance(source?:AudioSource) {
    if(source&&source!==this.source)return;
    if(this.disposed||this.hidden||!this.settings.enabled)return;
    const index=MUSIC_TRACKS.findIndex(track=>track.id===this.track),track=MUSIC_TRACKS[(index+1)%MUSIC_TRACKS.length].id;
    this.update({...this.settings,track});this.onTrack(track);
  }
  update(settings:any) {
    if(this.disposed)return;
    this.settings=normalizeMusic(settings);
    this.source.volume=this.settings.volume;
    if(this.track!==this.settings.track){
      this.track=this.settings.track;this.failed=false;this.loading=false;
      const generation=++this.generation;
      this.releaseClip();
      if(this.settings.enabled){
        this.loading=true;
        this.load('music/'+this.track,(error,clip)=>{
          if(this.disposed||generation!==this.generation){clip?.addRef?.();clip?.decRef?.();return;}
          this.loading=false;
          if(error||!clip){this.failed=true;this.onError();return;}
          clip.addRef?.();this.source.clip=clip;this.sync();
        });
      }
    }else if(this.settings.enabled&&!this.source.clip&&!this.loading&&!this.failed){
      this.track='';this.update(this.settings);return;
    }
    this.sync();
  }
  private releaseClip() { const clip=this.source.clip;this.source.stop();this.source.clip=null;clip?.decRef?.(); }
  private sync() {
    if(this.hidden||!this.settings.enabled||this.settings.volume===0){this.source.pause();return;}
    if(this.source.clip&&!this.source.playing)this.source.play();
  }
  setHidden(hidden:boolean) { if(this.disposed)return;this.hidden=hidden;this.sync(); }
  snapshot() { return {track:this.track,loading:this.loading,failed:this.failed,playing:this.source.playing,volume:this.source.volume}; }
  dispose() { this.disposed=true;this.generation++;this.source.node?.off('ended',this.advance,this);this.releaseClip(); }
}
