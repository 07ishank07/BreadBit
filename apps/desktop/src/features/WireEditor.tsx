import { useEffect, useState } from 'react';
import type { Wire } from '../../../../packages/project-core/src';
import type { ProjectController } from '../integrations/project';
import { commitWire, endpoint, pinsFor, deleteSelected, validateWire, endpointKey } from '../integrations/editing';
import type { Point, SheetLayout } from '../integrations/schematic';
import { Dialog } from './Dialog';
export interface WireSeed {
    start?: string;
    end?: string;
    bends?: Point[];
}
export function WireEditor({ controller, notify, seed, schematic = false, selectedWire, onSelect }: {
    controller: ProjectController;
    notify: (s: string) => void;
    seed?: WireSeed;
    schematic?: boolean;
    selectedWire?: string;
    onSelect?: (id: string) => void;
}) {
    const doc = controller.project.document, parts = [...doc.boards.map(b => ({ id: b.id, kind: b.boardKind })), ...doc.components.map(c => ({ id: c.id, kind: c.metadataId }))];
    const [id, setId] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [color, setColor] = useState('#35a66c'), [label, setLabel] = useState(''), [bends, setBends] = useState<Point[]>([]), [review, setReview] = useState<{
        wire: Wire;
        revision: number;
    } | null>(null), [route, setRoute] = useState('direct');
    const [version, setVersion] = useState(0);
    useEffect(() => { const t = setTimeout(() => setVersion(n => n + 1), 350); return () => clearTimeout(t); }, [parts.map(p => p.id).join('|')]);
    void version;
    const choices = parts.flatMap(p => pinsFor(p.id).map(pin => ({ value: JSON.stringify([p.id, pin]), text: p.id + ':' + pin })));
    useEffect(() => { if (!seed)
        return; setId(''); setStart(seed.start ?? ''); setEnd(seed.end ?? ''); setBends(seed.bends ?? []); setLabel(''); }, [seed]);
    function pick(wireId: string) { const w = doc.wires.find(w => w.id === wireId); setId(w?.id ?? ''); setStart(w ? JSON.stringify([w.start.componentId, w.start.pinName]) : ''); setEnd(w ? JSON.stringify([w.end.componentId, w.end.pinName]) : ''); setColor(w?.color ?? '#35a66c'); setLabel(String(w?.label ?? '')); setBends(w ? structuredClone(schematic ? ((doc.schematic as SheetLayout | undefined)?.routes?.[w.id] ?? []) : w.waypoints) : []); }
    useEffect(() => { if (selectedWire !== undefined)
        pick(selectedWire); }, [selectedWire, controller.project.revision]);
    function apply(wire: Wire) { try {
        let electrical=true;
        if (schematic) {
            validateWire(controller.project.document, wire);
            endpoint(wire.start.componentId, wire.start.pinName);
            endpoint(wire.end.componentId, wire.end.pinName);
            const previous = controller.project.document.wires.find(w => w.id === wire.id);
            const routeOnly = previous && endpointKey(previous.start) === endpointKey(wire.start) && endpointKey(previous.end) === endpointKey(wire.end) && previous.color === wire.color && String(previous.label ?? '') === String(wire.label ?? '') && JSON.stringify(previous.waypoints) === JSON.stringify(wire.waypoints);
            electrical=!routeOnly;
            const change = routeOnly ? controller.presentation.bind(controller) : controller.updateDocument.bind(controller);
            change(routeOnly ? 'Route schematic wire' : id ? 'Edit schematic connection' : 'Connect schematic pins', d => { d.wires = [...d.wires.filter(w => w.id !== wire.id), wire]; const layout = (d.schematic ?? {}) as SheetLayout; d.schematic = { ...layout, routes: { ...layout.routes, [wire.id]: bends } }; });
        }
        else
            commitWire(controller, wire, id ? 'Edit wire' : 'Connect pins');
        setId(wire.id);
        onSelect?.(wire.id);
        setReview(null);
        notify(electrical?'Connection saved. Simulation stopped for electrical edits.':'Schematic route saved. Simulation continues unchanged.');
    }
    catch (e) {
        notify(String(e));
    } }
    function submit() { try {
        controller.flush();
        if(bends.length>200||bends.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||(schematic&&(p.x<0||p.y<0||p.x>20000||p.y>20000))))throw new Error('Use at most 200 finite bends; schematic coordinates must be between 0 and 20000.');
        if (!start || !end)
            throw new Error('Choose source and destination pins.');
        const [a, ap] = JSON.parse(start), [b, bp] = JSON.parse(end);
        const old = doc.wires.find(w => w.id === id);
        const wire: Wire = { ...old, id: id || crypto.randomUUID(), start: endpoint(a, ap), end: endpoint(b, bp), color, label, waypoints: schematic ? (old?.waypoints ?? []) : bends };
        if (schematic) {
            setRoute('direct');
            setReview({ wire, revision: controller.project.revision });
        }
        else
            apply(wire);
    }
    catch (e) {
        notify(String(e));
    } }
    return <section className="bb-wire-editor" aria-label="Wire editor" onKeyDown={e => { if (e.key === 'Escape') {
        pick('');
        notify('Wire draft cancelled.');
    } }}><h2>Connections</h2><label>Wire<select value={id} onChange={e => { pick(e.target.value); onSelect?.(e.target.value); }}><option value="">New connection</option>{doc.wires.map(w => <option key={w.id} value={w.id}>{String(w.label || w.id.slice(0, 8))} · {w.start.componentId}:{w.start.pinName} → {w.end.componentId}:{w.end.pinName}</option>)}</select></label>
 {(['Source', 'Destination'] as const).map((name, i) => <label key={name}>{name} pin<select aria-label={name+' pin'} value={i ? end : start} onChange={e => (i ? setEnd : setStart)(e.target.value)}><option value="">Choose a mapped pin</option>{choices.map(p => <option key={p.value} value={p.value}>{p.text}</option>)}</select></label>)}
 <p className="bb-subtle">Pins come from the simulator’s component definitions. A wire joins exactly the two selected pins.</p><label>Label<input value={label} maxLength={100} onChange={e => setLabel(e.target.value)}/></label><label>Color<input type="color" value={color} onChange={e => setColor(e.target.value)}/></label>
 <details><summary>{schematic ? 'Schematic' : 'Physical 2D'} bends · {bends.length}</summary><p>Enter coordinates or use the schematic canvas. Physical bends also appear in the current 3D adapter.</p>{bends.map((p, i) => <div className="bb-row" key={i}>{(['x', 'y'] as const).map(axis => <label key={axis}>{axis}<input aria-label={'Bend ' + (i + 1) + ' ' + axis} type="number" value={p[axis]} onChange={e => setBends(old => old.map((v, j) => j === i ? { ...v, [axis]: Number(e.target.value) } : v))}/></label>)}<button onClick={() => setBends(old => old.filter((_, j) => i !== j))}>Remove {i + 1}</button></div>)}<button onClick={() => setBends(old => [...old, { x: 200, y: 200 }])}>Add bend</button></details>
 <div className="bb-row"><button onClick={submit}> {schematic ? 'Review connection' : 'Apply connection'}</button><button onClick={() => pick('')}>Cancel draft</button>{id && <button onClick={() => { try {
        deleteSelected(controller, { type: 'wire', id });
        pick('');
        notify('Wire deleted. Undo restores it.');
    }
    catch (e) {
        notify(String(e));
    } }}>Delete wire</button>}</div>
 {review && <Dialog title="Review physical connection" close={() => setReview(null)}><p>{review.wire.start.componentId}:{review.wire.start.pinName} → {review.wire.end.componentId}:{review.wire.end.pinName}</p><p>Both physical endpoints are explicitly selected. Choose a wire route before applying. This does not automatically place parts into breadboard holes.</p><label>Physical route<select value={route} onChange={e => setRoute(e.target.value)}><option value="direct">Keep existing bends / direct</option><option value="above">Route above the endpoints</option><option value="below">Route below the endpoints</option></select></label><svg viewBox="0 0 300 100" role="img" aria-label={'Preview: ' + route + ' wire route'}><path d={route === 'above' ? 'M25 50 V20 H275 V50' : route === 'below' ? 'M25 50 V80 H275 V50' : 'M25 50 H275'} fill="none" stroke="currentColor" strokeWidth="3"/><circle cx="25" cy="50" r="6"/><circle cx="275" cy="50" r="6"/></svg><p>Applying stops simulation. Cancel leaves the project unchanged.</p><button onClick={() => { controller.flush(); if (controller.project.revision !== review.revision) {
        notify('Project changed during review. Cancel and review again.');
        return;
    } const w = structuredClone(review.wire); if (route !== 'direct') {
        const y = route === 'above' ? Math.min(w.start.y, w.end.y) - 80 : Math.max(w.start.y, w.end.y) + 80;
        w.waypoints = [{ x: w.start.x, y }, { x: w.end.x, y }];
    } apply(w); }}>Apply reviewed connection</button></Dialog>}
 </section>;
}
