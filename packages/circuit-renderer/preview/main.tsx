import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitViewport, builtinComponents, fixtureSnapshot, workbenchFixture, graphiteTheme, porcelainTheme, validateRendererEdit, benchmarkFixture } from '../src';
import type { CameraState, CircuitDocument, CircuitViewportHandle, InteractionMode, Quality, RendererCommand, Selection, SimulationSnapshot, ViewportStats } from '../src';
import './preview.css';

function Preview() {
  const [circuit, setCircuit] = useState<CircuitDocument>(workbenchFixture);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(fixtureSnapshot);
  const [selection, setSelection] = useState<Selection>({ type: 'part', id: 'uno' });
  const [mode, setMode] = useState<InteractionMode>('inspect');
  const [quality, setQuality] = useState<Quality>('balanced');
  const [revision, setRevision] = useState(0), [mounted, setMounted] = useState(true);
  const [scroll, setScroll] = useState<'pan' | 'zoom'>('pan');
  const [larger, setLarger] = useState(false), [reduced, setReduced] = useState(false), [light, setLight] = useState(false);
  const [labels, setLabels] = useState(true), [grid, setGrid] = useState(true);
  const [pinPart, setPinPart] = useState('uno'), [pinId, setPinId] = useState('12');
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [event, setEvent] = useState('Visual fixture. Electrical behaviour is not simulated.');
  const viewport = useRef<CircuitViewportHandle>(null), savedCamera = useRef<CameraState | undefined>(undefined);
  const commits = useRef<RendererCommand[]>([]), history = useRef<CircuitDocument[]>([]);
  const stats = useRef<ViewportStats>({ drawCalls: 0, triangles: 0, pixelRatio: 0 }), samples = useRef<ViewportStats[]>([]);
  const [rejectNext, setRejectNext] = useState(false);
  function command(command: RendererCommand) {
    if (command.expectedRevision !== revision || rejectNext) {
      setRejectNext(false);
      return { accepted: false as const, feedback: { code: 'rejected' as const, message: 'Preview host rejected the command.', entityIds: [], recovery: 'Review the candidate and retry.' } };
    }
    const invalid = validateRendererEdit(command.edit, circuit, builtinComponents);
    if (invalid) return { accepted: false as const, feedback: invalid };
    const edit = command.edit;
    history.current.push(circuit); commits.current.push(command);
    setCircuit(c => {
      if (edit.type === 'part.move') return { ...c, parts: c.parts.map(p => p.id === edit.id ? { ...p, position: edit.position } : p) };
      if (edit.type === 'part.rotate') return { ...c, parts: c.parts.map(p => p.id === edit.id ? { ...p, rotation: edit.radians } : p) };
      if (edit.type === 'wire.create') return { ...c, wires: [...c.wires, { id: command.actionId, from: edit.from, to: edit.to, waypoints: edit.waypoints, color: '#78c5a3' }] };
      if (edit.type === 'wire.delete') return { ...c, wires: c.wires.filter(w => w.id !== edit.id) };
      if (edit.type === 'wire.reconnect') return { ...c, wires: c.wires.map(w => w.id === edit.id ? { ...w, [edit.end]: edit.pin } : w) };
      return { ...c, wires: c.wires.map(w => w.id === edit.id ? { ...w, waypoints: edit.waypoints } : w) };
    });
    setRevision(n => n + 1); setEvent(command.label); return { accepted: true as const };
  }
  const undo = () => { const previous = history.current.pop(); if (previous) { setCircuit(previous); setRevision(n => n + 1); setEvent('Undid one renderer command'); } };
  useEffect(() => {
    // Preview-only API. It is not included in the library or BreadBit host.
    Object.assign(window, { rendererPreview: {
      projectPin: (pin: { partId: string; pinId: string }) => viewport.current?.projectPin(pin),
      getCircuit: () => circuit, getSnapshot: () => snapshot, getStats: () => stats.current, getSelection: () => selection,
      getHandle: () => viewport.current, getRevision: () => revision, getCommits: () => commits.current, getSamples: () => samples.current,
      clearSamples: () => { samples.current = []; }, setSelection, setMode, setMounted, setRejectNext, undo,
      replaceCircuit: (next: CircuitDocument) => { setCircuit(next); setRevision(n => n + 1); },
    } });
  }, [circuit, snapshot, selection, revision]);
  const capture = () => {
    const data = viewport.current?.capture(2);
    if (data) { const a = document.createElement('a'); a.href = data; a.download = 'circuit-workspace.png'; a.click(); setEvent('Exported PNG at 2x resolution'); }
  };
  const selectedWire = selection?.type === 'wire' ? circuit.wires.find(w => w.id === selection.id) : undefined;
  return <main className={`lab${light ? ' light' : ''}${larger ? ' larger' : ''}`}>
    <header><div><strong>BreadBit</strong><span>Spatial interaction laboratory</span></div><span role="status">{ready ? 'Renderer online' : 'Initialising'}</span><button onClick={capture}>Export view</button></header>
    <section className="layout">
      <div className="stage">
        <nav aria-label="Editing tools">{(['inspect', 'move', 'wire', 'interact'] as const).map(tool => <button key={tool} aria-pressed={mode === tool} onClick={() => setMode(tool)}>{tool === 'inspect' ? 'Select' : tool[0].toUpperCase() + tool.slice(1)}</button>)}<span/>
          <button onClick={undo}>Undo last edit</button><button aria-label="Isometric view" onClick={() => viewport.current?.setView('isometric')}>Isometric</button><button aria-label="Top view" onClick={() => viewport.current?.setView('top')}>Top</button><button aria-label="Front view" onClick={() => viewport.current?.setView('front')}>Front</button>
        </nav>
        <div className="viewport-wrap">{mounted && <CircuitViewport ref={viewport} circuit={circuit} snapshot={snapshot} selection={selection} mode={mode} quality={quality}
          theme={light ? porcelainTheme : graphiteTheme} showLabels={labels} showGrid={grid}
          navigation={{ twoFingerAction: scroll }} initialCameraState={savedCamera.current} onCameraChange={s => { savedCamera.current = s; }}
          largerTargets={larger} reducedMotion={reduced} labelScale={larger ? 1.25 : 1} projectRevision={revision} onCommand={command}
          onReady={() => setReady(true)} onError={e => setError(e.message)} onStats={s => { stats.current = s; if (samples.current.length < 2000) samples.current.push(s); }}
          onSelect={setSelection} onInputChange={change => { setSnapshot(s => ({ ...s, parts: { ...s.parts, [change.partId]: { ...s.parts?.[change.partId], [change.property]: change.value } } })); setEvent(`${change.partId}: ${change.property} = ${change.value}`); }}/>}</div>
        {error && <div role="alert">{error}</div>}
        <footer>{circuit.parts.length} components · {circuit.wires.length} cables · revision {revision}<span>Wheel pans · pinch zooms · F fits · Escape cancels</span></footer>
      </div>
      <aside aria-label="Renderer integration controls">
        <h2>Scene</h2>
        <label>Selection<select aria-label="Scene selection" value={selection ? `${selection.type}:${selection.id}` : ''} onChange={e => { const [type, ...id] = e.target.value.split(':'); setSelection(type ? { type: type as 'part' | 'wire', id: id.join(':') } : null); }}><option value="">Nothing selected</option>{circuit.parts.map(p => <option key={p.id} value={`part:${p.id}`}>{p.label ?? p.id}</option>)}{circuit.wires.map(w => <option key={w.id} value={`wire:${w.id}`}>Wire {w.id}</option>)}</select></label>
        {selectedWire && <><label>Wire label<input aria-label="Wire label" value={selectedWire.label ?? ''} onChange={e => { const label = e.target.value; setCircuit(c => ({ ...c, wires: c.wires.map(w => w.id === selectedWire.id ? { ...w, label } : w) })); setRevision(n => n + 1); }}/></label><label>Wire pattern<select aria-label="Wire pattern" value={selectedWire.pattern ?? 'solid'} onChange={e => { const pattern = e.target.value as 'solid' | 'dashed' | 'dotted'; setCircuit(c => ({ ...c, wires: c.wires.map(w => w.id === selectedWire.id ? { ...w, pattern } : w) })); setRevision(n => n + 1); }}><option>solid</option><option>dashed</option><option>dotted</option></select></label></>}
        <h2>Keyboard pin picker</h2>
        <label>Component<select aria-label="Pin component" value={pinPart} onChange={e => { setPinPart(e.target.value); setPinId(''); }}>{circuit.parts.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}</select></label>
        <label>Pin<select aria-label="Pin target" value={pinId} onChange={e => setPinId(e.target.value)}><option value="">Choose a pin</option>{(builtinComponents[circuit.parts.find(p => p.id === pinPart)?.kind ?? '']?.pins ?? []).map(p => <option key={p.id} value={p.id}>{p.label ?? p.id}</option>)}</select></label>
        <button disabled={!pinId} onClick={() => viewport.current?.choosePin({ partId: pinPart, pinId })}>Use selected pin</button>
        <p>The host validates each command. Pin geometry alone does not establish electrical support.</p>
        <h2>Graphics and navigation</h2>
        <label>Quality<select aria-label="Rendering quality" value={quality} onChange={e => setQuality(e.target.value as Quality)}><option value="draft">Draft</option><option value="balanced">Balanced</option><option value="high">High</option></select></label>
        <label>Two finger scroll<select aria-label="Two finger scroll" value={scroll} onChange={e => setScroll(e.target.value as 'pan' | 'zoom')}><option value="pan">Pan</option><option value="zoom">Zoom</option></select></label>
        <label>Surface grid<input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)}/></label>
        <label>Component labels<input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/></label>
        <label>Porcelain theme<input type="checkbox" checked={light} onChange={e => setLight(e.target.checked)}/></label>
        <label>Larger targets<input type="checkbox" checked={larger} onChange={e => setLarger(e.target.checked)}/></label>
        <label>Reduced motion<input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)}/></label>
        <label>Benchmark fixture<select aria-label="Benchmark fixture" defaultValue="showcase" onChange={e => { setCircuit(e.target.value === 'showcase' ? workbenchFixture : benchmarkFixture(Number(e.target.value))); setSelection(null); setRevision(n => n + 1); }}><option value="showcase">Showcase</option><option value="20">One board + 20 parts</option><option value="100">100 parts (diagnostic)</option><option value="300">300 parts (diagnostic)</option></select></label>
        <p>Presentation and interaction fixture only. No electrical simulation is performed here.</p>
      </aside>
    </section>
    <div className="statusbar" aria-live="polite">{event}</div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
