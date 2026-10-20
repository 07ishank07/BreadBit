import { createStore, get, update, values } from 'idb-keyval';
import { parseProject, type Project } from '../../../../packages/project-core/src';
const db = createStore('breadbit-local-projects', 'projects');
export interface LocalProject {
    id: string;
    name: string;
    revision: number;
    updatedAt: string;
    content: string;
}
export async function listProjects(): Promise<LocalProject[]> { return (await values<LocalProject>(db)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export async function readProject(id: string) { const row = await get<LocalProject>(id, db); if (!row)
    throw new Error('Local project not found'); parseProject(row.content); return row.content; }
/** Serialized writes plus atomic compare-and-swap prevent silent cross-tab overwrites. */
export class LocalWriter {
    private chain: Promise<void> = Promise.resolve();
    private expected = new Map<string, string>();
    adopt(content: string) { const p = parseProject(content); this.expected.set(p.id, content); }
    save(project: Project): Promise<void> {
        const row: LocalProject = { id: project.id, name: project.document.name ?? 'Untitled', revision: project.revision, updatedAt: new Date().toISOString(), content: JSON.stringify(project) };
        parseProject(row.content);
        this.chain = this.chain.catch(() => { }).then(async () => { await update<LocalProject>(row.id, current => { if (current && current.content !== this.expected.get(row.id) && current.content !== row.content)
            throw new Error('This project changed in another tab. Export your work, then reopen the local project.'); return row; }, db); this.expected.set(row.id, row.content); });
        return this.chain;
    }
}
