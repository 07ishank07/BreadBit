import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { CanvasTexture, InstancedMesh, Matrix4, SRGBColorSpace } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Vec3 } from '../types';

export function Solid({ size, at = [0, 0, 0], color, radius = 0.3, metal = 0, rough = 0.5, rotation = [0, 0, 0] }: {
  size: Vec3; at?: Vec3; color: string; radius?: number; metal?: number; rough?: number; rotation?: Vec3;
}) {
  const geometry = useMemo(() => new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 2))), [size[0], size[1], size[2], radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[...at]} rotation={[...rotation]} castShadow receiveShadow>
    <meshStandardMaterial color={color} metalness={metal} roughness={rough}/>
  </mesh>;
}
export function Cylinder({ at, radius, height, color, metal = 0, rotation = [0, 0, 0], radial = 32 }: {
  at: Vec3; radius: number; height: number; color: string; metal?: number; rotation?: Vec3; radial?: number;
}) {
  return <mesh position={[...at]} rotation={[...rotation]} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius, height, radial]}/>
    <meshStandardMaterial color={color} metalness={metal} roughness={metal ? 0.3 : 0.6}/>
  </mesh>;
}
export function Instances({ positions, size, color, metal = 0 }: { positions: readonly Vec3[]; size: Vec3; color: string; metal?: number }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    positions.forEach((p, i) => mesh.setMatrixAt(i, matrix.makeTranslation(...p)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions]);
  return <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
    <boxGeometry args={[...size]}/><meshStandardMaterial color={color} metalness={metal} roughness={0.45}/>
  </instancedMesh>;
}
/** Rasterised at high resolution locally, so labels never request fonts or assets from a CDN. */
export function SurfaceText({ text, at, width, height = 3, color = '#d4e8df', weight = 600, rotation = [-Math.PI / 2, 0, 0] }: {
  text: string; at: Vec3; width: number; height?: number; color?: string; weight?: number; rotation?: Vec3;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = Math.max(64, Math.round(1024 * height / width));
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = `${weight} ${Math.round(canvas.height * 0.73)}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.98);
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; result.anisotropy = 8;
    return result;
  }, [text, width, height, color, weight]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[...at]} rotation={[...rotation]} raycast={() => {}}>
    <planeGeometry args={[width, height]}/><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}/>
  </mesh>;
}
