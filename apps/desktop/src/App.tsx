import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { NewProjectDialog } from '@velxio/components/editor/NewProjectDialog';
import { createProject } from '../../../packages/project-core/src';
import { CodeEditor } from '@velxio/components/editor/CodeEditor';
import { FileExplorer } from '@velxio/components/editor/FileExplorer';
import { EditorToolbar } from '@velxio/components/editor/EditorToolbar';
import { CompilationConsole } from '@velxio/components/editor/CompilationConsole';
import { SimulatorCanvas } from '@velxio/components/simulator/SimulatorCanvas';
import { SerialMonitor } from '@velxio/components/simulator/SerialMonitor';
import { Oscilloscope } from '@velxio/components/simulator/Oscilloscope';
import { MessageDialogHost } from '@velxio/components/ui/MessageDialogHost';
import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import { useCompileLogsStore } from '@velxio/store/useCompileLogsStore';
import { useOscilloscopeStore } from '@velxio/store/useOscilloscopeStore';
import { startSimulation } from '@velxio/simulation/spice/start';
import { AI_TOOLS, validateVlx } from '../../../packages/project-core/src';
import { ProjectController, recoveryKey } from './integrations/project';
import { nativeAvailable, openNative, saveNative, saveNativeAs, runtimeStatus, type NativeDocument } from './integrations/native';

import { shortcut } from './integrations/shortcuts';
const Circuit3D = lazy(() => import('./features/Circuit3D'));

function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [controller] = useState(() => new ProjectController());
  const [, render] = useState(0);
  const [nativeFile, setNativeFile] = useState<NativeDocument | null>(null);
  const [saved, setSaved] = useState(-1);
  const [notice, setNotice] = useState('Start with the Uno workspace. Add components with the + button on the circuit.');
  const [panel, setPanel] = useState<'project' | 'assistant' | 'runtime'>('project');
  const [view, setView] = useState<'2d'|'3d'>('2d');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(() => { try { return localStorage.getItem(recoveryKey); } catch { return null; } });
  const input = useRef<HTMLInputElement>(null);
  const logs = useCompileLogsStore(s => s.logs);
  const setLogs = useCompileLogsStore(s => s.setLogs);
  const running = useSimulatorStore(s => s.running);
  const serialOpen = useSimulatorStore(s => s.serialMonitorOpen);
  const scopeOpen = useOscilloscopeStore(s => s.open);
  const project = controller.project;
  const diagnostics = validateVlx(project.document);
  const dirty = project.revision !== saved;

  useEffect(() => controller.subscribe(() => render(x => x + 1)), [controller]);
  useEffect(() => controller.attach(), [controller]);
  // The simulator stays mounted when the inspector changes; its runtime is not a view tab.
  useEffect(() => startSimulation(), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      controller.flush();
      if (controller.project.revision !== saved) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [controller, saved]);
  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function save(as = false) {
    await act(async () => {
      const content = controller.serialize();
      const revision = controller.project.revision;
      if (nativeAvailable) {
        const file = !as && nativeFile ? await saveNative(nativeFile, content) : await saveNativeAs(content);
        if (!file) return;
        setNativeFile(file); setSaved(revision); setNotice(`Saved ${file.path}`);
      } else {
        download(content, 'project.breadbit'); setSaved(revision);
        setNotice('Project export requested. Browser preview uses downloads; the desktop app uses native files.');
      }
    });
  }
  function newProject() {
    controller.flush();
    if (controller.project.revision !== saved && !window.confirm('Discard unsaved changes and start a new project?')) return;
    controller.load(JSON.stringify(createProject({format:'velxio-project',version:1,exportedAt:new Date().toISOString(),name:'Untitled',boards:[],components:[],wires:[],fileGroups:{},activeBoardId:null},crypto.randomUUID())));
    setNativeFile(null); setSaved(-1); setNewDialog(true);
  }
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = !!target?.closest('input,textarea,select,[contenteditable="true"],.monaco-editor,[role="dialog"]');
      const action = shortcut(event.key, event.ctrlKey, event.metaKey, event.shiftKey, editing);
      if (!action || event.altKey) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (action === 'save' || action === 'saveAs') void save(action === 'saveAs');
      else if (action === 'open') void open();
      else void act(async () => { controller[action](); setNotice(action === 'undo' ? 'Project edit undone; runtime state is reset.' : 'Project edit redone; runtime state is reset.'); });
    };
    window.addEventListener('keydown', keyboard, true);
    return () => window.removeEventListener('keydown', keyboard, true);
  });
  async function open() {
    controller.flush();
    if (controller.project.revision !== saved && !window.confirm('Discard unsaved changes and open another project? Save first to keep your current work.')) return;
    if (!nativeAvailable) { input.current?.click(); return; }
    await act(async () => {
      const file = await openNative(); if (!file) return;
      const imported = JSON.parse(file.content).format === 'velxio-project';
      controller.load(file.content); setNativeFile(imported ? null : file);
      setSaved(imported ? -1 : controller.project.revision); setNotice(imported ? 'Imported Velxio project. Save As creates a BreadBit file.' : `Opened ${file.path}`);
    });
  }
  return <MemoryRouter><div className="bb-app">
    <header className="bb-header">
      <a className="bb-brand" href="#" onClick={event => event.preventDefault()} aria-label="BreadBit workbench"><span className="bb-mark">B</span><strong>BreadBit</strong><span className="bb-label">WORKBENCH</span></a>
      <span className="bb-project-name">{nativeFile?.path.split(/[\\/]/).pop() ?? 'Untitled project'}{dirty ? ' •' : ''}</span>
      <nav aria-label="Project actions">
        <button onClick={() => void act(async () => newProject())} disabled={busy}>New</button>
        <button onClick={() => void open()} disabled={busy}>Open</button>
        <button onClick={() => void save()} disabled={busy}>Save</button>
        <button onClick={() => void save(true)} disabled={busy}>Save as</button>
        <button onClick={() => void act(async () => controller.undo())} disabled={!controller.history.canUndo}>Undo</button>
        <button onClick={() => void act(async () => controller.redo())} disabled={!controller.history.canRedo}>Redo</button>
      </nav>
      <span className="bb-version">Workbench · 0.2</span>
    </header>
    <div className="bb-modebar"><button aria-pressed={view==='2d'} onClick={()=>setView('2d')}>2D workspace</button><button aria-pressed={view==='3d'} onClick={()=>setView('3d')}>3D workspace</button><span className="bb-mode-note">Circuit + firmware</span><span className={running ? 'bb-running' : 'bb-idle'}>{running ? 'Simulation running' : 'Simulation stopped'}</span></div>
    {recovery && <div className="bb-recovery">A previous recovery draft is available.<button onClick={() => void act(async () => { controller.load(recovery); setNativeFile(null); setSaved(-1); setRecovery(null); setNotice('Recovery draft restored. Save it to a project file.'); })}>Restore draft</button><button onClick={() => setRecovery(null)}>Dismiss</button></div>}
    <main className="bb-workspace">
      <section className="bb-editor" aria-label="Electronics editor">
        <EditorToolbar consoleOpen={consoleOpen} setConsoleOpen={setConsoleOpen} compileLogs={logs} setCompileLogs={setLogs}/>
        <div className="bb-runtime-note">{import.meta.env.VITE_BREADBIT_DEV_BACKEND === '1' ? 'Development backend proxy enabled; compiler and board core readiness must still be checked.' : 'Compiler pack is not connected. Edit circuits and code, or import compiled firmware through the editor.'} Board support is not yet qualified for desktop.</div>
        <div className="bb-panes">
          <aside className="bb-files"><FileExplorer onSaveClick={() => void save()} onNewClick={() => void act(async () => newProject())}/></aside>
          <section className="bb-code" aria-label="Firmware"><CodeEditor/></section>
          <section className="bb-circuit" aria-label="Circuit workspace"><div className="bb-canvas-layer" style={{visibility:view==='2d'?'visible':'hidden'}} inert={view!=='2d'}><SimulatorCanvas/></div>{view==='3d' && <Suspense fallback={<p>Loading 3D workspace…</p>}><Circuit3D controller={controller} notify={setNotice}/></Suspense>}</section>
        </div>
        <div className="bb-output"><CompilationConsole isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} logs={logs} onClear={() => setLogs([])}/></div>
        {serialOpen && <div className="bb-instrument"><SerialMonitor/></div>}
        {scopeOpen && <div className="bb-instrument"><Oscilloscope/></div>}
      </section>
      <aside className="bb-inspector" aria-label="Project inspector">
        <div className="bb-tabs" role="tablist" aria-label="Inspector">
          {(['project', 'assistant', 'runtime'] as const).map(name => <button role="tab" id={`tab-${name}`} aria-controls="inspector-panel" aria-selected={panel === name} key={name} onClick={() => setPanel(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}
        </div>
        <div className="bb-panel" id="inspector-panel" role="tabpanel" aria-labelledby={`tab-${panel}`}>
          {panel === 'project' && <>
            <p className="bb-eyebrow">YOUR PROJECT</p><h1>One connected workspace</h1><p className="bb-subtle">Build in 2D and inspect or edit the same circuit in 3D. BreadBit keeps a versioned project snapshot and recovery draft.</p>
            <dl className="bb-stats"><div><dt>Boards</dt><dd>{project.document.boards.length}</dd></div><div><dt>Parts</dt><dd>{project.document.components.length}</dd></div><div><dt>Wires</dt><dd>{project.document.wires.length}</dd></div></dl>
            <h2>Connections</h2><p className="bb-subtle">Explicit wire endpoints. Breadboard buses and implied nets are not expanded here.</p>
            <div className="bb-connections">{project.document.wires.length ? project.document.wires.map(wire => <div key={wire.id}><code>{wire.start.componentId}:{wire.start.pinName}</code><span>↔</span><code>{wire.end.componentId}:{wire.end.pinName}</code></div>) : <p>No wires yet.</p>}</div>
            <h2>Validation</h2>{diagnostics.map((d, i) => <p className="bb-diagnostic" key={i}>{d.message}</p>)}
            <button className="bb-wide" onClick={() => void act(async () => { controller.flush(); download(JSON.stringify(controller.project.document, null, 2), 'project.vlx'); setNotice('Exported the compatible circuit and firmware document. BreadBit history is not included.'); })}>Export Velxio .vlx</button>
          </>}
          {panel === 'assistant' && <>
            <p className="bb-eyebrow">ASSISTANT FOUNDATION</p><h1>Grounded in your project</h1><p className="bb-subtle">The structured tool boundary is implemented. A model provider and simulation test runner are not connected yet.</p>
            <h2>Available context</h2><p>{project.document.boards.length} boards, {project.document.components.length} parts, {project.document.wires.length} wires and firmware files. No project data is sent to an AI service.</p>
            <h2>Tool contracts</h2><ul>{AI_TOOLS.map(tool => <li key={tool}><code>{tool}</code></li>)}</ul>
            <h2>Evidence</h2><p className="bb-diagnostic">No verified scenario run. Compiling firmware alone cannot establish correct circuit behavior.</p>
            <button className="bb-wide" onClick={() => { controller.flush(); setNotice('Structural inspection refreshed. Pin qualification and electrical correctness need their own checks.'); }}>Inspect project</button>
          </>}
          {panel === 'runtime' && <>
            <p className="bb-eyebrow">LOCAL DEVELOPMENT</p><h1>Runtime readiness</h1><dl className="bb-runtime-list"><dt>Host</dt><dd>{nativeAvailable ? 'Tauri desktop' : 'Browser development preview'}</dd><dt>2D editor / firmware editor</dt><dd>Integrated from pinned Velxio</dd><dt>AVR engine</dt><dd>Included; desktop qualification pending</dd><dt>Local compiler / QEMU</dt><dd>Not bundled</dd><dt>Project files</dt><dd>{nativeAvailable ? 'Native dialogs and atomic saves' : 'Import and download'}</dd><dt>Recovery</dt><dd>Local draft; not a substitute for saved files</dd><dt>Schematic editor</dt><dd>Planned; not implemented in this frame</dd></dl>
            <button className="bb-wide" onClick={() => void act(async () => setNotice(nativeAvailable ? (await runtimeStatus()).backend.message : 'Native runtime status is available after launching with npm run desktop:dev.'))}>Check native runtime</button>
          </>}
        </div>
      </aside>
    </main>
    <footer className="bb-status" role="status"><span>{controller.recoveryError ?? notice}</span><span>Revision {project.revision} · {nativeAvailable ? 'Desktop' : 'Development preview'}</span></footer>
    <input hidden ref={input} type="file" accept=".breadbit,.json,.vlx" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      void act(async () => { if (file.size > 16 * 1024 * 1024) throw new Error('Project exceeds 16 MiB.'); controller.load(await file.text()); setNativeFile(null); setSaved(-1); setNotice(`Imported ${file.name}`); });
    }}/><NewProjectDialog isOpen={newDialog} onClose={() => setNewDialog(false)}/><MessageDialogHost/>
  </div></MemoryRouter>;
}
