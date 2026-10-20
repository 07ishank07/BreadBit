import {nativeAvailable,openNative,saveNativeAs} from './integrations/native';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CodeEditor } from '@velxio/components/editor/CodeEditor';
import { FileExplorer } from '@velxio/components/editor/FileExplorer';
import { SimulatorCanvas } from '@velxio/components/simulator/SimulatorCanvas';
import { Oscilloscope } from '@velxio/components/simulator/Oscilloscope';
import { useOscilloscopeStore } from '@velxio/store/useOscilloscopeStore';
import { SerialMonitor } from '@velxio/components/simulator/SerialMonitor';
import { MessageDialogHost } from '@velxio/components/ui/MessageDialogHost';
import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import { startSimulation } from '@velxio/simulation/spice/start';
import { setThemeMode, getMode } from '@velxio/lib/theme';
import { ProjectController, recoveryKey } from './integrations/project';
import { LocalWriter, listProjects, readProject, type LocalProject } from './integrations/localProjects';
import { downloadBlob } from './integrations/pdf';
import { starter } from './integrations/starter';
import { pinsFor, type Selected } from './integrations/editing';
import { shortcut } from './integrations/shortcuts';
import { Dialog } from './features/Dialog';
import { BuildControls } from './features/BuildControls';
import { WireEditor, type WireSeed } from './features/WireEditor';
import { Schematic } from './features/Schematic';
const Circuit3D = lazy(() => import('./features/Circuit3D'));
type View = '2d' | 'schematic' | '3d';
const prefKey = 'breadbit.preferences.v1';
function readPrefs() { try {
    return JSON.parse(localStorage.getItem(prefKey) ?? '{}');
}
catch {
    return {};
} }
export function App() {
    const [controller] = useState(() => new ProjectController()), [writer] = useState(() => new LocalWriter()), [, render] = useState(0);
    const [view, setView] = useState<View>('2d'), [code, setCode] = useState(false), [inspector, setInspector] = useState(false), [dialog, setDialog] = useState<'projects' | 'new' | 'settings' | 'help' | null>(null);
    const [name, setName] = useState('Uno + button + LED'), [notice, setNotice] = useState('Add parts in 2D. Use Connections for precise wire editing in any view.'), [saveState, setSaveState] = useState('Opening local projects…'), [rows, setRows] = useState<LocalProject[]>([]), [seed, setSeed] = useState<WireSeed>(), [selected, setSelected] = useState(''), [prefs, setPrefs] = useState(readPrefs), [recovery, setRecovery] = useState<string | null>(null);
    const [selection, setSelection] = useState<Selected>(null);
    const input = useRef<HTMLInputElement>(null), initialized = useRef(false), saveSequence = useRef(0), savedSequence = useRef(0), pending = useRef<Promise<void>>(Promise.resolve());
    const boards = useSimulatorStore(s => s.boards), parts = useSimulatorStore(s => s.components), serial = useSimulatorStore(s => s.serialMonitorOpen), scope = useOscilloscopeStore(s => s.open);
    const project = controller.project;
    function fail(e: unknown) { setNotice(e instanceof Error ? e.message : String(e)); }
    function persist() { const sequence = ++saveSequence.current; setSaveState('Saving locally…'); const snapshot = controller.project; pending.current = writer.save(snapshot).then(() => { if (sequence === saveSequence.current) {
        savedSequence.current = sequence;
        setSaveState('Saved locally');
        try {
            localStorage.setItem('breadbit.last-project', snapshot.id);
        }
        catch { }
    } }, e => { if (sequence === saveSequence.current)
        setSaveState('Save failed — export a file'); fail(e); throw e; }); void pending.current.catch(() => { }); }
    useEffect(() => {
        const unsub = controller.subscribe(() => { render(n => n + 1); if (initialized.current)
            persist(); });
        const detach = controller.attach();
        let cancelled = false;
        void (async () => { try {
            const draft = localStorage.getItem(recoveryKey);
            const last = localStorage.getItem('breadbit.last-project');
            if (last) {
                const content = await readProject(last);
                if (!cancelled) {
                    writer.adopt(content);
                    let restoreContent=content;
                    if(draft){try{const recovered=JSON.parse(draft),saved=JSON.parse(content);if(recovered.id===saved.id&&recovered.revision>saved.revision){restoreContent=draft;setNotice('Restored a newer recovery draft.');}}catch{}}
                    controller.load(restoreContent);
                }
            }
            if (draft) {const saved=controller.project;try{const recovered=JSON.parse(draft);if(!last||(recovered.id===saved.id&&recovered.revision>saved.revision))setRecovery(draft);}catch{}}
        }
        catch (e) {
            fail(e);
            try {
                setRecovery(localStorage.getItem(recoveryKey));
            }
            catch { }
        }
        finally {
            if (!cancelled) {
                initialized.current = true;
                persist();
            }
        } })();
        return () => { cancelled = true; unsub(); detach(); };
    }, [controller, writer]);
    useEffect(() => startSimulation(), []);
    useEffect(() => { try {
        localStorage.setItem(prefKey, JSON.stringify(prefs));
    }
    catch { } }, [prefs]);
    useEffect(() => { const handler = (e: BeforeUnloadEvent) => { controller.flush(); if (saveSequence.current !== savedSequence.current) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [controller]);
    async function beforeSwitch() { controller.flush(); await pending.current; }
    function exportFile() { try {
        const content=controller.serialize();if(nativeAvailable){void saveNativeAs(content).then(file=>{if(file)setNotice('Exported '+file.path);}).catch(fail);}else downloadBlob(content, (project.document.name ?? 'project') + '.breadbit');
        setNotice('Project file export requested.');
    }
    catch (e) {
        fail(e);
    } }
    async function importFile(){if(!nativeAvailable){input.current?.click();return;}try{const file=await openNative();if(!file)return;await beforeSwitch();const raw=JSON.parse(file.content);if(raw.format==='breadbit-project')raw.id=crypto.randomUUID();controller.load(JSON.stringify(raw));setNotice('Imported '+file.path);}catch(e){fail(e);}}
    async function library() { try {
        controller.flush();
        await pending.current;
        setRows(await listProjects());
        setDialog('projects');
    }
    catch (e) {
        fail(e);
    } }
    useEffect(() => { const keyboard = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null, editing = !!target?.closest('input,textarea,select,[contenteditable="true"],.monaco-editor,dialog'); const action = shortcut(event.key, event.ctrlKey, event.metaKey, event.shiftKey, editing); if (!action || event.altKey) {
        if (view === 'schematic' && !editing && ['Delete', 'Backspace', 'r', 'R', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.stopImmediatePropagation();
        }
        return;
    } event.preventDefault(); event.stopImmediatePropagation(); try {
        if (action === 'save' || action === 'saveAs')
            exportFile();
        else if (action === 'open')
            void importFile();
        else {
            controller[action]();
            setNotice(action === 'undo' ? 'Edit undone.' : 'Edit redone.');
        }
    }
    catch (e) {
        fail(e);
    } }; window.addEventListener('keydown', keyboard, true); return () => window.removeEventListener('keydown', keyboard, true); });
    function connect(value: WireSeed) { setSelection(null); setSeed(value); setInspector(true); }
    useEffect(() => useSimulatorStore.subscribe((s, prev) => { if (s.selectedWireId !== prev.selectedWireId && s.selectedWireId)
        setSelection({ type: 'wire', id: s.selectedWireId }); }), []);
    const entity = [...boards, ...parts].find(p => p.id === selected);
    return <MemoryRouter><div className={'bb-app bb-workbench' + (prefs.large ? ' bb-large' : '') + (prefs.motion ? ' bb-reduced-motion' : '')}>
 <a className="bb-skip" href="#circuit-workspace">Skip to circuit</a><header className="bb-header"><strong className="bb-brand"><span className="bb-mark">B</span>BreadBit</strong><span className="bb-project-name">{project.document.name ?? 'Untitled'}</span><nav aria-label="Project actions"><button onClick={() => setDialog('new')}>New</button><button onClick={() => void library()}>Projects</button><button onClick={() => void importFile()}>Import</button><button onClick={exportFile}>Export</button><button title={controller.history.undoLabel ?? 'Undo'} disabled={!controller.history.canUndo} onClick={() => {controller.undo();setNotice('Edit undone.');}}>Undo</button><button title={controller.history.redoLabel ?? 'Redo'} disabled={!controller.history.canRedo} onClick={() => {controller.redo();setNotice('Edit redone.');}}>Redo</button><button onClick={() => setDialog('settings')}>Settings</button><button onClick={() => setDialog('help')}>Help</button></nav></header>
 <div className="bb-modebar" aria-label="Workspace views">{(['2d', 'schematic', '3d'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => { setView(v); setSeed(undefined); }}>{v === '2d' ? '2D layout' : v === '3d' ? '3D view' : 'Schematic'}</button>)}<span className="bb-spacer"/><button aria-pressed={code} onClick={() => setCode(!code)}>Code</button><button aria-pressed={inspector} onClick={() => setInspector(!inspector)}>Connections & inspector</button></div>
 <BuildControls controller={controller} notify={setNotice}/>
 {recovery && <div className="bb-recovery">Recovery draft available.<button onClick={() => { try {
        controller.load(recovery);
        setRecovery(null);
    }
    catch (e) {
        fail(e);
    } }}>Restore draft</button><button onClick={() => setRecovery(null)}>Dismiss</button></div>}
 <main className="bb-workspace"><section className="bb-editor"><div className="bb-panes"><section hidden={!code} className="bb-code-panel" style={{ width: prefs.codeWidth ?? 400 }} aria-label="Firmware"><div className="bb-pane-title"><strong>Firmware</strong><button onClick={() => setCode(false)}>Close code</button></div><details><summary>Files</summary><div style={{ height: 150 }}><FileExplorer onSaveClick={exportFile} onNewClick={() => setDialog('new')}/></div></details><div className="bb-code-body"><CodeEditor /></div><label>Code width<input type="range" min="250" max="700" step="10" value={prefs.codeWidth ?? 400} onChange={e => setPrefs({ ...prefs, codeWidth: Number(e.target.value) })}/></label></section>
 <section id="circuit-workspace" tabIndex={-1} className="bb-circuit" aria-label="Circuit workspace"><div className="bb-canvas-layer" onPointerDownCapture={e => { const id = (e.target as HTMLElement).closest('[data-component-id]')?.getAttribute('data-component-id'); if (id) {
        setSelected(id);
        setSelection({ type: 'part', id });
    } }} style={{ visibility: view === '2d' ? 'visible' : 'hidden' }} inert={view !== '2d'}><SimulatorCanvas /></div>{view === 'schematic' && <Schematic controller={controller} connect={connect} notify={setNotice} onSelect={s=>{setSelection(s);if(s?.type==='part')setSelected(s.id);setInspector(true);}}/>}{view === '3d' && <Suspense fallback={<p>Loading 3D…</p>}><Circuit3D controller={controller} notify={setNotice} selection={selection} setSelection={s => { setSelection(s); if (s?.type === 'part')
        setSelected(s.id); }}/></Suspense>}</section></div>{serial && <div className="bb-instrument"><SerialMonitor /></div>}{scope && <div className="bb-instrument"><Oscilloscope /></div>}</section>
 {inspector && <aside className="bb-inspector bb-properties" style={{ width: prefs.inspectorWidth ?? 340 }} aria-label="Connections and inspector"><div className="bb-pane-title"><strong>Inspector</strong><button onClick={() => setInspector(false)}>Close</button></div><label>Component<select value={selected} onChange={e => { setSelected(e.target.value); setSelection(e.target.value ? { type: 'part', id: e.target.value } : null); }}><option value="">Choose component</option>{[...boards, ...parts].map(p => <option key={p.id}>{p.id}</option>)}</select></label>{entity && <><h2>Pins & connections</h2><p>{'boardKind' in entity?'Uno: D0–D13 are digital I/O, A0–A5 are analog inputs; GND pins share ground. A4/A5 also carry I²C.':({led:'LED: A is the anode, C the cathode. Use a series resistor to limit current.',resistor:'A resistor limits current; its two terminals are not internally shorted.',pushbutton:'Button: 1.l and 1.r are internally joined; 2.l and 2.r are joined. Pressing connects the two groups.',breadboard:'Breadboard: each five-hole strip shares a net; the central trench separates strips. Check rail labels.'} as Record<string,string>)[entity.metadataId]??'Use the exact component pin names below. Simulation support varies by component.'}</p><p>Select a mapped pin in Connections to wire it. Matching schematic net labels indicate electrical continuity.</p><details><summary>Physical position (no dragging)</summary>{(['x', 'y'] as const).map(axis => <label key={axis}>{axis}<input type="number" defaultValue={entity[axis]} key={entity.id + axis + entity[axis]} onBlur={e => { try {
            const n = Number(e.target.value);
            if (!Number.isFinite(n))
                throw new Error('Enter a finite coordinate');
            controller.commit('Move component', () => { const st = useSimulatorStore.getState(); for (const b of st.boards)
                if (b.running)
                    st.stopBoard(b.id); const pos = { x: entity.x, y: entity.y, [axis]: n }; if ('boardKind' in entity)
                st.setBoardPosition(pos, entity.id);
            else {
                st.updateComponent(entity.id, pos);
                st.reseatComponentOnBreadboard(entity.id);
            } st.recalculateAllWirePositions(); });
        }
        catch (error) {
            fail(error);
        } }}/></label>)}</details><p>{pinsFor(entity.id).join(', ') || 'Pin definitions are loading or unavailable.'}</p><ul>{project.document.wires.filter(w => w.start.componentId === selected || w.end.componentId === selected).map(w => <li key={w.id}>{w.start.componentId}:{w.start.pinName} → {w.end.componentId}:{w.end.pinName}</li>)}</ul>{'metadataId' in entity && <details><summary>Properties</summary>{Object.entries(entity.properties).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).map(([key, value]) => <label key={key}>{key}<input defaultValue={String(value)} key={selected + key + String(value)} onBlur={e => { try {
            const val = typeof value === 'number' ? Number(e.target.value) : typeof value === 'boolean' ? e.target.value === 'true' : e.target.value;
            if (typeof val === 'number' && !Number.isFinite(val))
                throw new Error('Enter a finite number');
            controller.commit('Change ' + key, () => { const s = useSimulatorStore.getState(); for (const b of s.boards)
                if (b.running)
                    s.stopBoard(b.id); s.updateComponent(entity.id, { properties: { ...entity.properties, [key]: val } }); });
        }
        catch (error) {
            fail(error);
        } }}/></label>)}</details>}</>}
 <WireEditor key={view} controller={controller} notify={setNotice} seed={seed} selectedWire={selection?.type === 'wire' ? selection.id : undefined} onSelect={id => setSelection(id ? { type: 'wire', id } : null)} schematic={view === 'schematic'}/><details><summary>Panel width</summary><input aria-label="Inspector width" type="range" min="280" max="500" step="10" value={prefs.inspectorWidth ?? 340} onChange={e => setPrefs({ ...prefs, inspectorWidth: Number(e.target.value) })}/></details></aside>}
 </main><footer className="bb-status"><span role="status">{controller.recoveryError ?? notice}</span><span aria-live="polite">{saveState} · Rev {project.revision}</span></footer>
 {dialog === 'new' && <Dialog title="New project" close={() => setDialog(null)}><label>Project name<input value={name} onChange={e => setName(e.target.value)} maxLength={100}/></label><p>Uno, button, LED and 220 Ω resistor, with example firmware. Connect D2 to button 1.l and button 2.l to GND; connect D13 through the resistor to LED A, and LED C to GND. Build before Run.</p><button onClick={() => void (async () => { try {
        await beforeSwitch();
        controller.load(JSON.stringify(starter(name.trim() || 'Untitled')));
        setDialog(null);
        setRecovery(null);
        setSelected('');
        setNotice('Starter created. Add the connections, then Build.');
    }
    catch (e) {
        fail(e);
    } })()}>Create starter</button></Dialog>}
 {dialog === 'projects' && <Dialog title="Local projects" close={() => setDialog(null)}><p>Saved on this device and browser profile. Export files for backup or transfer. Clearing browser data removes local projects.</p>{rows.map(row => <div className="bb-project-row" key={row.id}><div><strong>{row.name}</strong><small>Revision {row.revision} · {new Date(row.updatedAt).toLocaleString()}</small></div><button onClick={() => void (async () => { try {
        await beforeSwitch();
        const content = await readProject(row.id);
        writer.adopt(content);
        controller.load(content);
        setDialog(null);
        setSelected('');
        setNotice('Local project opened. Build before Run.');
    }
    catch (e) {
        fail(e);
    } })()}>Open {row.name}</button></div>)}</Dialog>}
 {dialog === 'settings' && <Dialog title="Workspace settings" close={() => setDialog(null)}><label>Theme<select defaultValue={getMode()} onChange={e => setThemeMode(e.target.value as 'dark' | 'light' | 'system')}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label><input type="checkbox" checked={!!prefs.large} onChange={e => setPrefs({ ...prefs, large: e.target.checked })}/> Larger text and controls</label><label><input type="checkbox" checked={!!prefs.motion} onChange={e => setPrefs({ ...prefs, motion: e.target.checked })}/> Reduced interface motion</label><p>Schematic uses visible net names as well as lines. Wire labels and endpoint lists are available in every view. Numeric bend controls avoid precision dragging.</p><p>3D starts top-down and offers quality presets. Configurable trackpad pan/orbit gestures remain part of Agent A’s renderer work.</p></Dialog>}
 {dialog === 'help' && <Dialog title="Workbench guide" close={() => setDialog(null)}><ol><li>New creates an Uno + button + LED starter.</li><li>Use 2D to add parts. Open Connections to select exact source and destination pins, reconnect, label, recolor or delete wires.</li><li>In Schematic, click a source pin, optional bends and a destination. Review its physical route before applying. Escape cancels.</li><li>Code opens the firmware. Build compiles; Run only accepts the current successful build. The compiler backend must be configured first.</li><li>Projects autosave locally. Export a file for backup. Schematic offers vector PDF export.</li></ol><p>Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo · Ctrl/Cmd+S export · Ctrl/Cmd+O import. Text editors keep their own undo. Range controls can be adjusted with arrow keys.</p><p>Simulation accuracy and desktop runtime qualification are still pending. A successful build does not verify circuit behavior. AI provider integration is not connected.</p></Dialog>}
 <input hidden ref={input} type="file" accept=".breadbit,.json,.vlx" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file)
        return; void (async () => { try {
        if (file.size > 16 * 1024 * 1024)
            throw new Error('Project exceeds 16 MiB');
        const content = await file.text();
        await beforeSwitch();
        const raw = JSON.parse(content);
        if (raw.format === 'breadbit-project')
            raw.id = crypto.randomUUID();
        controller.load(JSON.stringify(raw));
        setSelected('');
        setNotice('Imported as a new local project.');
    }
    catch (error) {
        fail(error);
    } })(); }}/><MessageDialogHost />
 </div></MemoryRouter>;
}
