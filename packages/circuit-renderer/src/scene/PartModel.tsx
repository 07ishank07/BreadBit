import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh, Matrix4 } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { CircuitPart, ComponentDefinition, PartVisualState, PinRef, ViewportTheme } from '../types';
import { SurfaceText } from '../models/primitives';
import { UnknownModel } from '../models/parts';

export function PartModel({ part, definition, state, selected, labels, wireMode, theme, onPin, onPinHover, onDown, onMove, onUp, onCancel }: {
  part: CircuitPart; definition?: ComponentDefinition; state: PartVisualState; selected: boolean; labels: boolean; wireMode: boolean; theme: ViewportTheme;
  onPin: (ref: PinRef) => void; onPinHover: (ref: PinRef | null) => void;
  onDown: (e: ThreeEvent<PointerEvent>, part: CircuitPart) => void;
  onMove: (e: ThreeEvent<PointerEvent>) => void;
  onUp: (e: ThreeEvent<PointerEvent>) => void;
  onCancel: () => void;
}) {
  const Model=definition?.Model ?? UnknownModel;
  const size=definition?.size ?? [12,8,12];
  return <group position={[...part.position]} rotation={[0,part.rotation ?? 0,0]}
    onPointerDown={e=>onDown(e,part)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onLostPointerCapture={onCancel}>
    <Model part={part} state={state} selected={selected}/>
    {selected && <group position={[0,0.15,0]}>
      {[-1,1].flatMap(x=>[-1,1].map(z=><group key={`${x}:${z}`} position={[x*(size[0]/2+2),0,z*(size[2]/2+2)]}>
        <mesh position={[-x*2,0,0]}><boxGeometry args={[4,0.16,0.3]}/><meshBasicMaterial color={state.fault ? '#f78872' : theme.accent}/></mesh>
        <mesh position={[0,0,-z*2]}><boxGeometry args={[0.3,0.16,4]}/><meshBasicMaterial color={state.fault ? '#f78872' : theme.accent}/></mesh>
      </group>))}
    </group>}
    {labels && <SurfaceText text={part.label ?? definition?.label ?? part.kind} at={[0,0.12,size[2]/2+6]} width={Math.max(16,Math.min(45,size[0]+8))} height={2.6} color={selected ? theme.accent : theme.foreground} weight={500}/>}
    {wireMode && definition && <PinTargets part={part} definition={definition} accent={theme.accent} onPin={onPin} onHover={onPinHover}/>}
  </group>;
}

function PinTargets({ part, definition, accent, onPin, onHover }: {
  part:CircuitPart; definition:ComponentDefinition; accent:string; onPin:(ref:PinRef)=>void; onHover:(ref:PinRef|null)=>void;
}) {
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    if(!ref.current) return;
    const m=new Matrix4();
    definition.pins.forEach((pin,i)=>ref.current!.setMatrixAt(i,m.makeTranslation(pin.position[0],pin.position[1]+0.25,pin.position[2])));
    ref.current.instanceMatrix.needsUpdate=true; ref.current.computeBoundingSphere();
  },[definition]);
  const getPin=(i:number|undefined)=> i === undefined ? undefined : definition.pins[i];
  return <instancedMesh ref={ref} args={[undefined,undefined,definition.pins.length]}
    onPointerDown={e=>e.stopPropagation()}
    onPointerMove={e=>{e.stopPropagation();const p=getPin(e.instanceId);if(p)onHover({partId:part.id,pinId:p.id});}}
    onPointerOut={()=>onHover(null)}
    onClick={e=>{e.stopPropagation();const p=getPin(e.instanceId);if(p)onPin({partId:part.id,pinId:p.id});}}>
    <sphereGeometry args={[0.86,10,8]}/><meshBasicMaterial color={accent} transparent opacity={0.76}/>
  </instancedMesh>;
}
