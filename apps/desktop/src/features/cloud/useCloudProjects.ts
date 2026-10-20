import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectController } from '../../integrations/project';
import { ProjectCloud, CloudError, type Account, type ProjectSummary } from '../../../../../packages/cloud-projects/src/protocol';
import { ProjectSync, type Draft, type SyncStatus } from '../../../../../packages/cloud-projects/src/sync';
import { createProject } from '../../../../../packages/project-core/src';
import { drafts, rememberedAccount, rememberAccount } from './storage';
import { beginLogin, pollLogin, signOut, transport, type PublicPairing } from './transport';

export function useCloudProjects(controller: ProjectController, notice: (message: string) => void, enabled: boolean) {
  const api = useMemo(() => new ProjectCloud(transport), []);
  const [account, setAccount] = useState<Account | null>(null);
  const [onlineSession, setOnlineSession] = useState(false);
  const [pairing, setPairing] = useState<PublicPairing | null>(null);
  const [status, setStatus] = useState<SyncStatus>('signin');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [local, setLocal] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sync = useRef<ProjectSync | null>(null);
  const flushing = useRef(false);
  const loginGeneration = useRef(0);
  const accountId = useRef<string | null>(null);
  accountId.current = account?.id ?? null;
  const refresh = async () => {
    if (!account) return;
    const owner = account.id;
    const saved = await drafts.list(owner);
    if (accountId.current === owner) setLocal(saved);
    if (onlineSession) {
      try {
        const remote = await api.list();
        if (accountId.current === owner) setProjects(remote);
      } catch (e) {
        if (accountId.current !== owner) return;
        if (e instanceof CloudError && e.status === 401) { setOnlineSession(false); setStatus('signin'); }
        else if (e instanceof CloudError) setError(e.message);
        else setStatus('offline');
      }
    }
  };
  useEffect(() => { if (!enabled) return; let active = true; void rememberedAccount().then(a => { if (active && a && loginGeneration.current === 0) setAccount(a); }).catch(e => setError(String(e))); return () => { active = false; }; }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    if (!account) { controller.setRecoveryEnabled(false); return; }
    controller.setRecoveryEnabled(false); // Authenticated drafts are account scoped in IndexedDB.
    const engine = new ProjectSync(account.id, drafts, api, (next, message) => {
      setStatus(next); if (message) notice(message);
      if (next === 'signin') setOnlineSession(false);
    });
    sync.current = engine;
    // Do not upload the current workspace just because another account signed in.
    // Only explicit save or subsequent design edits stage it for that account.
    let active = true;
    const capture = () => { void engine.stage(controller.project).then(() => drafts.list(account.id)).then(saved => { if (active) setLocal(saved); }).catch(e => { if (active) setError(String(e)); }); };
    const unsubscribe = controller.subscribe(capture);
    void drafts.list(account.id).then(saved => { if (active) setLocal(saved); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; unsubscribe(); engine.stop(); if (sync.current === engine) sync.current = null; };
  }, [account?.id, api, controller, enabled]);
  useEffect(() => {
    if (!onlineSession || !account) return;
    let active = true;
    const tick = async () => {
      if (!active || flushing.current || !navigator.onLine) return;
      flushing.current = true;
      try { await sync.current?.flush(); const saved = await drafts.list(account.id); if (active) setLocal(saved); }
      catch (e) { if (active) setError(String(e)); }
      finally { flushing.current = false; }
    };
    const timer = setInterval(() => void tick(), 2500);
    void api.list().then(list => { if (active) setProjects(list); }).catch(e => { if (active) setError(String(e)); });
    window.addEventListener('online', tick); void tick();
    return () => { active = false; clearInterval(timer); window.removeEventListener('online', tick); };
  }, [onlineSession, account?.id]);
  useEffect(() => {
    if (!pairing) return;
    let active = true; let pending = false;
    const generation = loginGeneration.current;
    const timer = setInterval(async () => {
      if (Date.now() >= pairing.expiresAt) { setPairing(null); setError('Sign in expired. Try again.'); return; }
      if (pending) return; pending = true;
      try {
        const user = await pollLogin();
        if (!active || generation !== loginGeneration.current) return;
        if (accountId.current && accountId.current !== user.id) {
          controller.flush(); await sync.current?.stage(controller.project); sync.current?.stop();
          controller.load(JSON.stringify(createProject({ format:'velxio-project', version:1, exportedAt:new Date().toISOString(), name:'Untitled', boards:[], components:[], wires:[], fileGroups:{}, activeBoardId:null }, crypto.randomUUID())));
        }
        await rememberAccount(user); setAccount(user); setOnlineSession(true); setPairing(null); setError(null); setStatus('local');
        notice('Signed in. Save this project or open one from your account.');
      } catch (e) { if (!(e instanceof CloudError && e.status === 401) && active) setError('Waiting for sign in or a network connection.'); }
      finally { pending = false; }
    }, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [pairing]);
  async function login() { setError(null); loginGeneration.current++; setPairing(await beginLogin()); }
  async function logout() {
    controller.flush(); await sync.current?.stage(controller.project);
    loginGeneration.current++; setPairing(null); sync.current?.stop(); sync.current = null;
    setOnlineSession(false); setAccount(null); setProjects([]); setLocal([]); setStatus('signin');
    controller.load(JSON.stringify(createProject({ format:'velxio-project', version:1, exportedAt:new Date().toISOString(), name:'Untitled', boards:[], components:[], wires:[], fileGroups:{}, activeBoardId:null }, crypto.randomUUID())));
    await rememberAccount(null);
    try { await signOut(); } catch { notice('Signed out on this device. Remote revocation could not be confirmed while offline.'); }
  }
  async function save() {
    if (!account || !sync.current) { notice('Sign in to save your project.'); return false; }
    controller.flush(); await sync.current.stage(controller.project);
    // Commit local storage before reporting success, even if the network is absent.
    if (onlineSession && !flushing.current) { flushing.current = true; try { await sync.current.flush(controller.project.id); } finally { flushing.current = false; } }
    await refresh(); return true;
  }
  async function open(id: string) {
    if (!account || !sync.current) return;
    const owner = account.id, engine = sync.current;
    controller.flush(); const original = JSON.stringify(controller.project);
    await engine.stage(controller.project);
    let draft = await drafts.get(account.id, id);
    if (onlineSession && !draft?.dirty) {
      try {
        const remote = await api.get(id); if (accountId.current !== owner) return;
        await engine.adopt(remote); draft = await drafts.get(owner, id);
      } catch (e) {
        if (e instanceof CloudError && e.status !== 401) throw e;
        if (!draft) throw new Error('Connect to the cloud once to make this project available offline.');
        if (e instanceof CloudError) setOnlineSession(false);
        setStatus('offline');
      }
    }
    if (!draft) throw new Error('This project is not available offline.');
    if (accountId.current !== owner) return;
    controller.flush();
    if (JSON.stringify(controller.project) !== original) throw new Error('The workspace changed while opening. Your new edits are retained; open the project again.');
    controller.load(JSON.stringify(draft.project)); await refresh();
  }
  async function resolve(choice: 'local' | 'remote') {
    const id = controller.project.id, owner = accountId.current;
    controller.flush(); await sync.current?.stage(controller.project);
    if (controller.project.id !== id || accountId.current !== owner) throw new Error('The selected project changed. Review its conflict again.');
    const project = await sync.current?.resolve(id, choice);
    if (project && controller.project.id === id && accountId.current === owner) controller.load(JSON.stringify(project));
    await refresh();
  }
  async function publish(includeFirmware: boolean) {
    if (!account || !onlineSession) throw new Error('Sign in online to publish a snapshot.');
    const id = controller.project.id, owner = account.id;
    await save();
    if (controller.project.id !== id || accountId.current !== owner) throw new Error('The selected project changed. Review sharing again.');
    const draft = await drafts.get(owner, id);
    if (!draft || draft.dirty || draft.conflict || !draft.baseEtag) throw new Error('Finish synchronising and resolve conflicts before publishing.');
    return (await api.publish(draft.project.id, draft.baseEtag, includeFirmware)).url;
  }
  return { account, onlineSession, pairing, status, projects, local, error, login, logout, save, open, resolve, publish,
    refresh, rename: async (name: string) => { controller.rename(name); }, unpublish: () => api.unpublish(controller.project.id) };
}
