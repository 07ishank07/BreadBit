import { finiteVec, resolvePin, samePin } from './math';
import type { CircuitDocument, ComponentRegistry, RendererEdit, Vec3, ViewportFeedback } from './types';

export const pointerThreshold = 5;
export function exceedsThreshold(start: { x: number; y: number }, next: { x: number; y: number }): boolean {
  return Math.hypot(next.x - start.x, next.y - start.y) >= pointerThreshold;
}
export function sameRoute(a: readonly Vec3[] = [], b: readonly Vec3[] = []): boolean {
  return a.length === b.length && a.every((p, i) => p.every((n, axis) => n === b[i][axis]));
}
/** Pure route edits. Endpoints stay attached; endpoint-adjacent segments gain bends. */
export function translateSegment(from: Vec3, to: Vec3, waypoints: readonly Vec3[], index: number, delta: Vec3): Vec3[] {
  if (!Number.isInteger(index) || index < 0 || index > waypoints.length || !finiteVec(delta)) throw new Error('Invalid wire segment');
  if (delta.every(n => n === 0)) return [...waypoints];
  const points = [from, ...waypoints, to];
  const moved = (p: Vec3): Vec3 => [p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]];
  return [...waypoints.slice(0, Math.max(0, index - 1)), moved(points[index]), moved(points[index + 1]), ...waypoints.slice(index + 1)];
}
/** Structural geometry checks only. Host retains electrical validation authority. */
export function validateRendererEdit(edit: RendererEdit, circuit: CircuitDocument, registry: ComponentRegistry): ViewportFeedback | null {
  const failure = (message: string, entityIds: string[] = []): ViewportFeedback => ({ code: 'invalid', message, entityIds, recovery: 'Select current mapped pins or a valid component and retry.' });
  if (edit.type === 'part.move' || edit.type === 'part.rotate') {
    const part = circuit.parts.find(p => p.id === edit.id);
    if (!part || part.locked) return failure('Component is missing or locked.', [edit.id]);
    if (edit.type === 'part.move' ? !finiteVec(edit.position) : !Number.isFinite(edit.radians)) return failure('Invalid component transform.', [edit.id]);
    return null;
  }
  if (edit.type === 'wire.create' || edit.type === 'wire.reconnect') {
    const wire = edit.type === 'wire.reconnect' ? circuit.wires.find(w => w.id === edit.id) : undefined;
    if (edit.type === 'wire.reconnect' && !wire) return failure('Wire no longer exists.', [edit.id]);
    const from = edit.type === 'wire.create' ? edit.from : edit.end === 'from' ? edit.pin : wire!.from;
    const to = edit.type === 'wire.create' ? edit.to : edit.end === 'to' ? edit.pin : wire!.to;
    if (!resolvePin(circuit, registry, from) || !resolvePin(circuit, registry, to)) return failure('Endpoint has no visible pin anchor.', [from.partId, to.partId]);
    if (samePin(from, to)) return failure('Choose two distinct pins.', [from.partId]);
    if (circuit.wires.some(w => w.id !== wire?.id && ((samePin(w.from, from) && samePin(w.to, to)) || (samePin(w.to, from) && samePin(w.from, to))))) return failure('This connection already exists.');
  }
  if ('waypoints' in edit && (edit.waypoints.length > 256 || edit.waypoints.some(p => !finiteVec(p)))) return failure('Wire route must contain at most 256 finite points.');
  if ((edit.type === 'wire.route' || edit.type === 'wire.delete') && !circuit.wires.some(w => w.id === edit.id)) return failure('Wire no longer exists.', [edit.id]);
  return null;
}
export function isNoopEdit(edit: RendererEdit, circuit: CircuitDocument): boolean {
  if (edit.type === 'part.move') return circuit.parts.find(p => p.id === edit.id)?.position.every((n, i) => n === edit.position[i]) ?? false;
  if (edit.type === 'part.rotate') return (circuit.parts.find(p => p.id === edit.id)?.rotation ?? 0) === edit.radians;
  if (edit.type === 'wire.route') return sameRoute(circuit.wires.find(w => w.id === edit.id)?.waypoints, edit.waypoints);
  if (edit.type === 'wire.reconnect') { const wire = circuit.wires.find(w => w.id === edit.id); return !!wire && samePin(wire[edit.end], edit.pin); }
  return false;
}
export const commandLabels: Record<RendererEdit['type'], string> = {
  'part.move': 'Move component', 'part.rotate': 'Rotate component', 'wire.create': 'Connect pins',
  'wire.reconnect': 'Reconnect wire', 'wire.route': 'Edit wire route', 'wire.delete': 'Delete wire',
};
