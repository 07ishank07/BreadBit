import { useEffect, useMemo, useRef, useState } from 'react';
import { useSimulatorStore } from '@velxio/store/useSimulatorStore';
import { readPinInfo } from '@velxio/utils/readPinInfo';
import { CircuitViewport, adaptVelxioScene, type CircuitViewportHandle, type InteractionMode, type Selection, type SimulationSnapshot, type PinRef } from '../../../../packages/circuit-renderer/src';
import { layoutScale, moveInLayout, wireExists } from '../integrations/scene';
import type { ProjectController } from '../integrations/project';

type LiveElement = HTMLElement & { brightness?:number; pressed?:boolean; value?:number; angle?:number };
export default function Circuit3D({controller,notify}:{controller:ProjectController;notify:(message:string)=>void}) {
  const boards=useSimulatorStore(s=>s.boards), components=useSimulatorStore(s=>s.components), wires=useSimulatorStore(s=>s.wires);
  const scene=useMemo(()=>adaptVelxioScene({boards,components:components.map(c=>({...c,rotation:Number(c.properties?.rotation)||0})),wires},{mmPerPixel:layoutScale}),[boards,components,wires]);
  const viewport=useRef<CircuitViewportHandle>(null);
  const [mode,setMode]=useState<InteractionMode>('inspect');
  const [selection,setSelection]=useState<Selection>(null);
  const [grid,setGrid]=useState(true), [labels,setLabels]=useState(true);
  const [snapshot,setSnapshot]=useState<SimulationSnapshot>({});
  useEffect(()=>{
    const sample=()=>{
      const parts:NonNullable<SimulationSnapshot['parts']> extends Readonly<infer T> ? T : never = {};
      for(const part of scene.circuit.parts) {
        const el=document.getElementById(part.id) as LiveElement|null;
        if(!el)continue;
        parts[part.id]={
          ...(part.kind==='led' && typeof el.brightness==='number'?{brightness:el.brightness}:{}),
          ...(part.kind==='servo' && typeof el.angle==='number'?{angle:el.angle}:{}),
          ...(part.kind==='pushbutton'?{pressed:!!el.pressed}:{}),
          ...(part.kind==='potentiometer'?{value:Number(el.value ?? 0)/1023}:{}),
        };
      }
      setSnapshot(old=>JSON.stringify(old.parts)===JSON.stringify(parts)?old:{parts});
    };
    sample();const timer=setInterval(sample,80);return()=>clearInterval(timer);
  },[scene.circuit.parts]);
  function edit(label:string,change:()=>void) {
    try {
      controller.flush();
      const store=useSimulatorStore.getState();
      for(const board of store.boards)if(board.running)store.stopBoard(board.id);
      change();controller.flush();
      requestAnimationFrame(()=>useSimulatorStore.getState().recalculateAllWirePositions());
      notify(label+' · saved in project history. Simulation is stopped for circuit edits.');
    } catch(error) {notify(String(error));}
  }
  function remove() {
    if(!selection)return;
    if(selection.type==='part' && boards.some(b=>b.id===selection.id)){notify('Remove boards in the 2D workspace to manage their firmware groups.');return;}
    edit('Deleted selection',()=>{
      const s=useSimulatorStore.getState();
      if(selection.type==='wire')s.removeWire(selection.id);
      else {s.setWires(s.wires.filter(w=>w.start.componentId!==selection.id&&w.end.componentId!==selection.id));s.removeComponent(selection.id);}
    });setSelection(null);
  }
  function wire(from:PinRef,to:PinRef) {
    // Only exact IDs reported by the mounted host part are accepted. Never infer
    // electrical connectivity from a visual pin or approximate breadboard mesh.
    const endpoint=(pin:PinRef)=>{
      if(!readPinInfo(document.getElementById(pin.partId))?.some(p=>p.name===pin.pinId))throw new Error('This 3D pin has no verified host mapping. Connect it in 2D.');
      const part=boards.find(b=>b.id===pin.partId)??components.find(c=>c.id===pin.partId);
      if(!part)throw new Error('Component no longer exists');
      return {componentId:pin.partId,pinName:pin.pinId,x:part.x,y:part.y};
    };
    try {
      const start=endpoint(from),end=endpoint(to);
      if(wireExists(useSimulatorStore.getState().wires,start,end))throw new Error('That connection already exists or joins a pin to itself.');
      edit('Connected pins',()=>useSimulatorStore.getState().addWire({id:crypto.randomUUID(),start,end,color:'#48bb78',waypoints:[]}));
    }catch(error){notify(String(error));}
  }
  return <div className="bb-3d" onKeyDown={event=>{
    // Prevent the hidden upstream canvas from acting on 3D selection keystrokes.
    event.stopPropagation();
    if((event.key==='Delete'||event.key==='Backspace')&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLSelectElement)){event.preventDefault();remove();}
  }}>
    <div className="bb-3d-tools" aria-label="3D tools">
      {(['inspect','move','wire','interact'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}
      <button onClick={()=>viewport.current?.fit()}>Fit</button>
      <select aria-label="3D camera" defaultValue="isometric" onChange={e=>viewport.current?.setView(e.target.value as 'top'|'front'|'isometric')}><option value="isometric">Isometric</option><option value="top">Top</option><option value="front">Front</option></select>
      <label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>Grid</label>
      <label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/>Labels</label>
      <select aria-label="3D selection" value={selection?selection.type+':'+selection.id:''} onChange={e=>{const index=e.target.value.indexOf(':');setSelection(index<0?null:{type:e.target.value.slice(0,index) as 'part'|'wire',id:e.target.value.slice(index+1)});}}><option value="">Select part or wire</option>{scene.circuit.parts.map(p=><option key={p.id} value={'part:'+p.id}>{p.id} ({p.kind})</option>)}{scene.circuit.wires.map(w=><option key={w.id} value={'wire:'+w.id}>Wire: {w.from.partId}:{w.from.pinId} → {w.to.partId}:{w.to.pinId}</option>)}</select>
      <button disabled={!selection} onClick={remove}>Delete selected</button>
      <button onClick={()=>{const url=viewport.current?.capture();if(url){const a=document.createElement('a');a.href=url;a.download='breadbit-circuit.png';a.click();}}}>Export PNG</button>
    </div>
    <div className="bb-3d-viewport"><CircuitViewport ref={viewport} circuit={scene.circuit} snapshot={snapshot} mode={mode} selection={selection} onSelect={setSelection} showGrid={grid} showLabels={labels}
      onPartMove={(id,next)=>{
        const part=scene.circuit.parts.find(p=>p.id===id),host=boards.find(b=>b.id===id)??components.find(c=>c.id===id);if(!part||!host)return;
        const position=moveInLayout(part,next,host);
        edit('Moved component',()=>{const s=useSimulatorStore.getState();if(boards.some(b=>b.id===id))s.setBoardPosition(position,id);else {s.updateComponent(id,position);s.reseatComponentOnBreadboard(id);}});
      }}
      onPartRotate={(id,radians)=>edit('Rotated component',()=>{const s=useSimulatorStore.getState();const board=s.boards.find(b=>b.id===id);if(board){const desired=((-radians*180/Math.PI)%360+360)%360;const steps=Math.round(((desired-(board.rotation??0)+360)%360)/90);for(let i=0;i<steps;i++)s.rotateBoard(id);return;}s.updateComponent(id,{properties:{...s.components.find(c=>c.id===id)?.properties,rotation:((-radians*180/Math.PI)%360+360)%360}});s.reseatComponentOnBreadboard(id);})}
      onWireCreate={wire}
      onInputChange={({partId,property,value})=>{
        const el=document.getElementById(partId) as LiveElement|null;if(!el)return;
        if(property==='pressed'){el.pressed=Boolean(value);el.dispatchEvent(new CustomEvent(value?'button-press':'button-release'));}
        else {el.value=Math.round(Number(value)*1023);el.dispatchEvent(new Event('input'));}
      }}
      onError={error=>notify('3D: '+error.message+' You can return to 2D.')}/></div>
    <div className="bb-3d-help">{mode==='move'?'Drag to move · R rotates · arrows nudge · Shift = larger steps':mode==='interact'?'Hold buttons; click a potentiometer to step its input.':mode==='wire'?'Choose two pins. Unmapped pins are rejected.':'Drag to orbit · scroll to zoom · right-drag to pan'} · F fits · 1/2/3 camera</div>
    <details className="bb-3d-help"><summary>Model limits{scene.warnings.length?' · '+scene.warnings.length+' warnings':''}</summary>Approximate visual scale. Add components in 2D. Unknown models use placeholders; unmapped wires are omitted visually but preserved in the project. OLED pixels and voltage measurements are not mirrored.{scene.warnings.map((w,i)=><div key={i}>{w}</div>)}</details>
  </div>;
}
