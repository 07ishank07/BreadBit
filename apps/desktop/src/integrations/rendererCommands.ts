import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import type { CircuitDocument, RendererCommand, CommandResult } from '../../../../packages/circuit-renderer/src';
import type { ProjectController } from './project';
import { endpoint, validateWire, commitWire } from './editing';
import { moveInLayout } from './scene';

/** One renderer gesture is one validated host transaction. Camera/drafts never enter history. */
export function rendererCommands(controller: ProjectController, scene: () => CircuitDocument) {
    const completed = new Map<string, CommandResult>();
    return (command: RendererCommand): CommandResult => {
        const prior = completed.get(command.actionId);
        if (prior) return prior;
        try {
            controller.flush();
            if (command.expectedRevision !== controller.project.revision) throw new Error('Project changed. Start this edit again.');
            const edit = command.edit, store = useSimulatorStore.getState();
            const wire = 'id' in edit ? controller.project.document.wires.find(w => w.id === edit.id) : undefined;
            if (edit.type.startsWith('wire.') && edit.type !== 'wire.create' && !wire) throw new Error('Wire no longer exists.');
            if ('waypoints' in edit && edit.waypoints.some(p => p.length !== 3 || !p.every(Number.isFinite))) throw new Error('Wire bends must have finite coordinates.');
            if (edit.type === 'wire.create') {
                const next = { id: crypto.randomUUID(), start: endpoint(edit.from.partId, edit.from.pinId), end: endpoint(edit.to.partId, edit.to.pinId), color: '#48bb78', waypoints: [], route3d: edit.waypoints.map(p => [...p]) };
                validateWire(controller.project.document, next);
                commitWire(controller, next, command.label);
            } else if (edit.type === 'wire.reconnect') {
                const next = { ...wire!, [edit.end === 'from' ? 'start' : 'end']: endpoint(edit.pin.partId, edit.pin.pinId) };
                commitWire(controller, next, command.label);
            } else if (edit.type === 'wire.route') {
                controller.commit(command.label, () => store.setWires(store.wires.map(w => w.id === edit.id ? { ...w, route3d: edit.waypoints.map(p => [...p]) } : w))); 
            } else {
                const part = 'id' in edit ? scene().parts.find(p => p.id === edit.id) : undefined;
                const host = 'id' in edit ? store.boards.find(p => p.id === edit.id) ?? store.components.find(p => p.id === edit.id) : undefined;
                if (edit.type !== 'wire.delete' && (!part || !host)) throw new Error('Component no longer exists.');
                if (edit.type === 'part.rotate' && !Number.isFinite(edit.radians)) throw new Error('Rotation must be finite.');
                const position = edit.type === 'part.move' ? moveInLayout(part!, edit.position, host!) : undefined;
                controller.commit(command.label, () => {
                    for (const board of store.boards) if (board.running) store.stopBoard(board.id);
                    if (edit.type === 'wire.delete') store.removeWire(edit.id);
                    else if (edit.type === 'part.move') {
                        if (store.boards.some(b => b.id === edit.id)) store.setBoardPosition(position!, edit.id);
                        else { store.updateComponent(edit.id, position!); store.reseatComponentOnBreadboard(edit.id); }
                    } else if (edit.type === 'part.rotate') {
                        const degrees = ((-edit.radians * 180 / Math.PI) % 360 + 360) % 360;
                        const board = store.boards.find(b => b.id === edit.id);
                        if (board) {
                            const steps = Math.round(((degrees - (board.rotation ?? 0) + 360) % 360) / 90);
                            for (let i = 0; i < steps; i++) store.rotateBoard(edit.id);
                        } else { store.updateComponent(edit.id, { properties: { ...store.components.find(c => c.id === edit.id)?.properties, rotation: degrees } }); store.reseatComponentOnBreadboard(edit.id); }
                    }
                });
                requestAnimationFrame(() => useSimulatorStore.getState().recalculateAllWirePositions());
            }
            const result = { accepted: true } as const;
            completed.set(command.actionId, result);
            if (completed.size > 100) completed.delete(completed.keys().next().value!);
            return result;
        } catch (error) {
            return { accepted: false, feedback: { code: 'rejected', message: String(error), entityIds: [], recovery: 'Check the selected pins and retry the edit.' } };
        }
    };
}
