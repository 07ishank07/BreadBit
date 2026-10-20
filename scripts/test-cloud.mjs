// Dependency-free contract checks on the actual TypeScript sources and SQLite.
// Node 22.15+ supplies registerHooks; the main application requires Node 22.12+.
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const candidate of [base.href, `${base.href}.ts`, `${base.href}/index.ts`]) {
        if (candidate.endsWith('.ts') && existsSync(fileURLToPath(candidate))) return { url: candidate, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url),'utf8'), { mode: 'transform', sourceUrl: url }) };
    return next(url, context);
  },
});
const { handleCloud, approveDevice } = await import('../packages/cloud-projects/src/server.ts');
const { ProjectCloud, CloudError, publicSnapshot, checkedProject } = await import('../packages/cloud-projects/src/protocol.ts');
const { ProjectSync } = await import('../packages/cloud-projects/src/sync.ts');
const project = (id = 'circuit') => ({ format: 'breadbit-project', version: 1, id, revision: 0, document: {
  format: 'velxio-project', version: 1, exportedAt: '2026-10-20T00:00:00.000Z', name: 'Button circuit',
  boards: [{ id: 'uno', boardKind: 'arduino-uno', x: 0, y: 0, activeFileGroupId: 'code', spiffsFiles: { hidden: 'PRIVATE_FS' }, firmware: 'PRIVATE_BINARY' }],
  components: [{ id: 'led', metadataId: 'led', x: 10, y: 20, properties: { color: 'red', privateExtension: 'PRIVATE_PROPERTY' } }],
  wires: [{ id: 'wire', start: { componentId: 'uno', pinName: '13', x: 0, y: 0 }, end: { componentId: 'led', pinName: 'A', x: 10, y: 20 }, waypoints: [], color: '#fff' }],
  fileGroups: { code: [{ name: 'main.ino', content: 'PRIVATE_SOURCE' }] }, activeBoardId: 'uno', extension: 'PRIVATE_EXTENSION',
} });
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../services/project-cloud/drizzle/0000_projects.sql', import.meta.url), 'utf8'));
  const db = { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; }, async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; }, async run() { return { meta: sqlite.prepare(sql).run(...values) }; } };
  }, async batch(statements) { sqlite.exec('BEGIN'); try { const values = []; for (const s of statements) values.push(await s.run()); sqlite.exec('COMMIT'); return values; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
  const send = (method, path, body, token) => handleCloud(new Request(`https://breadbit.example${path}`, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), db);
  async function login(owner) { const pair = await (await send('POST','/v1/pair',{})).json(); assert.equal(await approveDevice(db,pair.userCode,{id: owner,email:`${owner}@example.com`}),true); return { token: pair.deviceCode, pair }; }
  const cloud = token => new ProjectCloud({ async request(method,path,body) { const response = await send(method,path,body,token); const value = await response.json(); if (!response.ok) throw new CloudError(response.status,value.error,value.remote); return value; } });
  return { sqlite, db, send, login, cloud };
}
function memoryStore() {
  const entries = new Map();
  return { async get(owner,id) { return structuredClone(entries.get(`${owner}:${id}`)); }, async put(d) { entries.set(`${d.owner}:${d.project.id}`, structuredClone(d)); }, async list(owner) { return structuredClone([...entries.values()].filter(d => d.owner === owner)); } };
}

test('pairing requires browser approval; codes are single use; logout revokes credentials', async () => {
  const f = fixture(); const pair = await (await f.send('POST','/v1/pair',{})).json();
  assert.equal((await f.send('GET','/v1/me',undefined,pair.deviceCode)).status,401);
  assert.equal(await approveDevice(f.db,pair.userCode,{id:'alice',email:'alice@example.com'}),true);
  assert.equal(await approveDevice(f.db,pair.userCode,{id:'bob',email:'bob@example.com'}),false);
  assert.equal((await (await f.send('GET','/v1/me',undefined,pair.deviceCode)).json()).id,'alice');
  await f.send('DELETE','/v1/session',undefined,pair.deviceCode);
  assert.equal((await f.send('GET','/v1/me',undefined,pair.deviceCode)).status,401);
  assert.equal(await approveDevice(f.db,pair.userCode,{id:'alice',email:'alice@example.com'}),false);
});
test('private projects are isolated by authenticated owner; missing identity never saves', async () => {
  const f = fixture(), a = await f.login('alice'), b = await f.login('bob'); const p = project();
  assert.equal((await f.send('PUT','/v1/projects/circuit',{project:p,baseEtag:null,mutationId:'one'})).status,401);
  await f.cloud(a.token).save(p,null,'one');
  assert.deepEqual(await f.cloud(b.token).list(),[]);
  await assert.rejects(f.cloud(b.token).get(p.id),e => e.status === 404);
  const own = await f.cloud(a.token).get(p.id); assert.deepEqual(own.project,p);
});
test('save retries are idempotent and stale writers cannot overwrite the latest save', async () => {
  const f = fixture(), {token} = await f.login('alice'), api = f.cloud(token), p = project();
  const first = await api.save(p,null,'one'); assert.equal((await api.save(p,null,'one')).etag,first.etag);
  const next = structuredClone(p); next.document.name = 'New name';
  const second = await api.save(next,first.etag,'two');
  await assert.rejects(api.save(p,first.etag,'three'),e => e.status === 409 && e.remote.etag === second.etag);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM projects').get().n,1);
});
test('hidden firmware never appears in public data, including extension fields', () => {
  const p = project(); const snapshot = publicSnapshot(p,false);
  assert.equal(JSON.stringify(snapshot).includes('PRIVATE_'),false);
  assert.equal(snapshot.wires[0].from.pin,'13');
  const full = JSON.stringify(publicSnapshot(p,true)); assert.ok(full.includes('PRIVATE_SOURCE')); assert.ok(!full.includes('PRIVATE_FS')); assert.ok(!full.includes('PRIVATE_EXTENSION'));
  assert.equal(p.document.extension,'PRIVATE_EXTENSION');
});
test('shared snapshots stay fixed, update explicitly, and can be revoked', async () => {
  const f = fixture(), a = await f.login('alice'), b = await f.login('bob'), api = f.cloud(a.token), p = project();
  const saved = await api.save(p,null,'one'); const share = await api.publish(p.id,saved.etag,false);
  const original = f.sqlite.prepare('SELECT snapshot FROM shares').get().snapshot;
  p.document.name = 'Private change'; const changed = await api.save(p,saved.etag,'two');
  assert.equal(f.sqlite.prepare('SELECT snapshot FROM shares').get().snapshot,original);
  await assert.rejects(f.cloud(b.token).publish(p.id,changed.etag,true),e => e.status === 404);
  assert.equal((await api.publish(p.id,changed.etag,true)).url,share.url);
  assert.ok(f.sqlite.prepare('SELECT snapshot FROM shares').get().snapshot.includes('PRIVATE_SOURCE'));
  await api.unpublish(p.id); assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM shares').get().n,0);
});
test('offline drafts survive failure, sync after reconnect, and remain account scoped', async () => {
  const store = memoryStore(); let offline = true; const f = fixture(), {token} = await f.login('alice');
  const api = f.cloud(token), client = { save(...args) { if (offline) throw new TypeError('offline'); return api.save(...args); } };
  const sync = new ProjectSync('alice',store,client); await sync.stage(project()); await sync.flush();
  assert.equal((await store.get('alice','circuit')).dirty,true); assert.deepEqual(await store.list('bob'),[]);
  offline = false; await sync.flush(); assert.equal((await store.get('alice','circuit')).dirty,false);
});
test('conflicts persist until a user chooses; resolution uses the latest cloud precondition', async () => {
  const f = fixture(), {token} = await f.login('alice'), api = f.cloud(token), store = memoryStore(), sync = new ProjectSync('alice',store,api);
  const p = project(); const saved = await api.save(p,null,'one'); await sync.adopt(saved);
  const other = structuredClone(p); other.document.name='Other computer'; await api.save(other,saved.etag,'two');
  p.document.name='Local edit'; await sync.stage(p); await sync.flush();
  assert.equal((await store.get('alice',p.id)).conflict.project.document.name,'Other computer');
  await sync.flush(); assert.equal((await api.get(p.id)).project.document.name,'Other computer');
  await sync.resolve(p.id,'local'); await sync.flush(); assert.equal((await api.get(p.id)).project.document.name,'Local edit');
});
test('edits made while a save is in flight are retained and use the acknowledged cloud revision', async () => {
  const store = memoryStore(); let finish; let calls=0;
  const sync = new ProjectSync('alice',store,{ save(p) { calls++; return new Promise(resolve => { finish=()=>resolve({project:p,etag:'remote1',updatedAt:'now'}); }); } });
  const p=project(); await sync.stage(p); const pending=sync.flush();
  await new Promise(resolve => setImmediate(resolve));
  const sameFlight=sync.flush(); p.document.name='Newer local edit'; await sync.stage(p); finish(); await Promise.all([pending,sameFlight]);
  const draft=await store.get('alice',p.id); assert.equal(calls,1); assert.equal(draft.dirty,true); assert.equal(draft.project.document.name,'Newer local edit'); assert.equal(draft.baseEtag,'remote1');
});
test('invalid projects, mismatched IDs and oversized saves are rejected', async () => {
  assert.throws(()=>checkedProject({...project(),id:'../../secret'}));
  const p=project(); p.document.fileGroups.code[0].content='x'.repeat(1024*1024); assert.throws(()=>checkedProject(p));
  const f=fixture(),{token}=await f.login('alice');
  assert.equal((await f.send('PUT','/v1/projects/different',{project:project(),baseEtag:null,mutationId:'one'},token)).status,400);
});
test('expired pairing cannot authorize a device and anonymous pairing is rate limited', async () => {
  const f=fixture(); const pair=await (await f.send('POST','/v1/pair',{})).json();
  f.sqlite.prepare('UPDATE pairings SET expires_at=0').run();
  assert.equal(await approveDevice(f.db,pair.userCode,{id:'alice',email:'alice@example.com'}),false);
  for(let i=1;i<20;i++) assert.equal((await f.send('POST','/v1/pair',{})).status,200);
  assert.equal((await f.send('POST','/v1/pair',{})).status,429);
});
test('simultaneous first saves cannot silently overwrite each other', async () => {
  const f=fixture(),{token}=await f.login('alice'),api=f.cloud(token); const a=project(),b=project(); b.document.name='Other device';
  const results=await Promise.allSettled([api.save(a,null,'one'),api.save(b,null,'two')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
test('initial migration metadata matches the executable SQLite schema', () => {
  const f=fixture(); const snapshot=JSON.parse(readFileSync(new URL('../services/project-cloud/drizzle/meta/0000_snapshot.json',import.meta.url),'utf8'));
  for(const [name,table] of Object.entries(snapshot.tables)) {
    const actual=f.sqlite.prepare(`PRAGMA table_info('${name}')`).all();
    assert.deepEqual(actual.map(c=>c.name).sort(),Object.keys(table.columns).sort());
    for(const column of actual) { assert.equal(column.type,table.columns[column.name].type.toUpperCase()); assert.equal(Boolean(column.notnull),table.columns[column.name].notNull); }
  }
});
