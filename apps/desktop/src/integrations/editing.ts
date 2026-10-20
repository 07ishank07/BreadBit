import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import { readPinInfo } from '@velxio/utils/readPinInfo';
import type { Endpoint, Wire, VlxPayload } from '../../../../packages/project-core/src';
import type { ProjectController } from './project';
export type Selected = {
    type: 'part' | 'wire';
    id: string;
} | null;
export const endpointKey = (p: Pick<Endpoint, 'componentId' | 'pinName'>) => JSON.stringify([p.componentId, p.pinName]);
export function pinsFor(id: string): string[] { return readPinInfo(document.getElementById(id))?.map(p => p.name) ?? []; }
export function endpoint(id: string, pin: string): Endpoint {
    const s = useSimulatorStore.getState(), part = s.boards.find(b => b.id === id) ?? s.components.find(c => c.id === id);
    if (!part || !pinsFor(id).includes(pin))
        throw new Error('Pin is unavailable or not mapped: ' + id + ':' + pin);
    return { componentId: id, pinName: pin, x: part.x, y: part.y };
}
export function validateWire(doc: VlxPayload, wire: Wire) {
    if (endpointKey(wire.start) === endpointKey(wire.end))
        throw new Error('Choose two different pins');
    if (doc.wires.some(w => w.id !== wire.id && ((endpointKey(w.start) === endpointKey(wire.start) && endpointKey(w.end) === endpointKey(wire.end)) || (endpointKey(w.end) === endpointKey(wire.start) && endpointKey(w.start) === endpointKey(wire.end)))))
        throw new Error('That connection already exists');
    if (wire.waypoints.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
        throw new Error('Bend coordinates must be finite');
}
export function commitWire(controller: ProjectController, wire: Wire, label = 'Edit wire') {
    controller.flush();
    validateWire(controller.project.document, wire);
    endpoint(wire.start.componentId, wire.start.pinName);
    endpoint(wire.end.componentId, wire.end.pinName);
    controller.commit(label, () => { const s = useSimulatorStore.getState(); for (const b of s.boards)
        if (b.running)
            s.stopBoard(b.id); s.setWires([...s.wires.filter(w => w.id !== wire.id), wire]); });
    requestAnimationFrame(() => useSimulatorStore.getState().recalculateAllWirePositions());
}
export function deleteSelected(controller: ProjectController, selection: Selected) {
    if (!selection)
        return;
    const s = useSimulatorStore.getState();
    if (selection.type === 'part' && s.boards.some(b => b.id === selection.id))
        throw new Error('Use the board controls in2D to remove its firmware group.');
    controller.commit('Delete ' + selection.type, () => { for (const b of s.boards)
        if (b.running)
            s.stopBoard(b.id); if (selection.type === 'wire')
        s.removeWire(selection.id);
    else {
        s.setWires(s.wires.filter(w => w.start.componentId !== selection.id && w.end.componentId !== selection.id));
        s.removeComponent(selection.id);
    } });
}
