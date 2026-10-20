import { Box3, CatmullRomCurve3, Vector3 } from 'three';
import type { CircuitDocument, CircuitPart, CircuitWire, ComponentRegistry, PinRef, Vec3 } from './types';

export const pinKey = (pin: PinRef): string => JSON.stringify([pin.partId, pin.pinId]);
export const samePin = (a: PinRef, b: PinRef): boolean => a.partId === b.partId && a.pinId === b.pinId;
export const finiteVec = (v: Vec3): boolean => v.length === 3 && v.every(Number.isFinite);
export function worldPosition(part: CircuitPart, local: Vec3): Vec3 {
  const a = part.rotation ?? 0;
  return [part.position[0] + local[0] * Math.cos(a) + local[2] * Math.sin(a),
    part.position[1] + local[1], part.position[2] - local[0] * Math.sin(a) + local[2] * Math.cos(a)];
}
export function resolvePin(circuit: CircuitDocument, registry: ComponentRegistry, ref: PinRef): Vec3 | undefined {
  const part = circuit.parts.find(p => p.id === ref.partId);
  if (!part) return;
  const pin = registry[part.kind]?.pins.find(p => p.id === ref.pinId);
  return pin ? worldPosition(part, pin.position) : undefined;
}
export function snapPosition(v: Vec3, grid: number): Vec3 {
  if (!Number.isFinite(grid) || grid <= 0) return v;
  return [Math.round(v[0] / grid) * grid, v[1], Math.round(v[2] / grid) * grid];
}
export function circuitBounds(circuit: CircuitDocument, registry: ComponentRegistry): Box3 {
  const b = new Box3();
  for (const p of circuit.parts) {
    const size = registry[p.kind]?.size ?? [12, 8, 12];
    for (const x of [-size[0] / 2, size[0] / 2]) for (const y of [0, size[1]]) for (const z of [-size[2] / 2, size[2] / 2]) {
      b.expandByPoint(new Vector3(...worldPosition(p, [x, y, z])));
    }
  }
  for (const wire of circuit.wires) {
    const from = resolvePin(circuit, registry, wire.from), to = resolvePin(circuit, registry, wire.to);
    if (from && to) for (const point of wireCurve(from, to, wire).getPoints(24)) b.expandByPoint(point);
  }
  return b.isEmpty() ? new Box3(new Vector3(-50, 0, -35), new Vector3(50, 20, 35)) : b;
}
export function wireCurve(from: Vec3, to: Vec3, wire: Pick<CircuitWire, 'waypoints' | 'lift'>): CatmullRomCurve3 {
  if (wire.waypoints?.length) return new CatmullRomCurve3([from, ...wire.waypoints, to].map(p => new Vector3(...p)), false, 'centripetal');
  const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const height = Math.max(from[1], to[1]) + (wire.lift ?? Math.min(18, Math.max(5, distance * 0.16)));
  return new CatmullRomCurve3([
    new Vector3(...from), new Vector3(from[0], height, from[2]),
    new Vector3((from[0] + to[0]) / 2, height + 1, (from[2] + to[2]) / 2),
    new Vector3(to[0], height, to[2]), new Vector3(...to),
  ], false, 'centripetal');
}
/** Geometry checks only. This deliberately makes no claims about electrical correctness. */
export function validateCircuit(circuit: CircuitDocument, registry: ComponentRegistry): string[] {
  const errors: string[] = [], ids = new Set<string>();
  for (const p of circuit.parts) {
    if (ids.has(p.id)) errors.push(`Duplicate part ID: ${p.id}`);
    ids.add(p.id);
    if (!finiteVec(p.position) || !Number.isFinite(p.rotation ?? 0)) errors.push(`Invalid transform: ${p.id}`);
    if (!registry[p.kind]) errors.push(`Unknown component kind: ${p.kind}`);
  }
  ids.clear();
  for (const w of circuit.wires) {
    if (ids.has(w.id)) errors.push(`Duplicate wire ID: ${w.id}`);
    ids.add(w.id);
    if (samePin(w.from, w.to)) errors.push(`Wire connects a pin to itself: ${w.id}`);
    if (!resolvePin(circuit, registry, w.from) || !resolvePin(circuit, registry, w.to)) errors.push(`Unresolved wire endpoint: ${w.id}`);
    if (w.waypoints?.some(v => !finiteVec(v)) || !Number.isFinite(w.lift ?? 0)) errors.push(`Invalid wire path: ${w.id}`);
  }
  return errors;
}
