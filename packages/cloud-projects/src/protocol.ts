import { parseProject, type Project } from '../../project-core/src';

export const MAX_PROJECT_BYTES = 1024 * 1024;
export interface Account { id: string; email: string }
export interface RemoteProject { project: Project; etag: string; updatedAt: string }
export interface ProjectSummary { id: string; name: string; etag: string; updatedAt: string }
export interface Pairing { deviceCode: string; userCode: string; verificationUrl: string; expiresAt: number }
export class CloudError extends Error {
  constructor(public status: number, message: string, public remote?: RemoteProject) { super(message); }
}
export function checkedProject(value: unknown): Project {
  const text = JSON.stringify(value);
  if (!text || new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 1 MiB cloud limit.');
  const project = parseProject(text);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(project.id)) throw new Error('Invalid cloud project ID.');
  if (project.document.name !== undefined && (typeof project.document.name !== 'string' || project.document.name.length > 200)) throw new Error('Project name must be text of at most 200 characters.');
  return project;
}

// Public output is a deliberate allowlist. Unknown extension fields, binaries,
// board options, SPIFFS and runtime state can contain private source or secrets.
export interface SharedSnapshot {
  name: string; publishedAt: string; includeFirmware: boolean;
  boards: { id: string; kind: string; x: number; y: number }[];
  components: { id: string; kind: string; x: number; y: number }[];
  wires: { id: string; from: { id: string; pin: string }; to: { id: string; pin: string }; color: string }[];
  firmware?: { group: string; name: string; content: string }[];
}
export function publicSnapshot(project: Project, includeFirmware: boolean, now = new Date().toISOString()): SharedSnapshot {
  const d = checkedProject(project).document;
  return {
    name: d.name || 'Untitled project', publishedAt: now, includeFirmware,
    boards: d.boards.map(b => ({ id: b.id, kind: b.boardKind, x: b.x, y: b.y })),
    components: d.components.map(c => ({ id: c.id, kind: c.metadataId, x: c.x, y: c.y })),
    wires: d.wires.map(w => ({ id: w.id, from: { id: w.start.componentId, pin: w.start.pinName }, to: { id: w.end.componentId, pin: w.end.pinName }, color: w.color })),
    ...(includeFirmware ? { firmware: Object.entries(d.fileGroups).flatMap(([group, files]) => files.map(f => ({ group, name: f.name, content: f.content }))) } : {}),
  };
}

export interface CloudTransport {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}
export class ProjectCloud {
  constructor(private transport: CloudTransport) {}
  list() { return this.transport.request<ProjectSummary[]>('GET', '/v1/projects'); }
  get(id: string) { return this.transport.request<RemoteProject>('GET', `/v1/projects/${encodeURIComponent(id)}`); }
  save(project: Project, baseEtag: string | null, mutationId: string) {
    return this.transport.request<RemoteProject>('PUT', `/v1/projects/${encodeURIComponent(project.id)}`, { project: checkedProject(project), baseEtag, mutationId });
  }
  publish(id: string, etag: string, includeFirmware: boolean) {
    return this.transport.request<{ url: string }>('POST', `/v1/projects/${encodeURIComponent(id)}/share`, { etag, includeFirmware });
  }
  unpublish(id: string) { return this.transport.request<void>('DELETE', `/v1/projects/${encodeURIComponent(id)}/share`); }
}
