import { env } from 'cloudflare:workers';
import { requireChatGPTUser } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Connect({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = '' } = await searchParams;
  if (!/^[a-f0-9]{64}$/.test(code)) return <main><h1>Invalid device link</h1><p>Start sign in from BreadBit.</p></main>;
  const user = await requireChatGPTUser(`/connect?code=${code}`);
  const pair = await env.DB?.prepare('SELECT expires_at FROM pairings WHERE user_code=?').bind(code).first<{ expires_at: number }>();
  if (!pair || pair.expires_at < Date.now()) return <main><h1>Device link expired</h1><p>Start sign in again from BreadBit.</p></main>;
  return <main><a className="brand" href="/">BreadBit</a><p className="eyebrow">CONNECT YOUR DESKTOP</p><h1>Approve this device</h1><p>You are signed in as <strong>{user.email}</strong>.</p><p>Continue only if you started this request in BreadBit and its code matches:</p><p className="device-code">{code.slice(0,8).toUpperCase()}</p><form action="/connect/approve" method="post"><input type="hidden" name="code" value={code}/><button type="submit">Connect BreadBit</button></form><p>This device will be able to access and save your BreadBit projects. Return to the desktop after approving.</p></main>;
}
