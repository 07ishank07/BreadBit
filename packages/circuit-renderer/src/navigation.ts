import { Matrix4, OrthographicCamera, Vector3 } from 'three';
import type { CameraState, NavigationPreferences, Vec3 } from './types';

export const defaultNavigation: NavigationPreferences = {
  profile: 'trackpad', twoFingerAction: 'pan', initialView: 'top',
  panSensitivity: 1, zoomSensitivity: 1, orbitSensitivity: 1,
  invertPan: false, invertZoom: false,
};
export function navigationPreferences(input: Partial<NavigationPreferences> = {}): NavigationPreferences {
  const result = { ...defaultNavigation, ...input };
  if (result.profile !== 'trackpad' && result.profile !== 'mouse') result.profile = defaultNavigation.profile;
  if (result.twoFingerAction !== 'pan' && result.twoFingerAction !== 'zoom') result.twoFingerAction = 'pan';
  if (!['top', 'front', 'isometric'].includes(result.initialView)) result.initialView = 'top';
  for (const key of ['panSensitivity', 'zoomSensitivity', 'orbitSensitivity'] as const) {
    result[key] = Number.isFinite(result[key]) ? Math.max(0.1, Math.min(5, result[key])) : 1;
  }
  return result;
}
/** DOM_DELTA_PIXEL/LINE/PAGE, normalized to CSS pixels without guessing hardware. */
export function wheelPixels(x: number, y: number, mode: number, height: number) {
  const scale = mode === 1 ? 16 : mode === 2 ? Math.max(1, height) : 1;
  return { x: Math.max(-2000, Math.min(2000, x * scale)), y: Math.max(-2000, Math.min(2000, y * scale)) };
}
export function wheelIntent(event: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, prefs: NavigationPreferences, height: number) {
  const p = wheelPixels(event.deltaX, event.deltaY, event.deltaMode, height);
  if (event.ctrlKey || event.metaKey || prefs.twoFingerAction === 'zoom') {
    return { type: 'zoom' as const, factor: Math.exp(-p.y * 0.005 * prefs.zoomSensitivity * (prefs.invertZoom ? -1 : 1)) };
  }
  const direction = prefs.panSensitivity * (prefs.invertPan ? -1 : 1);
  return { type: 'pan' as const, x: (event.shiftKey && !p.x ? p.y : p.x) * direction, y: (event.shiftKey && !p.x ? 0 : p.y) * direction };
}
export function validCameraState(value: unknown): value is CameraState {
  if (!value || typeof value !== 'object') return false;
  const state = value as CameraState;
  return [state.position, state.target, state.up].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))
    && Number.isFinite(state.zoom) && state.zoom > 0
    && new Vector3(...state.position).distanceToSquared(new Vector3(...state.target)) > 0.001
    && new Vector3(...state.up).lengthSq() > 0.001;
}
export function cameraSnapshot(camera: OrthographicCamera, target: Vector3): CameraState {
  return { position: camera.position.toArray() as unknown as Vec3, target: target.toArray() as unknown as Vec3, up: camera.up.toArray() as unknown as Vec3, zoom: camera.zoom };
}
export function panOffset(camera: OrthographicCamera, width: number, height: number, x: number, y: number): Vector3 {
  camera.updateMatrixWorld();
  const matrix = new Matrix4().extractRotation(camera.matrixWorld);
  return new Vector3(x * (camera.right - camera.left) / (Math.max(1, width) * camera.zoom),
    -y * (camera.top - camera.bottom) / (Math.max(1, height) * camera.zoom), 0).applyMatrix4(matrix);
}
export function isViewportShortcut(event: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null }, root: HTMLElement): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target;
  return target instanceof HTMLElement && (target === root || target.tagName === 'CANVAS')
    && !target.closest('input,textarea,select,button,[contenteditable=true],[role=dialog],[role=textbox]');
}
