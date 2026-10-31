// Original geometry identifies a template even after its editor transform changes.
export function layoutKey(parent: string, x: number, y: number, w: number, h: number, counts: Map<string, number>) {
  const base = `${parent}/${[x,y,w,h].map(n => Math.round(n * 1000) / 1000).join(',')}`;
  const occurrence = counts.get(base) || 0;
  counts.set(base, occurrence + 1);
  return base + ':' + occurrence;
}
