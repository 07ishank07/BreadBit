import { env } from 'cloudflare:workers';
import { handleCloud } from '../../../../../packages/cloud-projects/src/server';
export const dynamic = 'force-dynamic';
// Native traffic needs no CORS. Cookies and browser identity are never accepted
// by this API. Only scoped device credentials authorize project operations.
const previewOrigins = new Set(['http://127.0.0.1:1420', 'http://localhost:1420']);
async function route(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && !previewOrigins.has(origin)) return new Response('Origin not allowed', { status: 403 });
  let response: Response;
  if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
  else if (!env.DB) response = Response.json({ error: 'Project database is not configured.' }, { status: 503 });
  else response = await handleCloud(request, env.DB);
  if (origin && previewOrigins.has(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin); response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  }
  response.headers.set('Cache-Control', 'no-store'); return response;
}
export { route as GET, route as POST, route as PUT, route as DELETE, route as OPTIONS };
