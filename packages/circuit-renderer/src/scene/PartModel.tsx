import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Matrix4, OrthographicCamera } from 'three';
import type { CircuitPart, ComponentDefinition, PartVisualState, ViewportTheme } from '../types';
import { SurfaceText } from '../models/primitives';
import { UnknownModel } from '../models/parts';

export function PartModel({ part, definition, state, selected, labels, wireMode, theme, labelScale = 1 }: {
  part: CircuitPart; definition?: ComponentDefinition; state: PartVisualState; selected: boolean;
  labels: boolean; wireMode: boolean; theme: ViewportTheme; labelScale?: number;
}) {
  const Model = definition?.Model ?? UnknownModel;
  const size = definition?.size ?? [12, 8, 12];
  return <group userData={{ partId: part.id }} position={[...part.position]} rotation={[0, part.rotation ?? 0, 0]}>
    <Model part={part} state={state} selected={selected}/>
    {selected && <group position={[0, 0.15, 0]}>
      {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}:${z}`} position={[x * (size[0] / 2 + 2), 0, z * (size[2] / 2 + 2)]}>
        <mesh position={[-x * 2, 0, 0]} renderOrder={10}><boxGeometry args={[4, 0.16, 0.5]}/><meshBasicMaterial depthTest={false} color={state.fault ? '#f78872' : theme.accent}/></mesh>
        <mesh position={[0, 0, -z * 2]} renderOrder={10}><boxGeometry args={[0.5, 0.16, 4]}/><meshBasicMaterial depthTest={false} color={state.fault ? '#f78872' : theme.accent}/></mesh>
      </group>))}
    </group>}
    {labels && <SurfaceText text={part.label ?? definition?.label ?? part.kind} at={[0, 0.12, size[2] / 2 + 6]} width={Math.max(16, Math.min(45, size[0] + 8)) * labelScale} height={2.6 * labelScale} color={selected ? theme.accent : theme.foreground} weight={600}/>}
    {wireMode && definition && <PinMarkers definition={definition} accent={theme.accent}/>}
  </group>;
}

function PinMarkers({ definition, accent }: { definition: ComponentDefinition; accent: string }) {
  const ref = useRef<InstancedMesh>(null), zoom = useRef(-1);
  const { camera } = useThree();
  const update = () => {
    if (!ref.current) return;
    const z = camera instanceof OrthographicCamera ? camera.zoom : 3;
    if (z === zoom.current) return;
    zoom.current = z;
    const matrix = new Matrix4(), radius = 2.5 / z;
    definition.pins.forEach((pin, i) => {
      matrix.makeScale(radius, radius, radius).setPosition(...pin.position);
      ref.current!.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere();
  };
  useLayoutEffect(() => { zoom.current = -1; update(); }, [definition, camera]);
  useFrame(update);
  return <instancedMesh ref={ref} args={[undefined, undefined, definition.pins.length]} renderOrder={12} raycast={() => {}}>
    <sphereGeometry args={[1, 8, 6]}/><meshBasicMaterial color={accent} depthTest={false}/>
  </instancedMesh>;
}
