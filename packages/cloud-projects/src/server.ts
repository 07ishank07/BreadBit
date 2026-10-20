import { checkedProject, publicSnapshot, MAX_PROJECT_BYTES, type RemoteProject } from './protocol';

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes?: number } }>;
}
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> }
interface Row { content: string; etag: string; updated_at: string; mutation_id: string }
const result = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const remote = (row: Row): RemoteProject => ({ project: checkedProject(JSON.parse(row.content)), etag: row.etag, updatedAt: row.updated_at });
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Expected JSON.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Missing body.');
  let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.length;
    if (bytes > MAX_PROJECT_BYTES + 4096) { await reader.cancel(); throw new Error('Request too large.'); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  const parsed = JSON.parse(new TextDecoder().decode(buffer));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected an object.');
  return parsed;
}
export async function handleCloud(request: Request, db: Database): Promise<Response> {
  const url = new URL(request.url); const path = url.pathname; const now = Date.now();
  try {
    if (path === '/v1/pair' && request.method === 'POST') {
      // IP is supplied by the trusted edge, never by request JSON. Bounded per-hour
      // creation stops anonymous pairing from growing the database without limit.
      const bucket = await digest(`${request.headers.get('cf-connecting-ip') ?? 'local'}:${Math.floor(now / 3600000)}`);
      const rate = await db.prepare('INSERT INTO pair_limits (id, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(bucket, now + 7200000).first<{ count: number }>();
      if (!rate || rate.count > 20) return result({ error: 'Too many sign in attempts. Try again later.' }, 429);
      await db.batch([db.prepare('DELETE FROM pairings WHERE expires_at < ?').bind(now), db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now), db.prepare('DELETE FROM pair_limits WHERE expires_at < ?').bind(now)]);
      const deviceCode = token(), userCode = token(); const expiresAt = now + 600000;
      await db.prepare('INSERT INTO pairings (device_hash, user_code, expires_at) VALUES (?, ?, ?)').bind(await digest(deviceCode), userCode, expiresAt).run();
      return result({ deviceCode, userCode, verificationUrl: `${url.origin}/connect?code=${userCode}`, expiresAt });
    }
    const authorization = request.headers.get('authorization');
    const secret = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!secret) return result({ error: 'Sign in to save projects.' }, 401);
    const hash = await digest(secret);
    const account = await db.prepare('SELECT owner AS id, email FROM sessions WHERE token_hash=? AND expires_at>?').bind(hash, now).first<{ id: string; email: string }>();
    if (!account) return result({ error: 'Sign in again. Your local edits are retained.' }, 401);
    if (path === '/v1/me' && request.method === 'GET') return result(account);
    if (path === '/v1/session' && request.method === 'DELETE') {
      await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hash).run(); return result({ ok: true });
    }
    if (path === '/v1/projects' && request.method === 'GET') {
      const rows = await db.prepare('SELECT id, name, etag, updated_at AS updatedAt FROM projects WHERE owner=? ORDER BY updated_at DESC LIMIT 200').bind(account.id).all();
      return result(rows.results);
    }
    const match = path.match(/^\/v1\/projects\/([a-zA-Z0-9_-]{1,128})(\/share)?$/);
    if (!match) return result({ error: 'Unknown route.' }, 404);
    const [, id, share] = match;
    const get = () => db.prepare('SELECT content, etag, updated_at, mutation_id FROM projects WHERE owner=? AND id=?').bind(account.id, id).first<Row>();
    if (!share && request.method === 'GET') { const row = await get(); return row ? result(remote(row)) : result({ error: 'Project not found.' }, 404); }
    if (!share && request.method === 'PUT') {
      const input = await body(request); const project = checkedProject(input.project);
      if (project.id !== id || !validId(input.mutationId) || !(input.baseEtag === null || validId(input.baseEtag))) throw new Error('Invalid save preconditions.');
      const current = await get();
      if (current?.mutation_id === input.mutationId) {
        if (current.content !== JSON.stringify(project)) return result({ error: 'Mutation ID reused for different content.' }, 400);
        return result(remote(current));
      }
      if (!current && input.baseEtag !== null) return result({ error: 'Project no longer exists. Save a new copy.' }, 404);
      if (current && current.etag !== input.baseEtag) return result({ error: 'Resolve the conflicting edits before saving.', remote: remote(current) }, 409);
      const etag = crypto.randomUUID(), updatedAt = new Date(now).toISOString();
      const name = project.document.name || 'Untitled project'; const content = JSON.stringify(project);
      const saved = current
        ? await db.prepare('UPDATE projects SET name=?, content=?, etag=?, updated_at=?, mutation_id=? WHERE owner=? AND id=? AND etag=?').bind(name, content, etag, updatedAt, input.mutationId, account.id, id, input.baseEtag).run()
        : await db.prepare('INSERT OR IGNORE INTO projects (owner,id,name,content,etag,updated_at,mutation_id) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM projects WHERE owner=?) < 200').bind(account.id, id, name, content, etag, updatedAt, input.mutationId, account.id).run();
      if (!saved.meta.changes) {
        const latest = await get();
        return latest ? result({ error: 'Project changed while saving.', remote: remote(latest) }, 409) : result({ error: 'Prototype limit of 200 projects reached.' }, 422);
      }
      return result({ project, etag, updatedAt });
    }
    if (share && request.method === 'POST') {
      const input = await body(request);
      if (typeof input.includeFirmware !== 'boolean') throw new Error('Choose whether to include firmware.');
      const current = await get(); if (!current) return result({ error: 'Project not found.' }, 404);
      if (input.etag !== current.etag) return result({ error: 'Save and resolve changes before publishing.', remote: remote(current) }, 409);
      const publicId = token();
      const snapshot = JSON.stringify(publicSnapshot(remote(current).project, input.includeFirmware));
      // Conditional insert also prevents publishing stale content during a concurrent save.
      const changed = await db.prepare('INSERT INTO shares (owner,project_id,public_id,snapshot) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM projects WHERE owner=? AND id=? AND etag=?) ON CONFLICT(owner,project_id) DO UPDATE SET snapshot=excluded.snapshot').bind(account.id, id, publicId, snapshot, account.id, id, input.etag).run();
      if (!changed.meta.changes) return result({ error: 'Project changed before publication. Try again.' }, 409);
      const row = await db.prepare('SELECT public_id FROM shares WHERE owner=? AND project_id=?').bind(account.id, id).first<{ public_id: string }>();
      return result({ url: `${url.origin}/share/${row!.public_id}` });
    }
    if (share && request.method === 'DELETE') {
      await db.prepare('DELETE FROM shares WHERE owner=? AND project_id=?').bind(account.id, id).run(); return result({ ok: true });
    }
    return result({ error: 'Method not allowed.' }, 405);
  } catch (error) {
    // Validation errors are useful; database internals and stack traces are not.
    if (error instanceof Error && !/SQLITE|D1_|database/i.test(error.message)) return result({ error: error.message.slice(0,300) }, 400);
    return result({ error: 'Project service unavailable. Your local edits are retained.' }, 503);
  }
}

export async function approveDevice(db: Database, code: string, account: { id: string; email: string }) {
  if (!/^[a-f0-9]{64}$/.test(code)) return false;
  const now = Date.now();
  const saved = await db.prepare('INSERT OR IGNORE INTO sessions (token_hash,owner,email,expires_at) SELECT device_hash,?,?,? FROM pairings WHERE user_code=? AND expires_at>?').bind(account.id, account.email, now + 30 * 86400000, code, now).run();
  if (saved.meta.changes) await db.prepare('DELETE FROM pairings WHERE user_code=?').bind(code).run();
  return !!saved.meta.changes;
}
