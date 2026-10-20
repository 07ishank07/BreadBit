import { Vector3 } from 'three';
import type { Camera } from 'three';
import { pinKey, resolvePin, wireCurve, worldPosition } from './math';
import type { CircuitDocument, ComponentRegistry, PickCandidate, Vec3 } from './types';

export function projectPoint(point: Vec3, camera: Camera, width: number, height: number) {
  const p = new Vector3(...point).project(camera);
  if (!Number.isFinite(p.x + p.y + p.z) || p.z < -1 || p.z > 1) return;
  return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
}
export function segmentDistance(x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { distance: Math.hypot(x - a.x - dx * t, y - a.y - dy * t), t };
}
/** All candidates within a CSS-pixel radius, including overlapping anchors.
 * Occlusion never silently chooses one electrical pin over another. */
export function pickCandidates(circuit: CircuitDocument, registry: ComponentRegistry, camera: Camera,
  size: { width: number; height: number }, pointer: { x: number; y: number }, options: { pins: boolean; wires: boolean; radius: number }): PickCandidate[] {
  const result: PickCandidate[] = [];
  if (options.pins) for (const part of circuit.parts) for (const pin of registry[part.kind]?.pins ?? []) {
    const point = worldPosition(part, pin.position), p = projectPoint(point, camera, size.width, size.height);
    if (!p) continue;
    const distance = Math.hypot(pointer.x - p.x, pointer.y - p.y);
    if (distance <= options.radius) {
      const ref = { partId: part.id, pinId: pin.id };
      result.push({ key: `pin:${pinKey(ref)}`, label: `${part.id} / ${pin.label ?? pin.id} (${pin.capability ?? 'visual'})`, distance, point, target: { type: 'pin', pin: ref } });
    }
  }
  if (options.wires) for (const wire of circuit.wires) {
    const from = resolvePin(circuit, registry, wire.from), to = resolvePin(circuit, registry, wire.to);
    if (!from || !to) continue;
    const points = wireCurve(from, to, wire).getPoints(64);
    let best = { distance: Infinity, point: from };
    for (let i = 1; i < points.length; i++) {
      const a = projectPoint(points[i - 1].toArray() as unknown as Vec3, camera, size.width, size.height);
      const b = projectPoint(points[i].toArray() as unknown as Vec3, camera, size.width, size.height);
      if (!a || !b) continue;
      const hit = segmentDistance(pointer.x, pointer.y, a, b);
      if (hit.distance < best.distance) best = { distance: hit.distance, point: points[i - 1].clone().lerp(points[i], hit.t).toArray() as unknown as Vec3 };
    }
    if (best.distance <= options.radius) result.push({ key: `wire:${wire.id}`, label: wire.label || `Wire ${wire.id}`, ...best, target: { type: 'wire', id: wire.id } });
  }
  return result.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
}
