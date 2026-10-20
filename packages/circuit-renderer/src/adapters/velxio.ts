import { builtinComponents } from '../catalogue';
import { validateCircuit } from '../math';
import type { CircuitDocument, CircuitPart, ComponentRegistry, PinRef, Vec3 } from '../types';

/** Structural contract only. No import from the host store, emulator or Wokwi DOM elements. */
export interface VelxioSceneInput {
  boards?: readonly { id:string; boardKind:string; x:number; y:number; rotation?:number }[];
  components: readonly { id:string; metadataId?:string; type?:string; x:number; y:number; rotation?:number; properties?:Record<string,unknown> }[];
  wires: readonly {
    id:string; start:{componentId:string;pinName:string}; end:{componentId:string;pinName:string};
    color?:string; bb?:boolean;
  }[];
}
export interface VelxioAdapterOptions {
  /** Velxio layout pixels to renderer millimetres. Override to match the host's metadata scale. */
  mmPerPixel?:number;
  kindMap?:Readonly<Record<string,string>>;
  /** Authoritative 3D poses persisted alongside the host's original circuit. */
  poses?:Readonly<Record<string,{position:Vec3;rotation?:number}>>;
  registry?:ComponentRegistry;
  mapPin?:(pin:PinRef)=>PinRef;
}
const defaultKinds:Record<string,string>={
  uno:'arduino-uno','arduino-uno':'arduino-uno','breadboard-half':'breadboard',breadboard:'breadboard',
  led:'led',resistor:'resistor',pushbutton:'pushbutton','pushbutton-6mm':'pushbutton',
  potentiometer:'potentiometer',servo:'servo',ssd1306:'oled','ssd1306-i2c':'oled',
};
export function adaptVelxioScene(input:VelxioSceneInput,options:VelxioAdapterOptions={}):{circuit:CircuitDocument;warnings:string[]} {
  const scale=options.mmPerPixel ?? 0.2;
  if(!Number.isFinite(scale)||scale<=0)throw new Error('mmPerPixel must be positive and finite');
  const registry={...builtinComponents,...options.registry};
  const kinds={...defaultKinds,...options.kindMap};
  const makePart=(id:string,kind:string,x:number,y:number,rotation=0,properties?:Record<string,unknown>):CircuitPart=>{
    const normalized=kind.replace(/^(wokwi|velxio)-/,'');
    const resolved=kinds[kind] ?? kinds[normalized] ?? normalized;
    const size=registry[resolved]?.size ?? [12,8,12];
    const pose=options.poses?.[id];
    return {id,kind:resolved,position:pose?.position ?? [x*scale+size[0]/2,0,y*scale+size[2]/2],rotation:pose?.rotation ?? -rotation*Math.PI/180,properties};
  };
  const parts=(input.boards ?? []).map(b=>makePart(b.id,b.boardKind,b.x,b.y,b.rotation));
  const boardIds=new Set(parts.map(p=>p.id));
  for(const c of input.components)if(!boardIds.has(c.id))parts.push(makePart(c.id,c.metadataId ?? c.type ?? 'unknown',c.x,c.y,c.rotation,c.properties));
  const map=options.mapPin ?? ((pin:PinRef)=>pin);
  // Seating wires remain in host topology. They do not represent visible jumper cables.
  const wires=input.wires.filter(w=>!w.bb).map(w=>({id:w.id,from:map({partId:w.start.componentId,pinId:w.start.pinName}),to:map({partId:w.end.componentId,pinId:w.end.pinName}),color:w.color}));
  const circuit={parts,wires};
  return {circuit,warnings:validateCircuit(circuit,registry)};
}
