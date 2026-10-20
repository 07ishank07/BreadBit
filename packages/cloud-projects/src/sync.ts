import type { Project } from '../../project-core/src';
import { checkedProject, CloudError, type RemoteProject, type ProjectCloud } from './protocol';

export interface Draft {
  owner: string; project: Project; baseEtag: string | null; dirty: boolean;
  mutationId: string; conflict?: RemoteProject;
}
export interface DraftStore {
  get(owner: string, id: string): Promise<Draft | undefined>;
  put(draft: Draft): Promise<void>;
  list(owner: string): Promise<Draft[]>;
}
export type SyncStatus = 'local' | 'syncing' | 'saved' | 'offline' | 'conflict' | 'signin' | 'error';
/** Serializes local writes and network responses. Never replaces newer edits
 * with the response to an older save. Each account owns its own queue. */
export class ProjectSync {
  private queue: Promise<unknown> = Promise.resolve();
  private stopped = false;
  private inFlight: Promise<void> | undefined;
  constructor(readonly owner: string, private store: DraftStore, private cloud: ProjectCloud,
    private notify: (status: SyncStatus, message?: string) => void = () => {}) {}
  stop() { this.stopped = true; }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work); this.queue = next.catch(() => {}); return next;
  }
  stage(project: Project) {
    const snapshot = checkedProject(structuredClone(project));
    return this.serial(async () => {
      if (this.stopped) return;
      const previous = await this.store.get(this.owner, snapshot.id);
      if (previous && JSON.stringify(previous.project) === JSON.stringify(snapshot)) return;
      await this.store.put({ owner: this.owner, project: snapshot, baseEtag: previous?.baseEtag ?? null,
        dirty: true, mutationId: crypto.randomUUID(), conflict: previous?.conflict });
      this.notify(previous?.conflict ? 'conflict' : 'local');
    });
  }
  adopt(remote: RemoteProject) {
    return this.serial(async () => {
      const previous = await this.store.get(this.owner, remote.project.id);
      if (previous?.dirty) throw new Error('Local edits must be resolved before replacing this project.');
      await this.store.put({ owner: this.owner, project: checkedProject(remote.project), baseEtag: remote.etag,
        dirty: false, mutationId: crypto.randomUUID() });
    });
  }
  flush(id?: string): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.flushQueue(id).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }
  private async flushQueue(id?: string) {
    await this.queue;
    if (this.stopped) return;
    const entries = (await this.store.list(this.owner)).filter(d => d.dirty && (!id || d.project.id === id));
    for (const draft of entries) {
      if (this.stopped) return;
      if (draft.conflict) { this.notify('conflict'); continue; }
      this.notify('syncing');
      try {
        const remote = await this.cloud.save(draft.project, draft.baseEtag, draft.mutationId);
        await this.serial(async () => {
          if (this.stopped) return;
          const latest = await this.store.get(this.owner, draft.project.id);
          if (!latest || latest.conflict) return;
          const unchanged = latest.mutationId === draft.mutationId;
          await this.store.put({ ...latest, baseEtag: remote.etag, dirty: !unchanged });
          this.notify(unchanged ? 'saved' : 'local');
        });
      } catch (error) {
        if (this.stopped) return;
        if (error instanceof CloudError && error.status === 409 && error.remote) {
          await this.serial(async () => {
            const latest = await this.store.get(this.owner, draft.project.id);
            if (latest) await this.store.put({ ...latest, conflict: error.remote });
          });
          this.notify('conflict');
        } else if (error instanceof CloudError && error.status === 401) this.notify('signin', 'Sign in again to synchronise. Local edits are retained.');
        else if (error instanceof CloudError) this.notify('error', error.message);
        else this.notify('offline', 'Saved on this device. Cloud synchronisation will retry.');
        return;
      }
    }
  }
  resolve(id: string, choice: 'local' | 'remote') {
    return this.serial(async () => {
      const draft = await this.store.get(this.owner, id);
      if (!draft?.conflict) throw new Error('No pending conflict.');
      const remote = draft.conflict;
      const project = choice === 'remote' ? remote.project : draft.project;
      await this.store.put({ owner: this.owner, project, baseEtag: remote.etag,
        dirty: choice === 'local', mutationId: crypto.randomUUID() });
      this.notify(choice === 'local' ? 'local' : 'saved');
      return project;
    });
  }
}
