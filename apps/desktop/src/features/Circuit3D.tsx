import { useEffect, useMemo, useRef, useState } from 'react';
import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import { rendererCommands } from '../integrations/rendererCommands';
import type { Selected } from '../integrations/editing';
import { CircuitViewport, adaptVelxioScene, type CircuitViewportHandle, type InteractionMode, type Selection, type SimulationSnapshot, type CameraState } from '../../../../packages/circuit-renderer/src';
import { layoutScale } from '../integrations/scene';
import type { ProjectController } from '../integrations/project';
type LiveElement = HTMLElement & {
    brightness?: number;
    pressed?: boolean;
    value?: number;
    angle?: number;
};
export default function Circuit3D({ controller, notify, selection, setSelection, largerTargets = false, reducedMotion = false }: {
    controller: ProjectController;
    notify: (message: string) => void;
    selection: Selected;
    setSelection: (s: Selected) => void;
    largerTargets?: boolean;
    reducedMotion?: boolean;
}) {
    const boards = useSimulatorStore(s => s.boards), components = useSimulatorStore(s => s.components), wires = useSimulatorStore(s => s.wires);
    const scene = useMemo(() => adaptVelxioScene({ boards, components: components.map(c => ({ ...c, rotation: Number(c.properties?.rotation) || 0 })), wires }, { mmPerPixel: layoutScale }), [boards, components, wires]);
    const project = controller.project;
    const circuit = { ...scene.circuit, wires: scene.circuit.wires.map(w => {
        const saved = project.document.wires.find(item => item.id === w.id);
        const route = saved?.route3d;
        return { ...w, ...(Array.isArray(route) && route.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) ? { waypoints: route as [number, number, number][] } : {}), label: typeof saved?.label === 'string' ? saved.label : undefined };
    }) };
    const sceneRef = useRef(circuit); sceneRef.current = circuit;
    const dispatch = useMemo(() => rendererCommands(controller, () => sceneRef.current), [controller, project.id]);
    const cameraKey = 'breadbit.camera.' + project.id;
    const initialCamera = useMemo(() => { try { const c = JSON.parse(localStorage.getItem(cameraKey) ?? 'null'); return c && [c.target, c.position, c.up].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) && Number.isFinite(c.zoom) && c.zoom > 0 ? c as CameraState : undefined; } catch { return undefined; } }, [cameraKey]);
    const [scrollAction, setScrollAction] = useState<'pan' | 'zoom'>(() => localStorage.getItem('breadbit.3d.scroll') === 'zoom' ? 'zoom' : 'pan');
    const select = (value: Selection) => setSelection(value && value.type !== 'net' ? { type: value.type, id: value.id } : null);
    const viewport = useRef<CircuitViewportHandle>(null);
    const [mode, setMode] = useState<InteractionMode>('inspect');
    const [quality, setQuality] = useState<'draft' | 'balanced' | 'high'>('balanced');
    const [grid, setGrid] = useState(true), [labels, setLabels] = useState(true);
    const [snapshot, setSnapshot] = useState<SimulationSnapshot>({});
    useEffect(() => {
        const sample = () => {
            const parts: NonNullable<SimulationSnapshot['parts']> extends Readonly<infer T> ? T : never = {};
            for (const part of scene.circuit.parts) {
                const el = document.getElementById(part.id) as LiveElement | null;
                if (!el)
                    continue;
                parts[part.id] = {
                    ...(part.kind === 'led' && typeof el.brightness === 'number' ? { brightness: el.brightness } : {}),
                    ...(part.kind === 'servo' && typeof el.angle === 'number' ? { angle: el.angle } : {}),
                    ...(part.kind === 'pushbutton' ? { pressed: !!el.pressed } : {}),
                    ...(part.kind === 'potentiometer' ? { value: Number(el.value ?? 0) / 1023 } : {}),
                };
            }
            setSnapshot(old => JSON.stringify(old.parts) === JSON.stringify(parts) ? old : { parts });
        };
        sample();
        const timer = setInterval(sample, 80);
        return () => clearInterval(timer);
    }, [scene.circuit.parts]);
    function edit(label: string, change: () => void) {
        try {
            controller.flush();
            const store = useSimulatorStore.getState();
            for (const board of store.boards)
                if (board.running)
                    store.stopBoard(board.id);
            controller.commit(label, change);
            requestAnimationFrame(() => useSimulatorStore.getState().recalculateAllWirePositions());
            notify(label + ' · saved in project history. Simulation is stopped for circuit edits.');
        }
        catch (error) {
            notify(String(error));
        }
    }
    function remove() {
        if (!selection)
            return;
        if (selection.type === 'part' && boards.some(b => b.id === selection.id)) {
            notify('Remove boards in the 2D workspace to manage their firmware groups.');
            return;
        }
        edit('Deleted selection', () => {
            const s = useSimulatorStore.getState();
            if (selection.type === 'wire')
                s.removeWire(selection.id);
            else {
                s.setWires(s.wires.filter(w => w.start.componentId !== selection.id && w.end.componentId !== selection.id));
                s.removeComponent(selection.id);
            }
        });
        setSelection(null);
    }
    return <div className="bb-3d" onKeyDown={event => {
            // Prevent the hidden upstream canvas from acting on 3D selection keystrokes.
            event.stopPropagation();

        }}>
    <div className="bb-3d-tools" aria-label="3D tools">
      {(['inspect', 'move', 'wire', 'interact'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      <label>Two-finger scroll<select value={scrollAction} onChange={e => { const value = e.target.value as 'pan' | 'zoom'; setScrollAction(value); try { localStorage.setItem('breadbit.3d.scroll', value); } catch {} }}><option value="pan">Pan</option><option value="zoom">Zoom</option></select></label><button onClick={() => viewport.current?.fit()}>Fit</button>
      <select aria-label="3D camera" defaultValue="top" onChange={e => viewport.current?.setView(e.target.value as 'top' | 'front' | 'isometric')}><option value="isometric">Isometric</option><option value="top">Top</option><option value="front">Front</option></select>
      <select aria-label="3D quality" value={quality} onChange={e => setQuality(e.target.value as typeof quality)}><option value="draft">Draft quality</option><option value="balanced">Balanced quality</option><option value="high">High quality</option></select><label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)}/>Grid</label>
      <label><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/>Labels</label>
      <select aria-label="3D selection" value={selection ? selection.type + ':' + selection.id : ''} onChange={e => { const index = e.target.value.indexOf(':'); setSelection(index < 0 ? null : { type: e.target.value.slice(0, index) as 'part' | 'wire', id: e.target.value.slice(index + 1) }); }}><option value="">Select part or wire</option>{scene.circuit.parts.map(p => <option key={p.id} value={'part:' + p.id}>{p.id} ({p.kind})</option>)}{scene.circuit.wires.map(w => <option key={w.id} value={'wire:' + w.id}>Wire: {w.from.partId}:{w.from.pinId} → {w.to.partId}:{w.to.pinId}</option>)}</select>
      <button disabled={!selection} onClick={remove}>Delete selected</button>
      <button onClick={() => { const url = viewport.current?.capture(); if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'breadbit-circuit.png';
        a.click();
    } }}>Export PNG</button>
    </div>
    <div className="bb-3d-viewport"><CircuitViewport ref={viewport} quality={quality} circuit={circuit} snapshot={snapshot} mode={mode} selection={selection} onSelect={select} showGrid={grid} showLabels={labels} projectRevision={project.revision} onCommand={dispatch} onFeedback={f => notify(f.message + ' ' + f.recovery)} largerTargets={largerTargets} reducedMotion={reducedMotion} navigation={{ twoFingerAction: scrollAction, initialView: 'top' }} initialCameraState={initialCamera} onCameraChange={state => { try { localStorage.setItem(cameraKey, JSON.stringify(state)); } catch {} }} onInputChange={({ partId, property, value }) => {
            const el = document.getElementById(partId) as LiveElement | null;
            if (!el)
                return;
            if (property === 'pressed') {
                el.pressed = Boolean(value);
                el.dispatchEvent(new CustomEvent(value ? 'button-press' : 'button-release'));
            }
            else {
                el.value = Math.round(Number(value) * 1023);
                el.dispatchEvent(new Event('input'));
            }
        }} onError={error => notify('3D: ' + error.message + ' You can return to 2D.')}/></div>
    <div className="bb-3d-help">{mode === 'move' ? 'Drag to move · R rotates · arrows nudge · Shift = larger steps' : mode === 'interact' ? 'Hold buttons; click a potentiometer to step its input.' : mode === 'wire' ? 'Click a source pin, optional bends, then destination. Escape cancels.' : 'Use Pan or Orbit tools · two-finger scroll pans by default · Ctrl/⌘ + scroll zooms'} · F fits · 1/2/3 camera</div>
    <details className="bb-3d-help"><summary>Model limits{scene.warnings.length ? ' · ' + scene.warnings.length + ' warnings' : ''}</summary>Approximate visual scale. Add components in 2D. Unknown models use placeholders; unmapped wires are omitted visually but preserved in the project. OLED pixels and voltage measurements are not mirrored.{scene.warnings.map((w, i) => <div key={i}>{w}</div>)}</details>
  </div>;
}
