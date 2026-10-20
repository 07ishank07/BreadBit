import { useEffect, useState, useRef } from 'react';
import type { ProjectController } from '../integrations/project';
import { schematicScene, type SheetLayout, type Point } from '../integrations/schematic';
import { pinsFor,type Selected } from '../integrations/editing';
import { schematicPdf, downloadBlob, type PdfOptions } from '../integrations/pdf';
import type { WireSeed } from './WireEditor';
import { Dialog } from './Dialog';
export function Schematic({ controller, connect, notify,onSelect }: {
    controller: ProjectController;
    connect: (seed: WireSeed) => void;
    notify: (s: string) => void; onSelect:(s:Selected)=>void;
}) {
    const scroll=useRef<HTMLDivElement>(null);
    const doc = controller.project.document;
    const [tick, setTick] = useState(0), [draft, setDraft] = useState<WireSeed | null>(null), [zoom, setZoom] = useState(1), [selected, setSelected] = useState(''), [pdf, setPdf] = useState(false), [options, setOptions] = useState<PdfOptions>({ paper: 'A4', landscape: true, partsList: false });
    useEffect(() => { const t = setTimeout(() => setTick(n => n + 1), 500); return () => clearTimeout(t); }, [doc.boards.length, doc.components.length]);
    void tick;
    const pins = Object.fromEntries([...doc.boards, ...doc.components].map(p => [p.id, pinsFor(p.id)]));
    const scene = schematicScene(doc, pins, (doc.schematic ?? {}) as SheetLayout);
    function fit(){const el=scroll.current;if(el)setZoom(Math.max(.35,Math.min(1,(el.clientWidth-25)/scene.width,(el.clientHeight-25)/scene.height)));}
    useEffect(()=>{fit();},[tick]);
    const symbol = scene.symbols.find(s => s.id === selected);
    function pin(value: string) { if (!draft) {
        setDraft({ start: value, bends: [] });
        notify('Choose optional bends, then a destination pin. Escape cancels.');
    }
    else {
        connect({ ...draft, end: value });
        setDraft(null);
    } }
    function move(axis: 'x' | 'y', value: number) { if (!symbol || !Number.isFinite(value))
        return; try {
        controller.presentation('Move schematic symbol', d => { const layout = (d.schematic ?? {}) as SheetLayout; d.schematic = { ...layout, positions: { ...layout.positions, [symbol.id]: { x: symbol.x, y: symbol.y, [axis]: Math.max(30, value) } } }; });
    }
    catch (e) {
        notify(String(e));
    } }
    return <div className="bb-schematic" onKeyDown={e => { if (e.key === 'Escape') {
        setDraft(null);
        notify('Schematic wire cancelled.');
    } }}><div className="bb-sheet-tools"><strong>Schematic</strong><button onClick={() => setZoom(z => Math.max(.35, z - .15))} aria-label="Zoom schematic out">−</button><button onClick={() => setZoom(z => Math.min(2, z + .15))} aria-label="Zoom schematic in">+</button><button onClick={fit}>Fit sheet</button><button onClick={() => setZoom(1)}>100%</button><button onClick={() => setPdf(true)}>Export PDF</button><button disabled={!draft} onClick={() => setDraft(null)}>Cancel wire</button><span>{draft ? 'Click bends, then a destination' : 'Click a pin to start a wire; scroll to pan'}</span></div><div ref={scroll} className="bb-sheet-scroll" tabIndex={0} aria-label="Schematic canvas, scroll to pan"><svg width={scene.width * zoom} height={scene.height * zoom} viewBox={`0 0 ${scene.width} ${scene.height}`} aria-label="Editable circuit schematic" onClick={e => { if (!draft)
        return; const r = e.currentTarget.getBoundingClientRect(); setDraft({ ...draft, bends: [...(draft.bends ?? []), { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }] }); }}>
 {scene.drawing.map((d, i) => d.kind === 'line' ? <polyline key={i} points={d.points.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={d.dash ? '5 3' : undefined}/> : d.kind === 'circle' ? <circle key={i} cx={d.x} cy={d.y} r={d.r}/> : <text key={i} x={d.x} y={d.y} fontSize={d.size ?? 12}>{d.text}</text>)}
 {scene.drawing.map((d,i)=>d.kind==='line'&&d.wireId?<polyline key={'hit'+i} points={d.points.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="transparent" strokeWidth="14" tabIndex={0} role="button" aria-label={'Select wire '+d.wireId} onClick={e=>{e.stopPropagation();onSelect({type:'wire',id:d.wireId!});}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onSelect({type:'wire',id:d.wireId!});}}}/>:null)}
 {scene.symbols.map(s=><rect key={'part'+s.id} x={s.x} y={s.y} width={s.width} height={s.height} fill="transparent" role="button" tabIndex={0} aria-label={'Select '+s.id} onClick={e=>{e.stopPropagation();setSelected(s.id);onSelect({type:'part',id:s.id});}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setSelected(s.id);onSelect({type:'part',id:s.id});}}}/>)}
 {scene.symbols.flatMap(s => s.pins.map(p => <circle key={s.id + ':' + p.ref.pinName} role="button" tabIndex={0} aria-label={'Connect ' + s.id + ':' + p.ref.pinName + ' net ' + p.net} className="bb-pin-target" cx={p.point.x} cy={p.point.y} r="12" onClick={e => { e.stopPropagation(); pin(JSON.stringify([s.id, p.ref.pinName])); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        pin(JSON.stringify([s.id, p.ref.pinName]));
    } }}><title>{s.id}:{p.ref.pinName} · {p.net}</title></circle>))}
 {draft?.bends?.map((p, i) => <circle key={'draft' + i} cx={p.x} cy={p.y} r="5" fill="#137349"/>)}
 </svg></div><details className="bb-sheet-tools"><summary>Layout and mapping · {scene.warnings.length} warnings</summary><label>Move symbol<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose component</option>{scene.symbols.map(s => <option key={s.id}>{s.id}</option>)}</select></label>{symbol && (['x', 'y'] as const).map(axis => <label key={axis}>{axis}<input type="number" value={symbol[axis]} onChange={e => move(axis, Number(e.target.value))}/></label>)}<p>Equal N labels represent the same net. Crossings without dots do not connect. Generic blocks preserve pin identity for components without a dedicated symbol.</p>{scene.warnings.map(w => <p key={w}>{w}</p>)}</details>
 {pdf && <Dialog title="Export schematic PDF" close={() => setPdf(false)}><label>Paper<select value={options.paper} onChange={e => setOptions({ ...options, paper: e.target.value as 'A4' | 'Letter' })}><option>A4</option><option>Letter</option></select></label><label><input type="checkbox" checked={options.landscape} onChange={e => setOptions({ ...options, landscape: e.target.checked })}/> Landscape</label><label><input type="checkbox" checked={options.partsList} onChange={e => setOptions({ ...options, partsList: e.target.checked })}/> Include parts list</label><p>Vector drawing, component values and revision. Large sheets tile across pages. {scene.warnings.length} mapping warnings.</p><button onClick={() => { controller.flush(); const bytes = schematicPdf(scene, doc.name ?? 'BreadBit', controller.project.revision, options); downloadBlob(new Uint8Array(bytes).buffer, 'schematic.pdf', 'application/pdf'); notify('PDF export requested.'); setPdf(false); }}>Download PDF</button></Dialog>}</div>;
}
