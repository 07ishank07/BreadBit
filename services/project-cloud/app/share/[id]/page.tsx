import { env } from 'cloudflare:workers';
import { notFound } from 'next/navigation';
import type { SharedSnapshot } from '../../../../../packages/cloud-projects/src/protocol';
export const dynamic = 'force-dynamic';
export default async function SharedProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) notFound();
  const row = await env.DB?.prepare('SELECT snapshot FROM shares WHERE public_id=?').bind(id).first<{ snapshot: string }>();
  if (!row) notFound();
  const snapshot = JSON.parse(row.snapshot) as SharedSnapshot;
  const parts = [...snapshot.boards, ...snapshot.components];
  const columns = Math.min(4, Math.max(parts.length,1));
  const positions = new Map(parts.map((p,i) => [p.id,{ x: 90 + (i % columns) * 190, y: 65 + Math.floor(i / columns) * 100 }]));
  return <main className="viewer"><a className="brand" href="/">BreadBit</a><p className="eyebrow">SHARED PROJECT · VIEW ONLY</p><h1>{snapshot.name}</h1><p>Published {new Date(snapshot.publishedAt).toLocaleString('en-AU', { timeZone: 'UTC' })} UTC. This is a fixed snapshot.</p>
    <section><h2>Circuit overview</h2><p>A simplified diagram of explicit connections. Placement, breadboard buses and simulation behaviour are not represented.</p>
      <svg role="img" aria-label="Simplified circuit connections" viewBox={`0 0 ${columns * 190} ${Math.max(1,Math.ceil(parts.length / columns)) * 100 + 30}`}>
        {snapshot.wires.map(w => { const a = positions.get(w.from.id), b = positions.get(w.to.id); return a && b ? <line key={w.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5a9d94" strokeWidth="2"/> : null; })}
        {parts.map(p => { const point = positions.get(p.id)!; return <g key={p.id}><rect x={point.x-75} y={point.y-25} width="150" height="50" rx="8" fill="#173b3c" stroke="#72b3a2"/><text x={point.x} y={point.y-4} textAnchor="middle" fill="#fff" fontSize="11">{p.kind.slice(0,23)}</text><text x={point.x} y={point.y+13} textAnchor="middle" fill="#b2ccc9" fontSize="10">{p.id.slice(0,25)}</text></g>; })}
      </svg><h2>Connections</h2><table><thead><tr><th>Wire</th><th>From</th><th>To</th></tr></thead><tbody>{snapshot.wires.map(w => <tr key={w.id}><td>{w.id}</td><td>{w.from.id}:{w.from.pin}</td><td>{w.to.id}:{w.to.pin}</td></tr>)}</tbody></table>
    </section><section><h2>Firmware</h2>{snapshot.includeFirmware ? snapshot.firmware?.map((f,i) => <details key={i}><summary>{f.group} / {f.name}</summary><pre><code>{f.content}</code></pre></details>) : <p>The owner has not included firmware in this snapshot.</p>}</section></main>;
}
