import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const listeners = new Set<(state: any, previous: any) => void>();
  let state: any;
  const initial = () => ({ boards: [{ id: 'uno', boardKind: 'arduino-uno', x: 0, y: 0, activeFileGroupId: 'default', serialBaudRate: 9600 }], components: [{ id: 'led', metadataId: 'led', x: 40, y: 40, properties: { temperature: 99 } }], wires: [{ id: 'w', start: { componentId: 'uno', pinName: '13', x: 0, y: 0 }, end: { componentId: 'led', pinName: 'A', x: 40, y: 40 }, color: 'red', waypoints: [] }], activeBoardId: 'uno' });
  const setState = (change: any) => { const previous = state; state = { ...state, ...(typeof change === 'function' ? change(state) : change) }; listeners.forEach(fn => fn(state, previous)); };
  const reset = () => {
    state = { ...initial(), setActiveBoardId: (id: string) => setState({ activeBoardId: id }), loadProjectState: (doc: any) => {
      setState({ ...structuredClone(doc), boards: doc.boards.map((b: any) => ({ ...b, activeFileGroupId: 'default', serialBaudRate: 9600 })) });
      requestAnimationFrame(() => setState({ wires: state.wires.map((w: any) => ({ ...w, start: { ...w.start, x: 128 } })) }));
    } };
    listeners.clear();
  };
  reset();
  return { reset, setState, getState: () => state, subscribe: (fn: any) => { listeners.add(fn); return () => listeners.delete(fn); },
    payload: () => ({ format: 'velxio-project', version: 1, exportedAt: '2026-10-20T00:00:00Z', name: 'BreadBit project', boards: state.boards, components: state.components, wires: state.wires, activeBoardId: state.activeBoardId, fileGroups: { default: [{ name: 'main.ino', content: 'default' }], custom: [{ name: 'saved.ino', content: 'saved firmware' }] } }),
  };
});
vi.mock('@velxio/store/useSimulatorStore', () => ({ useSimulatorStore: { getState: mock.getState, setState: mock.setState, subscribe: mock.subscribe }, projectComponentProperties: () => ({ temperature: 20 }) }));
vi.mock('@velxio/store/useEditorStore', () => ({ useEditorStore: { subscribe: () => () => {} } }));
vi.mock('@velxio/utils/vlxFile', () => ({ buildVlxPayload: ({ name }: { name: string }) => ({ ...mock.payload(), name }) }));
import { capture, ProjectController } from './project';

describe('Velxio project adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers(); mock.reset();
    vi.stubGlobal('localStorage', { setItem: vi.fn() });
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('captures project properties instead of live sensor values', () => {
    expect(capture().components[0].properties.temperature).toBe(20);
  });
  it('restores custom file group and serial rate instead of upstream defaults', () => {
    const controller = new ProjectController();
    const project = controller.project;
    project.document.boards[0].activeFileGroupId = 'custom';
    project.document.boards[0].serialBaudRate = 115200;
    controller.load(JSON.stringify(project));
    expect(mock.getState().boards[0].activeFileGroupId).toBe('custom');
    expect(mock.getState().boards[0].serialBaudRate).toBe(115200);
  });
  it('keeps redo after deferred geometry hydration, and persists later edits', () => {
    const controller = new ProjectController(); const detach = controller.attach();
    mock.setState({ components: [{ ...mock.getState().components[0], x: 80 }] });
    controller.flush(); controller.undo();
    vi.advanceTimersByTime(400);
    expect(controller.history.canRedo).toBe(true);
    controller.redo(); vi.advanceTimersByTime(400);
    expect(controller.project.document.components[0].x).toBe(80);
    mock.setState({ components: [{ ...mock.getState().components[0], x: 90 }] });
    vi.advanceTimersByTime(400);
    expect(controller.project.document.components[0].x).toBe(90);
    detach();
  });
  it('undoes a component and attached-wire deletion as one project edit', () => {
    const controller = new ProjectController(); const detach = controller.attach();
    controller.flush(); mock.setState({ wires: [] }); mock.setState({ components: [] }); controller.flush();
    expect(controller.project.document.components).toHaveLength(0);
    controller.undo(); vi.advanceTimersByTime(400);
    expect(controller.project.document.components).toHaveLength(1);
    expect(controller.project.document.wires).toHaveLength(1);
    controller.redo(); vi.advanceTimersByTime(400);
    expect(controller.project.document.components).toHaveLength(0);
    expect(controller.project.document.wires).toHaveLength(0);
    detach();
  });
  it('preserves imported extension data and names after a new edit', () => {
    const controller = new ProjectController();
    const project = controller.project; project.document.name = 'My saved project'; project.document.extension = { hello: 'world' };
    controller.load(JSON.stringify(project)); vi.advanceTimersByTime(20);
    mock.setState({ components: [{ ...mock.getState().components[0], x: 99 }] }); controller.flush();
    expect(controller.project.document.name).toBe('My saved project');
    expect(controller.project.document.extension).toEqual({ hello: 'world' });
  });

  it('keeps presentation edits and their undo out of live simulation state',()=>{
    const controller=new ProjectController();const live=mock.getState();
    controller.presentation('Move schematic symbol',d=>{d.schematic={positions:{led:{x:100,y:100}}};});
    expect(mock.getState()).toBe(live);expect(controller.history.undoLabel).toBe('Move schematic symbol');
    controller.undo();expect(mock.getState()).toBe(live);expect(controller.project.document.schematic).toBeUndefined();
    controller.redo();expect(mock.getState()).toBe(live);expect(controller.project.document.schematic).toBeDefined();
  });
});
