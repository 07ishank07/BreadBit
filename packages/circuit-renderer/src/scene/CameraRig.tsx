import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, PMREMGenerator, Spherical, Vector3 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { circuitBounds } from '../math';
import { cameraSnapshot, navigationPreferences, panOffset, validCameraState, wheelIntent } from '../navigation';
import type { CameraState, CircuitDocument, ComponentRegistry, InteractionMode, NavigationPreferences, ViewPreset } from '../types';

export interface CameraAPI {
  setView: (view: ViewPreset) => void;
  fit: () => void;
  focus: (circuit: CircuitDocument) => void;
  pan: (x: number, y: number) => void;
  zoom: (factor: number) => void;
  orbit: (x: number, y: number) => void;
  snapshot: () => CameraState;
  restore: (state: CameraState) => void;
  cancel: () => void;
}
export function CameraRig(props: {
  circuit: CircuitDocument; registry: ComponentRegistry; onAPI: (api: CameraAPI | null) => void;
  disabled: boolean; mode: InteractionMode; navigation?: Partial<NavigationPreferences>;
  initialState?: CameraState; onChange?: (state: CameraState) => void;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const latest = useRef({ ...props, size }); latest.current = { ...props, size };
  const saved = useRef<CameraState | undefined>(props.initialState);
  const api = useRef<CameraAPI | null>(null);
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const element = gl.domElement, target = new Vector3();
    let pointer: { id: number; x: number; y: number; action: 'pan' | 'orbit' } | null = null;
    const changed = () => {
      camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      saved.current = cameraSnapshot(camera, target);
      invalidate(); latest.current.onChange?.(saved.current);
    };
    const cancel = () => {
      const id = pointer?.id; pointer = null;
      if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id);
    };
    const pan = (x: number, y: number) => {
      if (!Number.isFinite(x + y)) return;
      const s = latest.current.size, delta = panOffset(camera, s.width, s.height, x, y);
      target.add(delta); camera.position.add(delta); changed();
    };
    const zoom = (factor: number) => {
      if (!Number.isFinite(factor) || factor <= 0) return;
      camera.zoom = Math.max(0.1, Math.min(80, camera.zoom * factor)); changed();
    };
    const orbit = (x: number, y: number) => {
      if (!Number.isFinite(x + y)) return;
      const spherical = new Spherical().setFromVector3(camera.position.clone().sub(target));
      const sensitivity = navigationPreferences(latest.current.navigation).orbitSensitivity * 0.006;
      spherical.theta -= x * sensitivity;
      spherical.phi = Math.max(0.005, Math.min(Math.PI / 2 - 0.005, spherical.phi - y * sensitivity));
      camera.up.set(0, 1, 0); camera.position.copy(target).add(new Vector3().setFromSpherical(spherical)); changed();
    };
    const restore = (state: CameraState) => {
      if (!validCameraState(state)) return;
      target.fromArray(state.target); camera.position.fromArray(state.position); camera.up.fromArray(state.up);
      camera.zoom = Math.max(0.1, Math.min(80, state.zoom)); changed();
    };
    const focus = (circuit: CircuitDocument) => {
      const bounds = circuitBounds(circuit, latest.current.registry), centre = bounds.getCenter(new Vector3());
      camera.position.add(centre.clone().sub(target)); target.copy(centre);
      camera.lookAt(target); camera.updateMatrixWorld();
      let maxX = 1, maxY = 1;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        maxX = Math.max(maxX, Math.abs(p.x)); maxY = Math.max(maxY, Math.abs(p.y));
      }
      const s = latest.current.size;
      camera.zoom = Math.max(0.1, Math.min(80, s.width / (maxX * 2.6), s.height / (maxY * 2.6))); changed();
    };
    const setView = (view: ViewPreset) => {
      const direction = view === 'top' ? new Vector3(0, 1, 0.00001) : view === 'front' ? new Vector3(0, 0.12, 1) : new Vector3(0.65, 1.25, 1.15);
      const distance = Math.max(100, camera.position.distanceTo(target));
      camera.position.copy(target).add(direction.normalize().multiplyScalar(distance)); camera.up.set(0, 1, 0); changed();
    };
    const down = (event: PointerEvent) => {
      if (latest.current.disabled || pointer || event.ctrlKey || event.metaKey || event.altKey) return;
      const mode = latest.current.mode;
      const action = event.button === 1 || event.button === 2 || mode === 'pan' ? 'pan' : mode === 'orbit' ? 'orbit' : null;
      if (!action || (event.button !== 0 && event.button !== 1 && event.button !== 2)) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, action };
      element.setPointerCapture(event.pointerId); event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const x = event.clientX - pointer.x, y = event.clientY - pointer.y;
      pointer.x = event.clientX; pointer.y = event.clientY;
      const prefs = navigationPreferences(latest.current.navigation);
      if (pointer.action === 'pan') pan(-x * prefs.panSensitivity, -y * prefs.panSensitivity); else orbit(x, y);
    };
    const up = (event: PointerEvent) => { if (event.pointerId === pointer?.id) cancel(); };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (latest.current.disabled) return;
      const intent = wheelIntent(event, navigationPreferences(latest.current.navigation), latest.current.size.height);
      if (intent.type === 'zoom') zoom(intent.factor); else pan(intent.x, intent.y);
    };
    const context = (event: Event) => event.preventDefault();
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up); element.addEventListener('pointercancel', cancel);
    element.addEventListener('lostpointercapture', cancel); window.addEventListener('blur', cancel);
    element.addEventListener('wheel', wheel, { passive: false }); element.addEventListener('contextmenu', context);
    api.current = { fit: () => focus(latest.current.circuit), focus, setView, pan, zoom, orbit, restore, snapshot: () => cameraSnapshot(camera, target), cancel };
    const state = saved.current;
    if (state && validCameraState(state)) restore(state);
    else { setView(navigationPreferences(latest.current.navigation).initialView); focus(latest.current.circuit); }
    props.onAPI(api.current);
    return () => {
      cancel(); props.onAPI(null); api.current = null;
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', cancel); window.removeEventListener('blur', cancel);
      element.removeEventListener('wheel', wheel); element.removeEventListener('contextmenu', context);
    };
  }, [camera, gl, invalidate, props.onAPI]);
  useEffect(() => { api.current?.cancel(); }, [props.mode, props.disabled]);
  // R3F adjusts the frustum on resize. Target, orientation and zoom are deliberately untouched.
  return null;
}

export function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    let dispose = () => {};
    const build = () => {
      dispose();
      const room = new RoomEnvironment(), generator = new PMREMGenerator(gl);
      const result = generator.fromScene(room, 0.04), previous = scene.environment;
      scene.environment = result.texture; scene.environmentIntensity = 0.55;
      dispose = () => { scene.environment = previous; result.dispose(); room.dispose(); generator.dispose(); };
      invalidate();
    };
    build(); gl.domElement.addEventListener('webglcontextrestored', build);
    return () => { gl.domElement.removeEventListener('webglcontextrestored', build); dispose(); };
  }, [gl, scene, invalidate]);
  return null;
}
