/** Serializable contracts preserve upstream IDs and extension fields, without importing live stores. */
export interface Component {
  id: string; metadataId: string; x: number; y: number;
  properties: Record<string, unknown>; [extension: string]: unknown;
}
export interface Board {
  id: string; boardKind: string; x: number; y: number; activeFileGroupId: string;
  [extension: string]: unknown;
}
export interface Endpoint { componentId: string; pinName: string; x: number; y: number; [extension: string]: unknown }
export interface Wire {
  id: string; start: Endpoint; end: Endpoint; waypoints: { x: number; y: number }[]; color: string;
  [extension: string]: unknown;
}
export interface VlxPayload {
  format: 'velxio-project'; version: 1; exportedAt: string; name?: string;
  boards: Board[]; components: Component[]; wires: Wire[];
  fileGroups: Record<string, { name: string; content: string }[]>;
  folderGroups?: Record<string, string[]>; activeBoardId: string | null;
  [extension: string]: unknown;
}
export interface Project {
  format: 'breadbit-project'; version: 1; id: string; revision: number; document: VlxPayload;
}
/** Keys are board:<boardKind> and component:<metadataId>; pins are upstream pin IDs. */
export type PinCatalog = Readonly<Record<string, readonly string[]>>;
export interface Diagnostic { code: string; message: string; severity: 'error' | 'warning' }
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const point = (v: unknown): boolean => object(v) && typeof v.x === 'number' && Number.isFinite(v.x) && typeof v.y === 'number' && Number.isFinite(v.y);
const clone = <T>(v: T): T => structuredClone(v);
export function validateVlx(value: unknown, catalog?: PinCatalog): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const error = (code: string, message: string) => issues.push({ code, message, severity: 'error' });
  if (!object(value) || value.format !== 'velxio-project' || value.version !== 1 ||
      !Array.isArray(value.boards) || !Array.isArray(value.components) || !Array.isArray(value.wires) || !object(value.fileGroups)) {
    return [{ code: 'format', message: 'Expected a version 1 Velxio document.', severity: 'error' }];
  }
  if (!str(value.exportedAt) || !Number.isFinite(Date.parse(value.exportedAt))) error('timestamp', 'Invalid export timestamp.');
  if (!catalog) issues.push({ code: 'pins-unverified', message: 'No qualified pin catalog supplied; endpoint entity references are checked, pin names are unverified.', severity: 'warning' });
  const entities = new Map<string, string>();
  for (const [kind, entries] of [['board', value.boards], ['component', value.components]] as const) {
    for (const entry of entries) {
      const typeKey = kind === 'board' ? 'boardKind' : 'metadataId';
      if (!object(entry) || !str(entry.id) || !str(entry[typeKey]) || !point(entry)) { error('entity', `Invalid ${kind}.`); continue; }
      if (entities.has(entry.id)) error('duplicate-id', `Duplicate entity ID ${entry.id}.`);
      entities.set(entry.id, `${kind}:${entry[typeKey]}`);
      if (kind === 'component' && !object(entry.properties)) error('properties', `Invalid properties on ${entry.id}.`);
      if (kind === 'board' && (!str(entry.activeFileGroupId) || !Object.hasOwn(value.fileGroups, entry.activeFileGroupId))) error('file-group', `Missing file group for ${entry.id}.`);
      if (catalog && !Object.hasOwn(catalog, `${kind}:${entry[typeKey]}`)) issues.push({ code: 'unsupported-part', message: `No qualified pin definition for ${entry.id}.`, severity: 'warning' });
    }
  }
  if (value.activeBoardId !== null && !value.boards.some(b => object(b) && b.id === value.activeBoardId)) error('active-board', 'Active board does not exist.');
  for (const [group, files] of Object.entries(value.fileGroups)) {
    if (!Array.isArray(files)) { error('files', `Invalid file group ${group}.`); continue; }
    const names = new Set<string>();
    for (const file of files) {
      if (!object(file) || !str(file.name) || typeof file.content !== 'string') { error('file', `Invalid file in ${group}.`); continue; }
      if (names.has(file.name)) error('duplicate-file', `Duplicate file ${file.name}.`);
      names.add(file.name);
    }
  }
  if (value.folderGroups !== undefined && (!object(value.folderGroups) || Object.values(value.folderGroups).some(v => !Array.isArray(v) || v.some(x => typeof x !== 'string')))) error('folders', 'Invalid folder groups.');
  const wires = new Set<string>();
  for (const wire of value.wires) {
    if (!object(wire) || !str(wire.id) || typeof wire.color !== 'string' || !Array.isArray(wire.waypoints) || !wire.waypoints.every(point)) { error('wire', 'Invalid wire.'); continue; }
    if (wires.has(wire.id)) error('duplicate-wire', `Duplicate wire ID ${wire.id}.`);
    wires.add(wire.id);
    for (const endpoint of [wire.start, wire.end]) {
      if (!object(endpoint) || !str(endpoint.componentId) || !str(endpoint.pinName) || !point(endpoint)) { error('endpoint', `Invalid endpoint on ${wire.id}.`); continue; }
      const type = entities.get(endpoint.componentId);
      if (!type) error('dangling-reference', `Wire ${wire.id} references missing entity ${endpoint.componentId}.`);
      else if (catalog && Object.hasOwn(catalog, type) && !catalog[type].includes(endpoint.pinName)) error('unknown-pin', `Unknown pin ${endpoint.componentId}:${endpoint.pinName}.`);
    }
  }
  return issues;
}
function assertDocument(value: unknown, catalog?: PinCatalog): asserts value is VlxPayload {
  const errors = validateVlx(value, catalog).filter(x => x.severity === 'error');
  if (errors.length) throw new Error(errors.map(x => x.message).join(' '));
}
export function createProject(document: VlxPayload, id: string): Project {
  if (!str(id)) throw new Error('Project ID is required.');
  assertDocument(document);
  return { format: 'breadbit-project', version: 1, id, revision: 0, document: clone(document) };
}
export function parseProject(text: string): Project {
  const value: unknown = JSON.parse(text);
  if (!object(value) || value.format !== 'breadbit-project' || value.version !== 1 || !str(value.id) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) throw new Error('Unsupported or malformed BreadBit project.');
  assertDocument(value.document);
  return value as unknown as Project;
}
export function serializeProject(project: Project): string {
  const text = JSON.stringify(project, null, 2);
  parseProject(text);
  return text;
}
export type Operation =
  | { type: 'replace-document'; document: VlxPayload }
  | { type: 'set-file'; groupId: string; name: string; content: string }
  | { type: 'move-component'; id: string; x: number; y: number }
  | { type: 'add-component'; component: Component }
  | { type: 'remove-component'; id: string }
  | { type: 'add-wire'; wire: Wire }
  | { type: 'remove-wire'; id: string };
export interface Transaction { expectedRevision: number; label: string; operations: Operation[] }
export type EditEffect = 'visual-only' | 'restart' | 'recompile';
export function classifyEdit(op: Operation): EditEffect {
  // Seated-part movement changes connectivity. Pure view operations stay outside this document.
  return op.type === 'set-file' || op.type === 'replace-document' ? 'recompile' : 'restart';
}
function applyOperation(document: VlxPayload, op: Operation): VlxPayload {
  switch (op.type) {
    case 'replace-document': return clone(op.document);
    case 'set-file': {
      if (!str(op.groupId) || !str(op.name) || typeof op.content !== 'string' || !Object.hasOwn(document.fileGroups, op.groupId)) throw new Error('Invalid file edit or missing group.');
      const files = document.fileGroups[op.groupId];
      const existing = files.find(f => f.name === op.name);
      if (existing) existing.content = op.content; else files.push({ name: op.name, content: op.content });
      break;
    }
    case 'move-component': {
      const component = document.components.find(c => c.id === op.id);
      if (!component || !point(op)) throw new Error('Invalid component move.');
      component.x = op.x; component.y = op.y; break;
    }
    case 'add-component': document.components.push(clone(op.component)); break;
    case 'remove-component': {
      const index = document.components.findIndex(c => c.id === op.id);
      if (index < 0) throw new Error('Component not found.');
      document.components.splice(index, 1); break;
    }
    case 'add-wire': document.wires.push(clone(op.wire)); break;
    case 'remove-wire': {
      const index = document.wires.findIndex(w => w.id === op.id);
      if (index < 0) throw new Error('Wire not found.');
      document.wires.splice(index, 1); break;
    }
    default: throw new Error('Unsupported operation.');
  }
  return document;
}
/** Validates the final batch atomically; deleting a part requires removing its wires in that batch. */
export class ProjectHistory {
  private current: Project;
  private past: VlxPayload[] = [];
  private future: VlxPayload[] = [];
  constructor(project: Project, private readonly catalog?: PinCatalog) {
    this.current = parseProject(serializeProject(project));
    assertDocument(project.document, catalog);
  }
  get snapshot(): Project { return clone(this.current); }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  apply(transaction: Transaction): Project {
    if (transaction.expectedRevision !== this.current.revision) throw new Error('Stale project revision.');
    if (!str(transaction.label) || !Array.isArray(transaction.operations) || transaction.operations.length < 1 || transaction.operations.length > 100) throw new Error('Transaction must have a label and 1–100 operations.');
    let next = clone(this.current.document);
    for (const op of transaction.operations) next = applyOperation(next, op);
    assertDocument(next, this.catalog);
    this.past.push(clone(this.current.document));
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.current = { ...this.current, revision: this.current.revision + 1, document: next };
    return this.snapshot;
  }
  undo(): Project {
    const previous = this.past.pop();
    if (previous) { this.future.push(clone(this.current.document)); this.current = { ...this.current, revision: this.current.revision + 1, document: previous }; }
    return this.snapshot;
  }
  redo(): Project {
    const next = this.future.pop();
    if (next) { this.past.push(clone(this.current.document)); this.current = { ...this.current, revision: this.current.revision + 1, document: next }; }
    return this.snapshot;
  }
}
export interface Evidence {
  projectId: string; revision: number; runId: string;
  kind: 'compile' | 'simulation'; outcome: 'passed' | 'failed';
  engineVersion: string; artifactHash: string; details: string;
}
export function evidenceStatus(project: Project, evidence: Evidence): 'stale' | 'compiled' | 'passed' | 'failed' {
  if (evidence.projectId !== project.id || evidence.revision !== project.revision) return 'stale';
  if (evidence.outcome === 'failed') return 'failed';
  return evidence.kind === 'compile' ? 'compiled' : 'passed';
}
export interface AIProposal extends Transaction { explanation: string; evidenceRunIds: string[] }
export const AI_TOOLS = ['inspect-project', 'propose-edit', 'validate-proposal', 'read-evidence'] as const;
/** Provider output is untrusted. Preview only: no live project or runtime mutation. */
export function validateProposal(project: Project, proposal: unknown, catalog: PinCatalog): Project {
  if (!object(proposal) || !str(proposal.explanation) || proposal.explanation.length > 10000 || !Array.isArray(proposal.evidenceRunIds) || proposal.evidenceRunIds.length > 100 || !proposal.evidenceRunIds.every(str) || !Array.isArray(proposal.operations)) throw new Error('Malformed AI proposal.');
  if (JSON.stringify(proposal).length > 256000) throw new Error('AI proposal exceeds size limit.');
  const allowed = new Set(['set-file', 'move-component', 'add-component', 'remove-component', 'add-wire', 'remove-wire']);
  if (proposal.operations.some(op => !object(op) || !allowed.has(op.type as string))) throw new Error('Unsupported AI operation.');
  const history = new ProjectHistory(project, catalog);
  const next = history.apply(proposal as unknown as AIProposal);
  const unsupported = validateVlx(next.document, catalog).filter(x => x.code === 'unsupported-part');
  if (unsupported.length) throw new Error(unsupported.map(x => x.message).join(' '));
  return next;
}

export type * from './schematic';
