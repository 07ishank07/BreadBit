import { describe, expect, it } from 'vitest';
import { createProject, parseProject, serializeProject, validateVlx, ProjectHistory, validateProposal, evidenceStatus, classifyEdit, type VlxPayload, type Evidence } from '../src/index';

const catalog = { 'board:arduino-uno': ['13', 'GND'], 'component:led': ['A', 'C'] };
const document = (): VlxPayload => ({
  format: 'velxio-project', version: 1, exportedAt: '2026-10-20T00:00:00Z', name: 'Blink',
  boards: [{ id: 'uno', boardKind: 'arduino-uno', x: 0, y: 0, activeFileGroupId: 'main', rotation: 90, libraries: ['Test'] }],
  components: [{ id: 'led', metadataId: 'led', x: 50, y: 50, properties: { color: 'red' } }],
  wires: [{ id: 'wire', start: { componentId: 'uno', pinName: '13', x: 0, y: 0 }, end: { componentId: 'led', pinName: 'A', x: 50, y: 50 }, waypoints: [], color: '#f00', bb: false }],
  fileGroups: { main: [{ name: 'sketch.ino', content: 'void setup() {}\nvoid loop() {}' }] },
  folderGroups: { main: ['empty'] }, activeBoardId: 'uno', customExtension: { preserved: true },
});

describe('project envelope and validation', () => {
  it('round trips upstream document including optional and unknown fields', () => {
    const project = createProject(document(), 'test');
    expect(parseProject(serializeProject(project))).toEqual(project);
    expect(project.document).toEqual(document());
  });
  it('rejects unsupported schema and malformed entities', () => {
    expect(() => parseProject('{"format":"breadbit-project","version":2}')).toThrow();
    const bad = document(); bad.components[0].x = NaN;
    expect(validateVlx(bad).some(x => x.code === 'entity')).toBe(true);
  });
  it('detects dangling entities and pins through qualified catalog', () => {
    const bad = document(); bad.wires[0].start.componentId = 'missing'; bad.wires[0].end.pinName = 'invented';
    expect(validateVlx(bad, catalog).map(x => x.code)).toEqual(['dangling-reference', 'unknown-pin']);
  });
});

describe('atomic transactions', () => {
  it('rejects invalid final state without partial changes', () => {
    const history = new ProjectHistory(createProject(document(), 'test'), catalog);
    expect(() => history.apply({ expectedRevision: 0, label: 'Bad delete', operations: [{ type: 'set-file', groupId: 'main', name: 'sketch.ino', content: 'changed' }, { type: 'remove-component', id: 'led' }] })).toThrow();
    expect(history.snapshot.document).toEqual(document());
    expect(history.canUndo).toBe(false);
  });
  it('undoes and redoes a full batch with monotonically advancing revisions', () => {
    const history = new ProjectHistory(createProject(document(), 'test'), catalog);
    history.apply({ expectedRevision: 0, label: 'Delete LED and connection', operations: [{ type: 'remove-component', id: 'led' }, { type: 'remove-wire', id: 'wire' }] });
    expect(history.snapshot.document.components).toHaveLength(0);
    expect(history.undo().document).toEqual(document());
    expect(history.snapshot.revision).toBe(2);
    expect(history.redo().document.wires).toHaveLength(0);
    expect(history.snapshot.revision).toBe(3);
  });
  it('rejects stale proposal revisions and isolates returned snapshots', () => {
    const history = new ProjectHistory(createProject(document(), 'test'));
    history.apply({ expectedRevision: 0, label: 'Move', operations: [{ type: 'move-component', id: 'led', x: 80, y: 70 }] });
    expect(() => history.apply({ expectedRevision: 0, label: 'Old', operations: [{ type: 'remove-wire', id: 'wire' }] })).toThrow('Stale');
    history.snapshot.document.components[0].x = 999;
    expect(history.snapshot.document.components[0].x).toBe(80);
  });
});

describe('AI and evidence boundary', () => {
  it('fails closed on unknown tools, unsupported components, and oversize batches', () => {
    const project = createProject(document(), 'test');
    const proposal = { expectedRevision: 0, label: 'AI', explanation: 'Example', evidenceRunIds: [] };
    expect(() => validateProposal(project, { ...proposal, operations: [{ type: 'shell', command: 'anything' }] }, catalog)).toThrow('Unsupported');
    expect(() => validateProposal(project, { ...proposal, operations: [{ type: 'add-component', component: { id: 'new', metadataId: 'invented', x: 0, y: 0, properties: {} } }] }, catalog)).toThrow('qualified');
    expect(() => validateProposal(project, { ...proposal, operations: Array.from({ length: 101 }, () => ({ type: 'move-component', id: 'led', x: 0, y: 0 })) }, catalog)).toThrow('1–100');
    expect(project.revision).toBe(0);
  });
  it('previews supported changes without applying them', () => {
    const project = createProject(document(), 'test');
    const next = validateProposal(project, { expectedRevision: 0, label: 'Firmware edit', explanation: 'Draft only', evidenceRunIds: [], operations: [{ type: 'set-file', groupId: 'main', name: 'sketch.ino', content: 'replacement' }] }, catalog);
    expect(next.revision).toBe(1);
    expect(project.document.fileGroups.main[0].content).not.toBe('replacement');
  });
  it('does not mistake compilation for behavioral verification and invalidates changed projects', () => {
    const project = createProject(document(), 'test');
    const evidence: Evidence = { projectId: 'test', revision: 0, runId: 'compile-1', kind: 'compile', outcome: 'passed', engineVersion: 'test', artifactHash: 'abc', details: 'Compiled' };
    expect(evidenceStatus(project, evidence)).toBe('compiled');
    const history = new ProjectHistory(project);
    history.apply({ expectedRevision: 0, label: 'Edit', operations: [{ type: 'set-file', groupId: 'main', name: 'sketch.ino', content: 'changed' }] });
    expect(evidenceStatus(history.snapshot, evidence)).toBe('stale');
    expect(evidenceStatus(history.undo(), evidence)).toBe('stale');
    expect(evidenceStatus({ ...project, id: 'different' }, evidence)).toBe('stale');
    expect(classifyEdit({ type: 'move-component', id: 'led', x: 5, y: 5 })).toBe('restart');
  });
});
