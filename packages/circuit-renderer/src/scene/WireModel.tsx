import { useEffect, useMemo } from 'react';
import { TubeGeometry } from 'three';
import { wireCurve } from '../math';
import type { CircuitWire, Vec3 } from '../types';
import type { ThreeEvent } from '@react-three/fiber';

export function WireModel({ wire, from, to, selected, active, segments, accent, onSelect, preview = false, dimmed = false, foreground = '#ffffff' }: {
  wire: CircuitWire; from: Vec3; to: Vec3; selected?: boolean; active?: boolean; segments: number; accent: string;
  onSelect?: (e: ThreeEvent<MouseEvent>) => void; preview?: boolean; dimmed?: boolean; foreground?: string;
}) {
  const geometry=useMemo(()=>new TubeGeometry(wireCurve(from,to,wire),segments,selected ? 0.65 : 0.48,10,false),[from[0],from[1],from[2],to[0],to[1],to[2],wire.waypoints,wire.lift,segments,selected]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const marks = useMemo(() => {
    if (!selected && (!wire.pattern || wire.pattern === 'solid')) return [];
    const curve = wireCurve(from, to, wire), count = Math.min(120, Math.max(2, Math.floor(curve.getLength() / (wire.pattern === 'dotted' ? 3 : 7))));
    return Array.from({ length: count }, (_, i) => curve.getPointAt((i + 0.5) / count));
  }, [from[0], from[1], from[2], to[0], to[1], to[2], wire.waypoints, wire.lift, wire.pattern, selected]);
  return <group><mesh geometry={geometry} castShadow={!preview} onClick={onSelect}>
    <meshStandardMaterial color={selected ? accent : wire.color ?? '#64c7a3'} metalness={0.08} roughness={0.35}
      emissive={selected ? accent : wire.color ?? '#64c7a3'} emissiveIntensity={selected ? 0.35 : active ? 0.2 : 0}
      transparent={preview || dimmed} opacity={preview ? 0.6 : dimmed ? 0.2 : 1}/>
  </mesh>{marks.map((p, i) => <mesh key={i} position={p} raycast={() => {}}>
    <sphereGeometry args={[selected ? 0.82 : 0.61, 8, 6]}/><meshBasicMaterial color={foreground}/>
  </mesh>)}</group>;
}
