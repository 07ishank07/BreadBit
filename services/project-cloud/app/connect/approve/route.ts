import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { approveDevice } from '../../../../../packages/cloud-projects/src/server';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response('Invalid request origin', { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 2048) return new Response('Request too large', { status: 413 });
  const user = await getChatGPTUser();
  if (!user || !env.DB) return new Response('Sign in before approving this device.', { status: 401 });
  const reader = request.body?.getReader(); if (!reader) return new Response('Missing request body', { status: 400 });
  let raw = ''; const decoder = new TextDecoder(); let bytes = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.length;
    if (bytes > 2048) { await reader.cancel(); return new Response('Request too large', { status: 413 }); }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  const code = new URLSearchParams(raw).get('code') || '';
  const approved = await approveDevice(env.DB, code, { id: user.userId, email: user.email });
  if (!approved) return new Response('This device link expired or was already used. Start again from BreadBit.', { status: 409 });
  return new Response('BreadBit is connected. You can close this page and return to the desktop.', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
