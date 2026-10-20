import { useMemo } from 'react';
import { Color } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Quality, ViewportTheme } from '../types';
import { qualityProfiles } from '../theme';

export function Workbench({ theme, grid, quality, onPointerMove }: {
  theme: ViewportTheme; grid: boolean; quality: Quality; onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const uniforms = useMemo(() => ({
    surface: { value: new Color(theme.surface) }, gridColor: { value: new Color(theme.grid) },
    showGrid: { value: grid ? 1 : 0 },
  }), [theme.surface, theme.grid, grid]);
  return <>
    <color attach="background" args={[theme.background]}/>
    <ambientLight intensity={0.55}/>
    <directionalLight position={[-80,160,70]} intensity={3.1} color="#fff7e8" castShadow={quality !== 'draft'}
      shadow-mapSize={[qualityProfiles[quality].shadowSize, qualityProfiles[quality].shadowSize]}
      shadow-camera-left={-200} shadow-camera-right={200} shadow-camera-top={180} shadow-camera-bottom={-180}
      shadow-camera-near={1} shadow-camera-far={650} shadow-bias={-0.00015} shadow-normalBias={0.4}/>
    <directionalLight position={[100,70,-90]} intensity={1.7} color="#b9dbe8"/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.08,0]} onPointerMove={onPointerMove}>
      <planeGeometry args={[3000,3000]}/>
      <shaderMaterial uniforms={uniforms} vertexShader={`varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`}
        fragmentShader={`varying vec3 world; uniform vec3 surface; uniform vec3 gridColor; uniform float showGrid;
          void main(){vec2 p=world.xz/5.08;vec2 d=max(fwidth(p),vec2(.0001));vec2 g=abs(fract(p-.5)-.5)/d;
          float line=1.-min(min(g.x,g.y),1.);float fade=1.-smoothstep(100.,420.,length(world.xz));
          vec3 col=mix(surface,gridColor,line*.44*fade*showGrid);gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }
        `}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.06,0]} receiveShadow raycast={() => {}}>
      <planeGeometry args={[1500,1500]}/><shadowMaterial transparent opacity={0.27}/>
    </mesh>
  </>;
}
