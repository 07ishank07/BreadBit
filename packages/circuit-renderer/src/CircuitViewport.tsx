import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { RootState } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap, Plane, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { builtinComponents } from './catalogue';
import { graphiteTheme, qualityProfiles } from './theme';
import { pinKey, resolvePin, snapPosition } from './math';
import { exceedsThreshold } from './interaction';
import { isViewportShortcut } from './navigation';
import { pickCandidates, projectPoint } from './picking';
import { useInteraction } from './useInteraction';
import { CameraRig, StudioEnvironment } from './scene/CameraRig';
import type { CameraAPI } from './scene/CameraRig';
import { Workbench } from './scene/Workbench';
import { PartModel } from './scene/PartModel';
import { WireModel } from './scene/WireModel';
import type { CameraState, CircuitPart, CircuitViewportHandle, CircuitViewportProps, InteractionMode, PickCandidate, PinRef, Vec3 } from './types';

interface Gesture {
  pointerId: number; start: { x: number; y: number }; moved: boolean;
  part?: CircuitPart; offset?: Vector3;
}
class RenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError?: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError?.(error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export const CircuitViewport = forwardRef<CircuitViewportHandle, CircuitViewportProps>(function CircuitViewport(props, ref) {
  const { circuit, snapshot, registry: customRegistry, selection = null, mode = 'inspect', quality = 'balanced',
    showGrid = true, showLabels = true, snap = 2.54, className, style, ariaLabel = 'Interactive 3D circuit workspace',
    onSelect, onInputChange, onPinHover, onError, onStats, onReady } = props;
  const registry = useMemo(() => ({ ...builtinComponents, ...customRegistry }), [customRegistry]);
  const theme = useMemo(() => ({ ...graphiteTheme, ...props.theme }), [props.theme]);
  const editor = useInteraction(props, registry);
  const editorRef = useRef(editor); editorRef.current = editor;
  const root = useRef<RootState | null>(null), camera = useRef<CameraAPI | null>(null);
  const container = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null);
  const pressing = useRef<string | null>(null), input = useRef(onInputChange); input.current = onInputChange;
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [navigationTool, setNavigationTool] = useState<InteractionMode>(mode);
  const [candidates, setCandidates] = useState<readonly PickCandidate[]>([]);
  const [hoverPin, setHoverPin] = useState<PinRef | null>(null);
  const [cursorPoint, setCursorPoint] = useState<Vec3 | null>(null);
  const [routeHandle, setRouteHandle] = useState<{ kind: 'bend' | 'segment'; index: number; origin: Vec3 } | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [, redraw] = useState(0);
  const cameraState = useRef<CameraState | undefined>(props.initialCameraState);
  const callbacks = useRef(props); callbacks.current = props;
  const onCameraChange = useCallback((state: CameraState) => {
    cameraState.current = state; redraw(n => n + 1); callbacks.current.onCameraChange?.(state);
  }, []);
  const setCameraAPI = useCallback((api: CameraAPI | null) => { camera.current = api; }, []);
  const release = useCallback(() => {
    if (pressing.current) input.current?.({ partId: pressing.current, property: 'pressed', value: false });
    pressing.current = null; setPressedId(null);
  }, []);
  const releaseCapture = () => {
    const g = gesture.current; gesture.current = null;
    if (g && root.current?.gl.domElement.hasPointerCapture(g.pointerId)) root.current.gl.domElement.releasePointerCapture(g.pointerId);
  };
  const cancel = useCallback(() => {
    releaseCapture(); editorRef.current.cancel(); camera.current?.cancel(); release();
    setCandidates([]); setCursorPoint(null); setRouteHandle(null); setHoverPin(null);
    callbacks.current.onPinHover?.(null); callbacks.current.onPickCandidates?.([]);
  }, [release]);
  useEffect(() => { cancel(); setNavigationTool(mode); }, [mode, cancel]);
  useEffect(() => {
    const up = () => release();
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); window.addEventListener('pointerup', up);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', cancel); window.removeEventListener('pointerup', up);
      document.removeEventListener('visibilitychange', hidden);
      if (pressing.current) input.current?.({ partId: pressing.current, property: 'pressed', value: false });
    };
  }, [cancel, release]);
  useEffect(() => {
    if (selection && ((selection.type === 'part' && !circuit.parts.some(p => p.id === selection.id)) || (selection.type === 'wire' && !circuit.wires.some(w => w.id === selection.id)))) onSelect?.(null);
    if (pressing.current && !circuit.parts.some(p => p.id === pressing.current)) release();
    // A new document invalidates old overlapping candidate menus too.
    setCandidates([]); setRouteHandle(null);
  }, [circuit, onSelect, release]);
  useEffect(() => { if (editor.state.kind === 'idle') { setRouteHandle(null); setCursorPoint(null); } }, [editor.state.kind]);
  const liveCircuit = useMemo(() => {
    const state = editor.state;
    if (state.kind === 'placement') return { ...circuit, parts: circuit.parts.map(p => p.id === state.partId ? { ...p, position: state.position } : p) };
    if (state.kind === 'route') return { ...circuit, wires: circuit.wires.map(w => w.id === state.wireId ? { ...w, waypoints: state.waypoints } : w) };
    return circuit;
  }, [circuit, editor.state]);
  const liveRef = useRef(liveCircuit); liveRef.current = liveCircuit;
  const project = (point: Vec3) => {
    const r = root.current; return r ? projectPoint(point, r.camera, r.size.width, r.size.height) : undefined;
  };
  const chooseCandidate = (key: string) => {
    const candidate = candidates.find(c => c.key === key); if (!candidate) return;
    setCandidates([]); props.onPickCandidates?.([]);
    if (candidate.target.type === 'pin') editor.choosePin(candidate.target.pin);
    else onSelect?.({ type: 'wire', id: candidate.target.id });
    container.current?.focus({ preventScroll: true });
  };
  const focusSelection = () => {
    if (selection?.type === 'part') camera.current?.focus({ parts: circuit.parts.filter(p => p.id === selection.id), wires: [] });
    if (selection?.type === 'wire') {
      const wire = circuit.wires.find(w => w.id === selection.id);
      if (wire) camera.current?.focus({ parts: circuit.parts.filter(p => p.id === wire.from.partId || p.id === wire.to.partId), wires: [wire] });
    }
  };
  useImperativeHandle(ref, () => ({
    fit: () => camera.current?.fit(), setView: view => camera.current?.setView(view),
    pan: (x, y) => camera.current?.pan(x, y), zoom: factor => camera.current?.zoom(factor), orbit: (x, y) => camera.current?.orbit(x, y),
    getCameraState: () => camera.current?.snapshot(), restoreCamera: state => camera.current?.restore(state), focusSelection,
    setNavigationTool: tool => { cancel(); setNavigationTool(tool); }, cancelInteraction: cancel,
    choosePin: editor.choosePin, chooseCandidate, addWireBend: editor.addWireBend,
    beginReconnect: (id, end) => { onSelect?.({ type: 'wire', id }); editor.beginReconnect(id, end); },
    beginPlacement: id => { onSelect?.({ type: 'part', id }); editor.beginPlacement(id); },
    previewPlacement: editor.previewPlacement, commitPlacement: editor.commitPlacement,
    beginRouteEdit: id => { onSelect?.({ type: 'wire', id }); editor.beginRouteEdit(id); },
    insertBend: editor.insertBend, moveBend: editor.moveBend,
    removeBend: editor.removeBend, moveSegment: editor.moveSegment, commitRoute: editor.commitRoute, deleteWire: editor.deleteWire,
    projectPin: pin => { const point = resolvePin(liveRef.current, registry, pin); return point && project(point); },
    capture: (pixelRatio = 2) => {
      const r = root.current; if (!r || r.gl.getContext().isContextLost()) return;
      const previous = r.gl.getPixelRatio();
      try {
        const ratio = Number.isFinite(pixelRatio) ? Math.max(1, Math.min(3, pixelRatio)) : 2;
        r.gl.setPixelRatio(ratio); r.gl.render(r.scene, r.camera);
        return r.gl.domElement.toDataURL('image/png');
      } catch (error) { onError?.(error instanceof Error ? error : new Error(String(error))); return; }
      finally { r.gl.setPixelRatio(previous); r.invalidate(); }
    },
  }));
  const pointInCanvas = (event: { clientX: number; clientY: number }) => {
    const rect = root.current!.gl.domElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const setRay = (event: { clientX: number; clientY: number }) => {
    const r = root.current!, p = pointInCanvas(event);
    r.raycaster.setFromCamera(new Vector2(p.x / r.size.width * 2 - 1, 1 - p.y / r.size.height * 2), r.camera);
    return r.raycaster;
  };
  const pointOnPlane = (event: { clientX: number; clientY: number }, height: number): Vec3 | undefined => {
    const p = setRay(event).ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -height), new Vector3());
    return p && Number.isFinite(p.length()) ? [p.x, height, p.z] : undefined;
  };
  const partAt = (event: { clientX: number; clientY: number }) => {
    for (const hit of setRay(event).intersectObjects(root.current!.scene.children, true)) {
      let object: typeof hit.object | null = hit.object;
      while (object) {
        if (typeof object.userData.partId === 'string') return circuit.parts.find(p => p.id === object!.userData.partId);
        object = object.parent;
      }
    }
  };
  const wirePicking = navigationTool === 'wire' || editor.state.kind === 'wire' || editor.state.kind === 'reconnect';
  const candidatesAt = (event: { clientX: number; clientY: number }) => pickCandidates(liveRef.current, registry, root.current!.camera,
    root.current!.size, pointInCanvas(event), { pins: wirePicking, wires: !wirePicking, radius: props.largerTargets ? 22 : 12 });
  const acceptCandidates = (items: readonly PickCandidate[]) => {
    if (items.length > 1) { setCandidates(items); props.onPickCandidates?.(items); return true; }
    if (items.length === 1) {
      const target = items[0].target;
      if (target.type === 'pin') editor.choosePin(target.pin); else onSelect?.({ type: 'wire', id: target.id });
      return true;
    }
    return false;
  };
  const isCanvas = (event: ReactPointerEvent<HTMLDivElement>) => event.target === root.current?.gl.domElement;
  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isCanvas(event) || !root.current || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    container.current?.focus({ preventScroll: true });
    if (navigationTool === 'pan' || navigationTool === 'orbit') return;
    event.stopPropagation();
    if (contextLost || editor.current.current.kind === 'pending' || gesture.current) return;
    setCandidates([]);
    const part = partAt(event), start = pointInCanvas(event);
    gesture.current = { pointerId: event.pointerId, start, moved: false };
    root.current.gl.domElement.setPointerCapture(event.pointerId);
    if (editor.current.current.kind !== 'idle') return;
    if (navigationTool === 'move' && part && !part.locked) {
      const p = pointOnPlane(event, part.position[1]);
      gesture.current.part = part;
      gesture.current.offset = p ? new Vector3(...p).sub(new Vector3(...part.position)) : new Vector3();
      onSelect?.({ type: 'part', id: part.id }); editor.beginPlacement(part.id);
    }
    if (navigationTool === 'interact' && part) {
      onSelect?.({ type: 'part', id: part.id });
      const action = registry[part.kind]?.input;
      if (action === 'momentary') { pressing.current = part.id; setPressedId(part.id); onInputChange?.({ partId: part.id, property: 'pressed', value: true }); }
      if (action === 'analogue') onInputChange?.({ partId: part.id, property: 'value', value: Math.min(1, (snapshot?.parts?.[part.id]?.value ?? 0) + 0.1) });
    }
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isCanvas(event) || !root.current || contextLost) return;
    const g = gesture.current, state = editor.current.current;
    if (g && g.pointerId !== event.pointerId) return;
    if (g && exceedsThreshold(g.start, pointInCanvas(event))) g.moved = true;
    if (navigationTool === 'pan' || navigationTool === 'orbit') return;
    event.stopPropagation();
    if (state.kind === 'placement') {
      const part = circuit.parts.find(p => p.id === state.partId);
      const point = part && pointOnPlane(event, part.position[1]);
      if (point && (!g?.part || g.moved)) {
        const p = new Vector3(...point).sub(g?.offset ?? new Vector3()); editor.previewPlacement([p.x, part!.position[1], p.z]);
      }
    }
    if (wirePicking) {
      const hits = candidatesAt(event), pin = hits.length === 1 && hits[0].target.type === 'pin' ? hits[0].target.pin : null;
      setHoverPin(pin); onPinHover?.(pin);
      const source = state.kind === 'wire' ? resolvePin(circuit, registry, state.source) : undefined;
      const point = pin ? resolvePin(circuit, registry, pin) : pointOnPlane(event, Math.max(3, source?.[1] ?? 3));
      if (point) setCursorPoint(point);
    }
    if (routeHandle) { const point = pointOnPlane(event, routeHandle.origin[1]); if (point) setCursorPoint(snapPosition(point, snap)); }
  };
  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId || !root.current) return;
    event.stopPropagation(); releaseCapture(); release();
    const state = editor.current.current;
    if (g.moved) { if (g.part && state.kind === 'placement') editor.commitPlacement(); return; }
    if (state.kind === 'placement') { if (!g.part) editor.commitPlacement(); return; }
    if (state.kind === 'route') {
      if (routeHandle) {
        const p = pointOnPlane(event, routeHandle.origin[1]);
        if (p) {
          const next = snapPosition(p, snap);
          if (routeHandle.kind === 'bend') editor.moveBend(routeHandle.index, next);
          else editor.moveSegment(routeHandle.index, [next[0] - routeHandle.origin[0], next[1] - routeHandle.origin[1], next[2] - routeHandle.origin[2]]);
        }
        setRouteHandle(null); setCursorPoint(null);
      }
      return;
    }
    if (navigationTool === 'interact') return;
    if (acceptCandidates(candidatesAt(event))) return;
    if (state.kind === 'wire') { const p = pointOnPlane(event, Math.max(3, resolvePin(circuit, registry, state.source)?.[1] ?? 3)); if (p) editor.addWireBend(p); return; }
    if (state.kind === 'reconnect') return;
    const part = partAt(event); onSelect?.(part ? { type: 'part', id: part.id } : null);
  };
  const wire = selection?.type === 'wire' ? liveCircuit.wires.find(w => w.id === selection.id) : undefined;
  const from = wire && resolvePin(liveCircuit, registry, wire.from), to = wire && resolvePin(liveCircuit, registry, wire.to);
  const state = editor.state;
  const draftSource = state.kind === 'wire' ? state.source : state.kind === 'reconnect' ? circuit.wires.find(w => w.id === state.wireId)?.[state.end === 'from' ? 'to' : 'from'] : undefined;
  const draftFrom = draftSource && resolvePin(circuit, registry, draftSource);
  const routePoints = wire && from && to ? [from, ...(wire.waypoints ?? []), to] : [];
  const controlStyle: CSSProperties = { color: theme.foreground, background: theme.surface, border: `1px solid ${theme.foreground}`, borderRadius: 6, padding: '6px 9px', minHeight: props.largerTargets ? 44 : 30, font: 'inherit', cursor: 'pointer' };
  const marker = (point: Vec3, label: string, onClick: () => void, square = false) => {
    const p = project(point); if (!p) return null;
    const diameter = props.largerTargets ? 36 : 24;
    return <button key={label} title={label} aria-label={label} onClick={onClick} style={{ ...controlStyle, position: 'absolute', left: p.x - diameter / 2, top: p.y - diameter / 2, width: diameter, height: diameter, minHeight: diameter, padding: 0, borderRadius: square ? 3 : '50%', border: `2px solid ${theme.foreground}`, background: theme.surface }}>{square ? '+' : '○'}</button>;
  };
  const advancedEnabled = !!props.onCommand && props.projectRevision !== undefined;
  const fallback = props.fallback ?? <div role="alert" style={{ padding: 24, color: theme.foreground }}>The 3D viewport could not start. Enable WebGL and hardware acceleration, then reopen this view.</div>;
  return <div ref={container} className={className} role="region" aria-label={ariaLabel} tabIndex={0}
    style={{ position: 'relative', width: '100%', height: '100%', minHeight: 240, background: theme.background, color: theme.foreground, overflow: 'hidden', font: `${12 * (props.labelScale ?? 1)}px system-ui`, ...style }}
    onPointerDownCapture={onDown} onPointerMoveCapture={onMove} onPointerUpCapture={onUp}
    onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current) cancel(); }}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        // Release held gestures, but let a keyboard pin picker outside the canvas
        // finish a click-based draft. Window blur still cancels the entire draft.
        if (gesture.current || pressing.current) cancel(); else camera.current?.cancel();
      }
    }}
    onKeyUp={event => { if (event.key === ' ' && pressing.current) { event.preventDefault(); release(); } }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); cancel(); container.current?.focus({ preventScroll: true }); return; }
      if (!container.current || !isViewportShortcut(event, container.current)) return;
      const key = event.key.toLowerCase();
      const views = { '1': 'isometric', '2': 'top', '3': 'front' } as const;
      if (key === 'f') { event.preventDefault(); camera.current?.fit(); }
      if (key in views) { event.preventDefault(); camera.current?.setView(views[key as keyof typeof views]); }
      if (key === '+' || key === '=') { event.preventDefault(); camera.current?.zoom(1.2); }
      if (key === '-') { event.preventDefault(); camera.current?.zoom(1 / 1.2); }
      if (key === 'enter' && state.kind === 'placement') { event.preventDefault(); editor.commitPlacement(); }
      if (key === 'enter' && state.kind === 'route') { event.preventDefault(); editor.commitRoute(); }
      const d: Record<string, Vec3> = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 0, -1], ArrowDown: [0, 0, 1] };
      const delta = d[event.key], step = (snap > 0 ? snap : 1) * (event.shiftKey ? 10 : 1);
      const part = selection?.type === 'part' ? circuit.parts.find(p => p.id === selection.id) : undefined;
      if (navigationTool === 'interact' && part && state.kind === 'idle') {
        const action = registry[part.kind]?.input;
        if (key === ' ' && action === 'momentary') {
          event.preventDefault();
          if (!pressing.current) { pressing.current = part.id; setPressedId(part.id); onInputChange?.({ partId: part.id, property: 'pressed', value: true }); }
        }
        if (delta && action === 'analogue') {
          event.preventDefault(); const direction = delta[0] || -delta[2];
          onInputChange?.({ partId: part.id, property: 'value', value: Math.max(0, Math.min(1, (snapshot?.parts?.[part.id]?.value ?? 0) + direction * 0.1)) });
        }
        return;
      }
      if (navigationTool === 'move' && part && !part.locked && state.kind === 'idle') {
        if (key === 'r') { event.preventDefault(); void editor.commit({ type: 'part.rotate', id: part.id, radians: (part.rotation ?? 0) + Math.PI / 2 }); }
        if (delta) { event.preventDefault(); void editor.commit({ type: 'part.move', id: part.id, position: [part.position[0] + delta[0] * step, part.position[1], part.position[2] + delta[2] * step] }); }
      } else if (delta && state.kind === 'placement') {
        event.preventDefault(); editor.previewPlacement([state.position[0] + delta[0] * step, state.position[1], state.position[2] + delta[2] * step]);
      } else if (delta && state.kind === 'route' && routeHandle) {
        event.preventDefault(); const offset: Vec3 = [delta[0] * step, 0, delta[2] * step];
        if (routeHandle.kind === 'bend') {
          const p = state.waypoints[routeHandle.index]; if (p) editor.moveBend(routeHandle.index, [p[0] + offset[0], p[1], p[2] + offset[2]]);
        } else { editor.moveSegment(routeHandle.index, offset); setRouteHandle(null); }
      } else if (delta && state.kind === 'idle') {
        event.preventDefault(); if (navigationTool === 'orbit') camera.current?.orbit(delta[0] * 16, delta[2] * 16); else camera.current?.pan(delta[0] * 30, delta[2] * 30);
      }
    }}>
    <RenderBoundary fallback={fallback} onError={onError}>
      <Canvas orthographic camera={{ position: [0, 400, 0.001], near: 0.1, far: 5000, zoom: 3 }} frameloop="demand"
        dpr={qualityProfiles[quality].dpr} shadows={quality === 'draft' ? false : { type: PCFSoftShadowMap }}
        gl={{ antialias: true, alpha: false, powerPreference: 'default', toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
        fallback={fallback} onCreated={r => { root.current = r; r.gl.toneMappingExposure = 1; }}>
        <CameraRig circuit={liveCircuit} registry={registry} onAPI={setCameraAPI} disabled={state.kind !== 'idle' || !!pressedId || contextLost}
          mode={navigationTool} navigation={props.navigation} initialState={cameraState.current} onChange={onCameraChange}/>
        <StudioEnvironment/>
        <Lifecycle onReady={onReady} onStats={onStats} onContextLost={lost => {
          setContextLost(lost);
          if (lost) { cancel(); props.onFeedback?.({ code: 'context-lost', message: 'Graphics paused while the context recovers.', entityIds: [], recovery: 'Wait for recovery, or reopen the 3D view.' }); }
          else { if (cameraState.current) camera.current?.restore(cameraState.current); redraw(n => n + 1); }
        }}/>
        <Workbench theme={theme} grid={showGrid} quality={quality}/>
        {liveCircuit.parts.map(part => <PartModel key={part.id} part={part} definition={registry[part.kind]}
          state={pressedId === part.id ? { ...snapshot?.parts?.[part.id], pressed: true } : snapshot?.parts?.[part.id] ?? {}}
          selected={selection?.type === 'part' && selection.id === part.id} labels={showLabels} wireMode={wirePicking} theme={theme} labelScale={props.labelScale}/>) }
        {liveCircuit.wires.map(w => {
          const a = resolvePin(liveCircuit, registry, w.from), b = resolvePin(liveCircuit, registry, w.to);
          return a && b ? <WireModel key={w.id} wire={w} from={a} to={b} accent={theme.accent} foreground={theme.foreground} segments={qualityProfiles[quality].segments}
            selected={(selection?.type === 'wire' && selection.id === w.id) || props.highlightedWireIds?.includes(w.id)} active={snapshot?.activeWireIds?.includes(w.id)}
            dimmed={!!props.isolateSelectedWire && selection?.type === 'wire' && selection.id !== w.id}/> : null;
        })}
        {draftSource && draftFrom && cursorPoint && <WireModel wire={{ id: 'draft', from: draftSource, to: draftSource, color: theme.accent, waypoints: state.kind === 'wire' ? state.waypoints : [] }} from={draftFrom} to={cursorPoint} segments={32} accent={theme.accent} preview/>}
      </Canvas>
    </RenderBoundary>
    {props.showNavigationControls !== false && <div role="group" aria-label="Viewport navigation" style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', flexWrap: 'wrap', gap: 4, pointerEvents: 'none' }}>
      {(['inspect', 'pan', 'orbit'] as const).map(tool => <button key={tool} style={{ ...controlStyle, pointerEvents: 'auto', fontWeight: navigationTool === tool ? 800 : 400 }} aria-pressed={navigationTool === tool} onClick={() => { cancel(); setNavigationTool(tool); }}>{tool === 'inspect' ? 'Select' : tool === 'pan' ? 'Pan' : 'Orbit'}</button>)}
      <button style={{ ...controlStyle, pointerEvents: 'auto' }} aria-label="Zoom in" onClick={() => camera.current?.zoom(1.2)}>+</button>
      <button style={{ ...controlStyle, pointerEvents: 'auto' }} aria-label="Zoom out" onClick={() => camera.current?.zoom(1 / 1.2)}>−</button>
      <button style={{ ...controlStyle, pointerEvents: 'auto' }} onClick={() => camera.current?.fit()}>Fit</button>
      <button style={{ ...controlStyle, pointerEvents: 'auto' }} onClick={() => camera.current?.setView('top')}>Top</button>
    </div>}
    {showLabels && liveCircuit.wires.filter(w => w.label).map(w => {
      const a = resolvePin(liveCircuit, registry, w.from), b = resolvePin(liveCircuit, registry, w.to);
      const p = a && b && project(w.waypoints?.[0] ?? [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 10, (a[2] + b[2]) / 2]);
      return p ? <span key={w.id} style={{ position: 'absolute', left: p.x, top: p.y, padding: '2px 5px', border: `1px solid ${theme.foreground}`, background: theme.surface, pointerEvents: 'none', maxWidth: 180, overflowWrap: 'anywhere' }}>{w.label}</span> : null;
    })}
    {hoverPin && (() => { const point = resolvePin(liveCircuit, registry, hoverPin), p = point && project(point); return p ? <span style={{ position: 'absolute', left: p.x + 14, top: p.y + 10, background: theme.surface, padding: 6, border: `1px solid ${theme.foreground}`, pointerEvents: 'none' }}>{hoverPin.partId} / {hoverPin.pinId}{snapshot?.pins?.[pinKey(hoverPin)]?.voltage !== undefined ? ` · ${snapshot.pins[pinKey(hoverPin)].voltage!.toFixed(2)} V` : ''}</span> : null; })()}
    {wire && from && to && advancedEnabled && state.kind === 'idle' && <>
      {marker(from, `Reconnect ${wire.id} source`, () => editor.beginReconnect(wire.id, 'from'))}
      {marker(to, `Reconnect ${wire.id} destination`, () => editor.beginReconnect(wire.id, 'to'))}
    </>}
    {state.kind === 'route' && routePoints.map((p, i) => i > 0 && i < routePoints.length - 1 ? marker(p, `Move bend ${i}`, () => { setRouteHandle({ kind: 'bend', index: i - 1, origin: p }); container.current?.focus(); }, true) : null)}
    {state.kind === 'route' && routePoints.slice(1).map((p, i) => {
      const a = routePoints[i], mid: Vec3 = [(a[0] + p[0]) / 2, (a[1] + p[1]) / 2, (a[2] + p[2]) / 2];
      return marker(mid, `Move segment ${i + 1}`, () => { setRouteHandle({ kind: 'segment', index: i, origin: mid }); container.current?.focus(); }, true);
    })}
    {routeHandle && cursorPoint && (() => { const p = project(cursorPoint); return p ? <span aria-hidden="true" style={{ position: 'absolute', left: p.x - 6, top: p.y - 6, width: 12, height: 12, border: `2px dashed ${theme.foreground}`, pointerEvents: 'none' }}/> : null; })()}
    <div style={{ position: 'absolute', left: 8, bottom: 8, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, pointerEvents: 'none' }}>
      {candidates.length > 0 && <div role="group" aria-label="Overlapping targets" style={{ background: theme.surface, border: `1px solid ${theme.foreground}`, padding: 8, maxHeight: 180, overflowY: 'auto', maxWidth: '100%', pointerEvents: 'auto' }}>
        <div>Choose the intended target ({candidates.length})</div>
        {candidates.map(c => <button key={c.key} style={{ ...controlStyle, display: 'block', width: '100%', textAlign: 'left', marginTop: 4 }} onClick={() => chooseCandidate(c.key)}>{c.label}</button>)}
      </div>}
      {wire && advancedEnabled && (state.kind === 'idle' || state.kind === 'route') && <div role="group" aria-label="Selected wire editing" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, pointerEvents: 'auto' }}>
        {state.kind === 'idle' ? <>
          <button style={controlStyle} onClick={() => editor.beginReconnect(wire.id, 'from')}>Reconnect source</button>
          <button style={controlStyle} onClick={() => editor.beginReconnect(wire.id, 'to')}>Reconnect destination</button>
          <button style={controlStyle} onClick={() => editor.beginRouteEdit(wire.id)}>Edit bends</button>
          <button style={controlStyle} onClick={() => editor.deleteWire(wire.id)}>Delete wire</button>
        </> : <>
          <button style={controlStyle} onClick={() => { if (from && to) editor.insertBend(state.waypoints.length, [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 10, (from[2] + to[2]) / 2]); }}>Add bend</button>
          <button style={controlStyle} disabled={routeHandle?.kind !== 'bend'} onClick={() => { if (routeHandle?.kind === 'bend') { editor.removeBend(routeHandle.index); setRouteHandle(null); } }}>Remove bend</button>
          <button style={controlStyle} onClick={() => editor.commitRoute()}>Apply route</button>
        </>}
      </div>}
      {(wirePicking || state.kind !== 'idle') && <div role="status" style={{ background: theme.surface, border: `1px solid ${theme.foreground}`, padding: '7px 10px', pointerEvents: 'auto' }}>
        {state.kind === 'wire' ? `From ${state.source.partId} / ${state.source.pinId} · ${state.waypoints.length} bends · choose a destination or add a bend` : state.kind === 'reconnect' ? `Reconnect ${state.wireId} ${state.end} · choose a destination pin` : state.kind === 'placement' ? 'Click a position or use arrows and Enter to place' : state.kind === 'route' ? 'Choose a bend or segment, then click a position or use arrows. Apply commits once.' : state.kind === 'pending' ? 'Waiting for host validation' : 'Choose a component pin to begin wiring'}
        {state.kind !== 'idle' && state.kind !== 'pending' && <button style={{ ...controlStyle, marginLeft: 8 }} onClick={cancel}>Cancel</button>}
      </div>}
      {editor.feedback && <div role="alert" style={{ background: theme.surface, border: `1px solid ${theme.foreground}`, padding: 8 }}>{editor.feedback.message} {editor.feedback.recovery}</div>}
      {contextLost && <div role="status" style={{ background: theme.surface, padding: 8 }}>Graphics context lost. Waiting for recovery; the project and camera are retained.</div>}
    </div>
  </div>;
});

function Lifecycle({ onReady, onStats, onContextLost }: Pick<CircuitViewportProps, 'onReady' | 'onStats'> & { onContextLost: (lost: boolean) => void }) {
  const { gl, scene, camera, invalidate } = useThree();
  const callbacks = useRef({ onReady, onStats, onContextLost }); callbacks.current = { onReady, onStats, onContextLost };
  const ready = useRef(false), frames = useRef(0);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); callbacks.current.onContextLost(true); };
    const restored = () => { callbacks.current.onContextLost(false); invalidate(); };
    gl.domElement.addEventListener('webglcontextlost', lost); gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => { gl.domElement.removeEventListener('webglcontextlost', lost); gl.domElement.removeEventListener('webglcontextrestored', restored); };
  }, [gl, invalidate]);
  // Positive priority owns rendering so statistics describe this frame, not a prior shadow pass.
  useFrame(() => {
    if (gl.getContext().isContextLost()) return;
    const start = performance.now(); gl.render(scene, camera); frames.current++;
    if (!ready.current) { ready.current = true; callbacks.current.onReady?.(); }
    callbacks.current.onStats?.({ drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, pixelRatio: gl.getPixelRatio(),
      renderMs: performance.now() - start, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, renderedFrames: frames.current });
  }, 1);
  return null;
}
