import { buildVlxPayload } from '@velxio/utils/vlxFile';
import { useSimulatorStore, projectComponentProperties } from '@velxio/store/useSimulatorStore';
import { useEditorStore } from '@velxio/store/useEditorStore';
import { createProject, parseProject, ProjectHistory, serializeProject, type Project, type VlxPayload } from '../../../../packages/project-core/src';

export function capture(previous?: VlxPayload): VlxPayload {
  const payload = buildVlxPayload({ name: previous?.name ?? 'BreadBit project' });
  // Upstream's portable exporter currently omits these persisted board fields.
  const boards = useSimulatorStore.getState().boards;
  payload.boards = payload.boards.map(board => {
    const live = boards.find(b => b.id === board.id)!;
    return { ...previous?.boards.find(b => b.id === board.id), ...board, boardOptions: live.boardOptions, spiffsFiles: live.spiffsFiles };
  });
  payload.components = payload.components.map(component => ({
    ...previous?.components.find(c => c.id === component.id), ...component,
    properties: projectComponentProperties(component.id) ?? component.properties,
  }));
  payload.wires = payload.wires.map(wire => ({ ...previous?.wires.find(w => w.id === wire.id), ...wire }));
  return structuredClone({ ...previous, ...payload }) as unknown as VlxPayload;
}
// Endpoint pixel coordinates are derived from mounted pin elements. Hydration must
// not create an edit or erase redo when upstream recalculates them on the next frame.
const signature = (document: VlxPayload) => JSON.stringify({ ...document, exportedAt: '', wires: document.wires.map(wire => ({
  ...wire, start: { ...wire.start, x: 0, y: 0 }, end: { ...wire.end, x: 0, y: 0 },
})) });
export const recoveryKey = 'breadbit.recovery.v1';
export class ProjectController {
  history = new ProjectHistory(createProject(capture(), crypto.randomUUID()));
  private signature = signature(this.history.snapshot.document);
  private listeners = new Set<() => void>();
  private restoring = false;
  private restoreFrame: number | undefined;
  private restoreGeneration = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  recoveryError: string | null = null;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  notify = () => { for (const listener of this.listeners) listener(); };
  get project() { return this.history.snapshot; }
  flush = () => {
    clearTimeout(this.timer);
    if (this.restoring) return;
    const document = capture(this.project.document);
    const next = signature(document);
    if (next === this.signature) return;
    this.history.apply({ expectedRevision: this.project.revision, label: 'Workspace edit', operations: [{ type: 'replace-document', document }] });
    this.signature = next;
    this.backup();
    this.notify();
  };
  private backup() {
    try { localStorage.setItem(recoveryKey, serializeProject(this.project)); this.recoveryError = null; }
    catch { this.recoveryError = 'Recovery storage is full or unavailable. Save the project to a file.'; }
  }
  attach() {
    const schedule = () => {
      if (this.restoring) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { try { this.flush(); } catch (e) { this.recoveryError = String(e); this.notify(); } }, 350);
    };
    const stopSim = useSimulatorStore.subscribe((state, previous) => {
      if (state.components !== previous.components || state.wires !== previous.wires || state.boards !== previous.boards || state.activeBoardId !== previous.activeBoardId) schedule();
    });
    const stopEditor = useEditorStore.subscribe((state, previous) => {
      if (state.fileGroups !== previous.fileGroups || state.folderGroups !== previous.folderGroups) schedule();
    });
    return () => {
      clearTimeout(this.timer);
      if (this.restoreFrame !== undefined) cancelAnimationFrame(this.restoreFrame);
      this.restoreGeneration++; this.restoring = false;
      stopSim(); stopEditor();
    };
  }
  private restore(project: Project) {
    clearTimeout(this.timer);
    if (this.restoreFrame !== undefined) cancelAnimationFrame(this.restoreFrame);
    const generation = ++this.restoreGeneration;
    this.restoring = true;
    try {
      useSimulatorStore.getState().loadProjectState(project.document as unknown as Parameters<ReturnType<typeof useSimulatorStore.getState>['loadProjectState']>[0]);
      // Upstream recreates default file group IDs and baud rates on load. Restore
      // persisted choices before reselecting the active board/editor group.
      useSimulatorStore.setState(state => ({ boards: state.boards.map(board => {
        const saved = project.document.boards.find(b => b.id === board.id);
        if (!saved) return board;
        return { ...board, activeFileGroupId: saved.activeFileGroupId,
          ...(typeof saved.serialBaudRate === 'number' ? { serialBaudRate: saved.serialBaudRate } : {}),
        };
      }) }));
      const active = useSimulatorStore.getState().activeBoardId;
      if (active) useSimulatorStore.getState().setActiveBoardId(active);
      this.signature = signature(capture(project.document));
      // Runs after upstream's queued geometry refresh. Genuine edits made before
      // this callback still differ from the pre-frame signature and are captured.
      this.restoreFrame = requestAnimationFrame(() => {
        if (generation !== this.restoreGeneration) return;
        this.restoreFrame = undefined; this.restoring = false;
        try { this.flush(); } catch (error) { this.recoveryError = String(error); this.notify(); }
      });
    } catch (error) {
      this.restoring = false;
      throw error;
    }
    this.backup(); this.notify();
  }
  load(text: string) {
    const raw = JSON.parse(text);
    const project = raw.format === 'velxio-project' ? createProject(raw, crypto.randomUUID()) : parseProject(text);
    this.history = new ProjectHistory(project);
    this.restore(project);
  }
  undo() { this.flush(); if (this.history.canUndo) this.restore(this.history.undo()); }
  redo() { this.flush(); if (this.history.canRedo) this.restore(this.history.redo()); }
  serialize() { this.flush(); return serializeProject(this.project); }
}
