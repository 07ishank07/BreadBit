import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ wires: [{ id: 'w', waypoints: [{ x: 12, y: 34 }] }], setWires: vi.fn() }));
vi.mock('@velxio/store/useSimulatorStore', () => ({ useSimulatorStore: { getState: () => state } }));
vi.mock('./editing', () => ({ endpoint: vi.fn(), validateWire: vi.fn(), commitWire: vi.fn() }));
import { rendererCommands } from './rendererCommands';
import type { ProjectController } from './project';
beforeEach(() => vi.clearAllMocks());
function setup() {
    const host = { project: { revision: 4, document: { wires: state.wires } }, flush: vi.fn(), commit: vi.fn((_label, action) => action()) };
    return { host, dispatch: rendererCommands(host as unknown as ProjectController, () => ({ parts: [], wires: [] })) };
}
it('rejects stale gestures after flushing queued host changes', () => {
    const { host, dispatch } = setup(); host.flush.mockImplementation(() => { host.project.revision = 5; });
    expect(dispatch({ actionId: 'stale', expectedRevision: 4, label: 'Route', edit: { type: 'wire.route', id: 'w', waypoints: [[1, 2, 3]] } }).accepted).toBe(false);
    expect(host.commit).not.toHaveBeenCalled();
});
it('commits a 3D route once, preserving physical waypoints on retries', () => {
    const { host, dispatch } = setup();
    const command = { actionId: 'once', expectedRevision: 4, label: 'Route', edit: { type: 'wire.route' as const, id: 'w', waypoints: [[1, 2, 3] as const] } };
    expect(dispatch(command).accepted).toBe(true); expect(dispatch(command).accepted).toBe(true);
    expect(host.commit).toHaveBeenCalledTimes(1);
    expect(state.setWires).toHaveBeenCalledWith([{ ...state.wires[0], route3d: [[1, 2, 3]] }]);
});
it('rejects invalid bends without mutating history', () => {
    const { host, dispatch } = setup();
    expect(dispatch({ actionId: 'bad', expectedRevision: 4, label: 'Route', edit: { type: 'wire.route', id: 'w', waypoints: [[NaN, 2, 3]] } }).accepted).toBe(false);
    expect(host.commit).not.toHaveBeenCalled();
});
