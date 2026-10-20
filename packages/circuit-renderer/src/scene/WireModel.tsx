import { useEffect, useMemo } from 'react';
import { TubeGeometry } from 'three';
import { wireCurve } from '../math';
import type { CircuitWire, Vec3 } from '../types';
import type { ThreeEvent } from '@react-three/fiber';

export function WireModel({ wire, from, to, selected, active, segments, accent, onSelect, preview = false }: {
  wire: CircuitWire; from: Vec3; to: Vec3; selected?: boolean; active?: boolean; segments: number; accent: string;
  onSelect?: (e: ThreeEvent<MouseEvent>) => void; preview?: boolean;
}) {
  const geometry=useMemo(()=>new TubeGeometry(wireCurve(from,to,wire),segments,selected ? 0.65 : 0.48,10,false),[from[0],from[1],from[2],to[0],to[1],to[2],wire.waypoints,wire.lift,segments,selected]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} castShadow={!preview} onClick={onSelect}>
    <meshStandardMaterial color={selected ? accent : wire.color ?? '#64c7a3'} metalness={0.08} roughness={0.35}
      emissive={selected ? accent : wire.color ?? '#64c7a3'} emissiveIntensity={selected ? 0.35 : active ? 0.2 : 0}
      transparent={preview} opacity={preview ? 0.6 : 1}/>
  </mesh>;
}
