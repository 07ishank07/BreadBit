import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitViewport, builtinComponents, fixtureSnapshot, workbenchFixture, graphiteTheme, porcelainTheme } from '../src';
import type { CircuitDocument, CircuitViewportHandle, InteractionMode, Quality, Selection, SimulationSnapshot } from '../src';
import './preview.css';

const modes: {id:InteractionMode;label:string;icon:string}[]=[{id:'inspect',label:'Orbit',icon:'◉'},{id:'move',label:'Move',icon:'✥'},{id:'wire',label:'Wire',icon:'⌁'},{id:'interact',label:'Interact',icon:'↗'}];
function Preview() {
  const [circuit,setCircuit]=useState<CircuitDocument>(workbenchFixture);
  const [snapshot,setSnapshot]=useState<SimulationSnapshot>(fixtureSnapshot);
  const [selection,setSelection]=useState<Selection>({type:'part',id:'uno'});
  const [mode,setMode]=useState<InteractionMode>('inspect');
  const [quality,setQuality]=useState<Quality>('high');
  const [light,setLight]=useState(false),[labels,setLabels]=useState(false),[grid,setGrid]=useState(true),[playing,setPlaying]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[event,setEvent]=useState('Viewport ready for integration');
  const viewport=useRef<CircuitViewportHandle>(null);
  const stats=useRef({drawCalls:0,triangles:0,pixelRatio:0});
  const part=selection?.type==='part'?circuit.parts.find(p=>p.id===selection.id):undefined;
  const definition=part?builtinComponents[part.kind]:undefined;
  const visuals=part?snapshot.parts?.[part.id]:undefined;
  useEffect(()=>{
    if(!playing)return;
    const start=performance.now();
    const timer=setInterval(()=>{const t=(performance.now()-start)/1000;
      setSnapshot(s=>({...s,parts:{...s.parts,led:{brightness:(Math.sin(t*3)+1)/2},servo:{angle:90+Math.sin(t)*65},screen:{displayLines:['SIGNAL PREVIEW',`${t.toFixed(1)} seconds`]}}}));
    },70);
    return()=>clearInterval(timer);
  },[playing]);
  useEffect(()=>{
    // The test harness is scoped to this preview, never shipped in the library.
    Object.assign(window,{rendererPreview:{projectPin:(pin:{partId:string;pinId:string})=>viewport.current?.projectPin(pin),getCircuit:()=>circuit,getSnapshot:()=>snapshot,getStats:()=>stats.current,getSelection:()=>selection}});
  },[circuit,snapshot,selection]);
  const capture=()=>{const data=viewport.current?.capture(2);if(data){const a=document.createElement('a');a.href=data;a.download='circuit-workspace.png';a.click();setEvent('Scene exported at 2× resolution');}};
  return <main className={light?'laboratory light':'laboratory'}>
    <header className="masthead"><div className="identity"><div className="logo">C<span>◦</span></div><div><h1>Component laboratory</h1><p>3D RENDERING FRAMEWORK <span>/</span> 0.1</p></div></div>
      <div className="header-right"><span className="status"><i/> {ready?'Renderer online':'Initialising'}</span><button onClick={capture} className="export">↗ <span>Export view</span></button></div>
    </header>
    <section className="workspace">
      <div className="stage">
        <div className="stage-caption"><span>WORKBENCH 01</span><h2>Made to connect.</h2><p>Procedural components. One shared circuit.</p></div>
        <div className="viewport-wrap"><CircuitViewport ref={viewport} circuit={circuit} snapshot={snapshot} selection={selection} mode={mode} quality={quality}
          theme={light?porcelainTheme:graphiteTheme} showLabels={labels} showGrid={grid}
          onReady={()=>setReady(true)} onError={e=>setError(e.message)} onStats={s=>{stats.current=s;}}
          onSelect={setSelection}
          onPartMove={(id,position)=>{setCircuit(c=>({...c,parts:c.parts.map(p=>p.id===id?{...p,position}:p)}));setEvent(`Moved ${id}`);}}
          onPartRotate={(id,rotation)=>{setCircuit(c=>({...c,parts:c.parts.map(p=>p.id===id?{...p,rotation}:p)}));setEvent(`Rotated ${id}`);}}
          onWireCreate={(from,to)=>{setCircuit(c=>({...c,wires:[...c.wires,{id:`wire-${Date.now()}`,from,to,color:'#94e9c2'}]}));setEvent(`Connected ${from.partId}:${from.pinId} to ${to.partId}:${to.pinId}`);}}
          onInputChange={change=>{setSnapshot(s=>({...s,parts:{...s.parts,[change.partId]:{...s.parts?.[change.partId],[change.property]:change.value}}}));setEvent(`${change.partId}: ${change.property} = ${change.value}`);}}/>
        </div>
        <div className="view-controls" role="group" aria-label="Camera views"><button aria-label="Isometric view" onClick={()=>viewport.current?.setView('isometric')}>Iso</button><button aria-label="Top view" onClick={()=>viewport.current?.setView('top')}>Top</button><button aria-label="Front view" onClick={()=>viewport.current?.setView('front')}>Front</button><span/><button aria-label="Fit circuit" onClick={()=>viewport.current?.fit()}>⌖ Fit</button></div>
        <div className="tool-dock" role="toolbar" aria-label="Viewport tools">{modes.map(m=><button key={m.id} aria-label={m.label} aria-pressed={mode===m.id} className={mode===m.id?'active':''} onClick={()=>setMode(m.id)}><b>{m.icon}</b><span>{m.label}</span></button>)}</div>
        <div className="stage-footer"><span>{circuit.parts.length} components <i/> {circuit.wires.length} connections</span><span>MM <i/> Y UP</span></div>
        {error&&<div className="error" role="alert">{error}</div>}
      </div>
      <aside className="inspector">
        <div className="panel-title"><span>SCENE EXPLORER</span><span>08</span></div>
        <div className="part-list">{circuit.parts.map((p,i)=><button key={p.id} onClick={()=>setSelection({type:'part',id:p.id})} className={selection?.type==='part'&&selection.id===p.id?'selected':''} aria-pressed={selection?.type==='part'&&selection.id===p.id}><span className={`part-dot dot-${p.kind}`}/><span>{p.label??p.kind}</span><small>{String(i+1).padStart(2,'0')}</small></button>)}</div>
        <section className="detail"><span className="eyebrow">SELECTED COMPONENT</span><h3>{part?.label??(selection?.type==='wire'?'Jumper wire':'Nothing selected')}</h3><p>{definition?.label??'Select a component in the workspace.'}</p>
          {part&&<><dl><div><dt>Identifier</dt><dd>{part.id}</dd></div><div><dt>Connections</dt><dd>{circuit.wires.filter(w=>w.from.partId===part.id||w.to.partId===part.id).length}</dd></div><div><dt>Position · mm</dt><dd>{part.position.map(n=>n.toFixed(1)).join(' / ')}</dd></div></dl>
            {part.kind==='led'&&<label className="range">Brightness <input aria-label="LED brightness" type="range" min="0" max="1" step="0.01" value={visuals?.brightness??0} onChange={e=>setSnapshot(s=>({...s,parts:{...s.parts,[part.id]:{brightness:Number(e.target.value)}}}))}/></label>}
            {part.kind==='servo'&&<label className="range">Horn angle <input aria-label="Servo angle" type="range" min="0" max="180" value={visuals?.angle??90} onChange={e=>setSnapshot(s=>({...s,parts:{...s.parts,[part.id]:{angle:Number(e.target.value)}}}))}/></label>}
          </>}
        </section>
        <section className="settings"><span className="eyebrow">RENDER SETTINGS</span><label>Quality<select aria-label="Rendering quality" value={quality} onChange={e=>setQuality(e.target.value as Quality)}><option value="draft">Draft · 1×</option><option value="balanced">Balanced · 2×</option><option value="high">High · 3×</option></select></label>
          <label>Surface grid<input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/></label><label>Component labels<input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/></label><label>Porcelain theme<input type="checkbox" checked={light} onChange={e=>setLight(e.target.checked)}/></label>
          <button className="signal-preview" aria-pressed={playing} onClick={()=>setPlaying(v=>!v)}>{playing?'Ⅱ Pause':'▷ Preview'} signals</button>
          <p className="disclaimer">Visual fixture only. Signal values are supplied by this preview, not an electrical simulator.</p>
        </section>
      </aside>
    </section>
    <footer className="statusbar"><span aria-live="polite">{event}</span><span>Drag to orbit <i/> Scroll to zoom <i/> F to frame</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
