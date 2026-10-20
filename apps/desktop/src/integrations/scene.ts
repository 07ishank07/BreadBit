import type { CircuitPart, Vec3 } from '../../../../packages/circuit-renderer/src/types';
export const layoutScale = 0.2;
// Apply a delta, rather than re-deriving a footprint: preserves host offsets.
export function moveInLayout(part: CircuitPart, next: Vec3, current: {x:number;y:number}) {
  if (!next.every(Number.isFinite)) throw new Error('Invalid 3D position');
  return {x:current.x+(next[0]-part.position[0])/layoutScale, y:current.y+(next[2]-part.position[2])/layoutScale};
}
export function wireExists(wires: readonly {start:{componentId:string;pinName:string};end:{componentId:string;pinName:string}}[], a:{componentId:string;pinName:string}, b:{componentId:string;pinName:string}) {
  const same=(x:typeof a,y:typeof a)=>x.componentId===y.componentId&&x.pinName===y.pinName;
  return same(a,b)||wires.some(w=>same(w.start,a)&&same(w.end,b)||same(w.start,b)&&same(w.end,a));
}
