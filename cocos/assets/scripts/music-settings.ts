export const MUSIC_TRACKS = [
  { id:'glimmer', name:'宁静的微光' },
  { id:'calm', name:'宁静治愈' },
  { id:'piano', name:'治愈钢琴' },
  { id:'girl', name:'治愈少女' },
  { id:'time', name:'治愈时光' },
  { id:'healing', name:'治愈系少女' },
];
export function normalizeMusic(raw:any) {
  return {
    track:MUSIC_TRACKS.some(t=>t.id===raw?.track)?raw.track:MUSIC_TRACKS[0].id,
    volume:Number.isFinite(raw?.volume)?Math.round(Math.max(0,Math.min(1,raw.volume))*100)/100:.35,
    enabled:raw?.enabled!==false,
  };
}
