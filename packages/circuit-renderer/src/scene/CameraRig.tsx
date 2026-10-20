import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MOUSE, OrthographicCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PMREMGenerator } from 'three';
import { circuitBounds } from '../math';
import type { CircuitDocument, ComponentRegistry, InteractionMode, ViewPreset } from '../types';

export interface CameraAPI { controls: OrbitControls; setView: (view: ViewPreset) => void; fit: () => void }
export function CameraRig({ circuit, registry, onAPI, disabled, mode }: {
  circuit: CircuitDocument; registry: ComponentRegistry; onAPI: (api: CameraAPI | null) => void; disabled: boolean; mode: InteractionMode;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  const circuitRef=useRef(circuit); circuitRef.current=circuit;
  const viewRef=useRef<ViewPreset>('isometric');
  // Frame only when requested or resized, never while the user moves a part.
  useEffect(() => {
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minPolarAngle = 0.005; controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.enablePan = true; controls.screenSpacePanning = true;
    controls.minZoom = 0.35; controls.maxZoom = 45;
    controls.target.set(0, 0, 0);
    const changed=()=>invalidate();
    controls.addEventListener('change', changed);
    return () => { controls.removeEventListener('change', changed); controls.dispose(); };
  }, [controls, invalidate]);
  useEffect(() => { controls.enabled = !disabled; }, [controls, disabled]);
  useEffect(() => { controls.mouseButtons.LEFT = mode === 'inspect' ? MOUSE.ROTATE : undefined; }, [controls, mode]);
  useFrame(() => controls.update());
  useEffect(() => {
    const fit = () => {
      const bounds = circuitBounds(circuitRef.current, registry);
      const centre = bounds.getCenter(new Vector3()), dimensions = bounds.getSize(new Vector3());
      controls.target.copy(centre);
      const view=viewRef.current;
      const direction = view === 'top' ? new Vector3(0, 1, 0.001) : view === 'front' ? new Vector3(0, 0.22, 1) : new Vector3(0.65, 1.25, 1.15);
      camera.position.copy(centre).add(direction.normalize().multiplyScalar(400));
      camera.up.set(0,1,0); camera.lookAt(centre);
      camera.updateMatrixWorld();
      // Project the actual eight bounding corners into camera space; fit both axes.
      let maxX = 1, maxY = 1;
      for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
        const point = new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
        maxX = Math.max(maxX, Math.abs(point.x)); maxY = Math.max(maxY, Math.abs(point.y));
      }
      if (camera instanceof OrthographicCamera) {
        camera.zoom = Math.min(size.width/(maxX*2.55),size.height/(maxY*2.55));
        camera.updateProjectionMatrix();
      }
      controls.maxDistance = Math.max(800, dimensions.length()*5);
      controls.update(); invalidate();
    };
    const setView = (next: ViewPreset) => { viewRef.current = next; fit(); };
    onAPI({ controls, fit, setView }); fit();
    return () => onAPI(null);
    // Circuit updates must not recenter the user's camera. Rebind via a stable external ref instead.
  }, [camera, controls, size.width, size.height, onAPI, invalidate, registry]);
  return null;
}

export function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const result = generator.fromScene(room, 0.04);
    const previous = scene.environment;
    scene.environment = result.texture;
    scene.environmentIntensity = 0.55;
    return () => { scene.environment = previous; result.dispose(); room.dispose(); generator.dispose(); };
  }, [gl, scene]);
  return null;
}
