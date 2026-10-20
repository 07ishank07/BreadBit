import { useCallback, useEffect, useRef, useState } from 'react';
import { finiteVec, resolvePin, snapPosition } from './math';
import { commandLabels, isNoopEdit, translateSegment, validateRendererEdit } from './interaction';
import type { CircuitViewportProps, ComponentRegistry, InteractionState, PinRef, RendererEdit, Vec3, ViewportFeedback } from './types';

export function useInteraction(props: CircuitViewportProps, registry: ComponentRegistry) {
  const latest = useRef({ props, registry }); latest.current = { props, registry };
  const [state, setState] = useState<InteractionState>({ kind: 'idle' });
  const current = useRef<InteractionState>(state);
  const [feedback, setFeedback] = useState<ViewportFeedback | null>(null);
  const baseline = useRef({ revision: props.projectRevision, circuit: JSON.stringify(props.circuit) });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const update = useCallback((next: InteractionState) => {
    current.current = next;
    if (mounted.current) setState(next);
    latest.current.props.onInteractionChange?.(next);
  }, []);
  const report = useCallback((next: ViewportFeedback) => {
    if (mounted.current) setFeedback(next);
    latest.current.props.onFeedback?.(next);
  }, []);
  const cancel = useCallback(() => {
    // A submitted host command is already owned by the host and cannot be retracted.
    if (current.current.kind !== 'pending') update({ kind: 'idle' });
  }, [update]);
  const begin = (next: InteractionState) => {
    if (current.current.kind === 'pending') return;
    baseline.current = { revision: latest.current.props.projectRevision, circuit: JSON.stringify(latest.current.props.circuit) };
    setFeedback(null); update(next);
  };
  const stale = () => {
    const p = latest.current.props;
    return baseline.current.revision !== p.projectRevision || baseline.current.circuit !== JSON.stringify(p.circuit);
  };
  useEffect(() => {
    if (current.current.kind !== 'idle' && current.current.kind !== 'pending' && stale()) {
      cancel(); report({ code: 'stale', message: 'The circuit changed during this preview.', entityIds: [], recovery: 'Start the edit again using the current circuit.' });
    }
  }, [props.circuit, props.projectRevision, cancel, report]);
  const commit = async (edit: RendererEdit) => {
    const p = latest.current.props;
    if (current.current.kind === 'pending') return;
    if (current.current.kind !== 'idle' && stale()) {
      cancel(); report({ code: 'stale', message: 'This edit refers to an older circuit.', entityIds: [], recovery: 'Start the edit again.' }); return;
    }
    const invalid = validateRendererEdit(edit, p.circuit, latest.current.registry);
    if (invalid) { report(invalid); return; }
    if (isNoopEdit(edit, p.circuit)) { cancel(); return; }
    const unavailable = () => report({ code: 'unavailable', message: 'The host has not enabled this edit.', entityIds: 'id' in edit ? [edit.id] : [], recovery: 'Connect onCommand and projectRevision in the host integration.' });
    if (p.onCommand && p.projectRevision === undefined) { unavailable(); return; }
    const legacy = !p.onCommand && (
      (edit.type === 'part.move' && p.onPartMove) || (edit.type === 'part.rotate' && p.onPartRotate)
      || (edit.type === 'wire.create' && edit.waypoints.length === 0 && p.onWireCreate));
    if (!p.onCommand && !legacy) { unavailable(); return; }
    const actionId = globalThis.crypto.randomUUID();
    update({ kind: 'pending', actionId });
    try {
      if (p.onCommand) {
        const result = await p.onCommand({ actionId, label: commandLabels[edit.type], expectedRevision: p.projectRevision!, edit });
        if (!result || typeof result.accepted !== 'boolean') throw new Error('Host did not acknowledge the command.');
        if (!result.accepted) report(result.feedback);
      } else if (edit.type === 'part.move') p.onPartMove?.(edit.id, edit.position);
      else if (edit.type === 'part.rotate') p.onPartRotate?.(edit.id, edit.radians);
      else if (edit.type === 'wire.create') p.onWireCreate?.(edit.from, edit.to);
    } catch (error) {
      report({ code: 'rejected', message: error instanceof Error ? error.message : String(error), entityIds: 'id' in edit ? [edit.id] : [], recovery: 'Review the host error and retry.' });
    } finally {
      const finalState = current.current as InteractionState;
      if (mounted.current && finalState.kind === 'pending' && finalState.actionId === actionId) update({ kind: 'idle' });
    }
  };
  const choosePin = (pin: PinRef) => {
    if (!resolvePin(latest.current.props.circuit, latest.current.registry, pin)) {
      report({ code: 'invalid', message: 'Pin anchor is unavailable.', entityIds: [pin.partId], recovery: 'Choose a pin from the current host catalog.' }); return;
    }
    const s = current.current;
    if (s.kind === 'idle') begin({ kind: 'wire', source: pin, waypoints: [] });
    else if (s.kind === 'wire') void commit({ type: 'wire.create', from: s.source, to: pin, waypoints: s.waypoints });
    else if (s.kind === 'reconnect') void commit({ type: 'wire.reconnect', id: s.wireId, end: s.end, pin });
  };
  const addWireBend = (position: Vec3) => {
    const s = current.current;
    if (s.kind === 'wire' && finiteVec(position) && s.waypoints.length < 256) update({ ...s, waypoints: [...s.waypoints, snapPosition(position, latest.current.props.snap ?? 2.54)] });
  };
  const beginReconnect = (wireId: string, end: 'from' | 'to') => {
    if (latest.current.props.circuit.wires.some(w => w.id === wireId)) begin({ kind: 'reconnect', wireId, end });
  };
  const beginPlacement = (partId: string) => {
    const part = latest.current.props.circuit.parts.find(p => p.id === partId);
    if (part && !part.locked) begin({ kind: 'placement', partId, position: part.position });
  };
  const previewPlacement = (position: Vec3) => {
    const s = current.current;
    if (s.kind === 'placement' && finiteVec(position)) update({ ...s, position: snapPosition(position, latest.current.props.snap ?? 2.54) });
  };
  const commitPlacement = () => { const s = current.current; if (s.kind === 'placement') void commit({ type: 'part.move', id: s.partId, position: s.position }); };
  const beginRouteEdit = (wireId: string) => {
    const wire = latest.current.props.circuit.wires.find(w => w.id === wireId);
    if (wire) begin({ kind: 'route', wireId, waypoints: wire.waypoints?.map(p => [...p] as Vec3) ?? [] });
  };
  const editRoute = (fn: (points: readonly Vec3[]) => readonly Vec3[]) => {
    const s = current.current;
    if (s.kind !== 'route') return;
    const waypoints = fn(s.waypoints);
    if (waypoints.length <= 256 && waypoints.every(finiteVec)) update({ ...s, waypoints });
  };
  return {
    state, current, feedback, report, cancel, commit, choosePin, addWireBend, beginReconnect,
    beginPlacement, previewPlacement, commitPlacement, beginRouteEdit,
    insertBend: (index: number, point: Vec3) => editRoute(points => Number.isInteger(index) && index >= 0 && index <= points.length && finiteVec(point) ? [...points.slice(0, index), point, ...points.slice(index)] : points),
    moveBend: (index: number, point: Vec3) => editRoute(points => finiteVec(point) ? points.map((p, i) => i === index ? point : p) : points),
    removeBend: (index: number) => editRoute(points => points.filter((_, i) => i !== index)),
    moveSegment: (index: number, delta: Vec3) => {
      const s = current.current, p = latest.current.props;
      if (s.kind !== 'route') return;
      const w = p.circuit.wires.find(w => w.id === s.wireId);
      const from = w && resolvePin(p.circuit, latest.current.registry, w.from), to = w && resolvePin(p.circuit, latest.current.registry, w.to);
      if (from && to) {
        try { editRoute(points => translateSegment(from, to, points, index, delta)); }
        catch { report({ code: 'invalid', message: 'Invalid wire segment.', entityIds: [s.wireId], recovery: 'Choose a current segment and a finite movement.' }); }
      }
    },
    commitRoute: () => { const s = current.current; if (s.kind === 'route') void commit({ type: 'wire.route', id: s.wireId, waypoints: s.waypoints }); },
    deleteWire: (id: string) => { cancel(); void commit({ type: 'wire.delete', id }); },
  };
}
