import { useEffect, useRef, useState } from 'react';
import type { useCloudProjects } from './useCloudProjects';
import type { Project } from '../../../../../packages/project-core/src';
import './cloud.css';
import { openCloudPage } from './transport';

type Cloud = ReturnType<typeof useCloudProjects>;
const labels = { local: 'Saved on this device', syncing: 'Synchronising', saved: 'Saved to cloud', offline: 'Saved offline', conflict: 'Conflict needs your decision', signin: 'Sign in to synchronise', error: 'Cloud save needs attention' };
export function CloudPanel({ cloud, project }: { cloud: Cloud; project: Project }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [includeFirmware, setIncludeFirmware] = useState(false);
  const [share, setShare] = useState('');
  const activeProject = useRef(project.id); activeProject.current = project.id;
  useEffect(() => { setShare(''); setIncludeFirmware(false); }, [project.id]);
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setMessage(''); try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const draft = cloud.local.find(d => d.project.id === project.id);
  const projects = new Map(cloud.projects.map(p => [p.id, { id: p.id, name: p.name, offline: false }]));
  for (const d of cloud.local) projects.set(d.project.id, { id: d.project.id, name: d.project.document.name || 'Untitled project', offline: true });
  return <section className="bb-cloud" aria-label="Account and projects">
    <p className="bb-eyebrow">YOUR ACCOUNT</p><h1>Projects, wherever you build</h1>
    <p className="bb-subtle">Your edits stay on this device while offline. Shared links show only the snapshot you publish.</p>
    {cloud.account ? <><p>{cloud.account.email}</p><p role="status">{labels[cloud.status]}{!cloud.onlineSession && '. Sign in again to connect this session.'}</p><button disabled={busy} onClick={() => void run(cloud.logout)}>Sign out</button></> : <p>Try the editor freely. Sign in to save or export projects.</p>}
    {!cloud.onlineSession && <button disabled={busy || !!cloud.pairing} onClick={() => void run(cloud.login)}>Sign in with ChatGPT</button>}
    {cloud.pairing && <div className="bb-cloud-card"><h2>Approve this device</h2><p>Check that the browser shows this code:</p><code>{cloud.pairing.userCode.slice(0,8).toUpperCase()}</code><p><button onClick={() => void run(() => openCloudPage('connect', cloud.pairing!.userCode))}>Open sign in page</button></p><p>Desktop opens your browser automatically. If needed, copy this address into your browser:</p><input aria-label="Sign in address" readOnly value={cloud.pairing.verificationUrl}/></div>}
    {(message || cloud.error) && <p role="alert">{message || cloud.error}</p>}
    {cloud.account && <>
      <label>Project name<input key={project.id + project.document.name} defaultValue={project.document.name || 'Untitled project'} maxLength={200} onBlur={e => { if (e.target.value !== project.document.name) void run(() => cloud.rename(e.target.value)); }}/></label>
      <div className="bb-cloud-actions"><button disabled={busy} onClick={() => void run(cloud.save)}>Save now</button><button disabled={busy} onClick={() => void run(cloud.refresh)}>Refresh projects</button></div>
      {draft?.conflict && <div className="bb-cloud-card" role="alert"><h2>Resolve conflicting edits</h2><p>Both versions are preserved locally until you choose. Review the documents below, then choose the complete version to keep.</p><details><summary>Local project</summary><pre>{JSON.stringify(draft.project, null, 2)}</pre></details><details><summary>Cloud project</summary><pre>{JSON.stringify(draft.conflict.project, null, 2)}</pre></details><button disabled={busy} onClick={() => void run(() => cloud.resolve('local'))}>Keep my local version</button><button disabled={busy} onClick={() => void run(() => cloud.resolve('remote'))}>Use the cloud version</button></div>}
      <h2>Your projects</h2><div className="bb-cloud-projects">{[...projects.values()].map(p => <button key={p.id} disabled={busy} onClick={() => void run(() => cloud.open(p.id))}>{p.name}<small>{p.offline ? 'Available on this device' : 'Cloud'}</small></button>)}</div>
      <h2>Share this project</h2><label><input type="checkbox" checked={includeFirmware} onChange={e => setIncludeFirmware(e.target.checked)}/> Include firmware source</label><p className="bb-subtle">Anyone with the link can view this snapshot. Future saves stay private until you update it. Sharing includes a simplified circuit diagram and exact explicit connections.</p>
      <button disabled={busy || !cloud.onlineSession} onClick={() => void run(async () => { const url = await cloud.publish(includeFirmware); if (activeProject.current === project.id) setShare(url); })}>Publish or update snapshot</button><button disabled={busy || !cloud.onlineSession} onClick={() => void run(async () => { await cloud.unpublish(); setShare(''); setMessage('Viewing link revoked.'); })}>Revoke viewing link</button>
      {share && <p><input aria-label="Public viewing link" value={share} readOnly/><button onClick={() => void run(() => openCloudPage('share', new URL(share).pathname.split('/').pop()!))}>View published snapshot</button></p>}
    </>}
  </section>;
}
