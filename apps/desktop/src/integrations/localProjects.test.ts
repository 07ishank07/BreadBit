import { describe, it, expect, vi, beforeEach } from 'vitest';
const storage = vi.hoisted(() => ({ records: new Map<string, unknown>(), fail: false }));
vi.mock('idb-keyval', () => ({ createStore: () => ({}), get: async (id: string) => storage.records.get(id), values: async () => [...storage.records.values()], update: async (id: string, fn: (v: unknown) => unknown) => { if (storage.fail)
        throw new Error('Quota exceeded'); storage.records.set(id, fn(storage.records.get(id))); } }));
import { LocalWriter, readProject } from './localProjects';
import { starter } from './starter';
beforeEach(() => { storage.records.clear(); storage.fail = false; });
describe('Durable local projects', () => {
    it('serializes fast edits and reopens the last saved revision', async () => { const writer = new LocalWriter(), p = starter('saved'); const first = writer.save(p); p.revision++; p.document.name = 'renamed'; const next = writer.save(p); await Promise.all([first, next]); expect(JSON.parse(await readProject(p.id)).document.name).toBe('renamed'); });
    it('reports storage failure and can retry', async () => { const writer = new LocalWriter(), p = starter('failed'); storage.fail = true; await expect(writer.save(p)).rejects.toThrow('Quota'); storage.fail = false; await writer.save(p); expect(JSON.parse(await readProject(p.id)).id).toBe(p.id); });
    it('rejects stale concurrent edits rather than losing another tab’s work', async () => { const a = new LocalWriter(), b = new LocalWriter(), p = starter('shared'); await a.save(p); b.adopt(await readProject(p.id)); p.revision = 1; p.document.name = 'tab A'; await a.save(p); p.document.name = 'tab B'; await expect(b.save(p)).rejects.toThrow('another tab'); expect(JSON.parse(await readProject(p.id)).document.name).toBe('tab A'); });
});
