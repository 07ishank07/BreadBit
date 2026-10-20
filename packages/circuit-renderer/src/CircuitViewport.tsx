import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { RootState, ThreeEvent } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap, Plane, SRGBColorSpace, Vector3 } from 'three';
import { builtinComponents } from './catalogue';
import { graphiteTheme, qualityProfiles } from './theme';
import { pinKey, resolvePin, samePin, snapPosition } from './math';
import { CameraRig, StudioEnvironment } from './scene/CameraRig';
import type { CameraAPI } from './scene/CameraRig';
import { Workbench } from './scene/Workbench';
import { PartModel } from './scene/PartModel';
import { WireModel } from './scene/WireModel';
import type { CircuitPart, CircuitViewportHandle, CircuitViewportProps, PinRef, Vec3 } from './types';

interface Gesture { id: string; pointerId: number; offset: Vector3; plane: Plane; position: Vec3; start: Vec3 }
const emptyState = {};

class RenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError?: (e: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError?.(error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export const CircuitViewport = forwardRef<CircuitViewportHandle, CircuitViewportProps>(function CircuitViewport({
  circuit, snapshot, registry: customRegistry, selection = null, mode = 'inspect', quality = 'balanced', theme: customTheme,
  showGrid = true, showLabels = true, snap = 2.54, className, style, ariaLabel = 'Interactive 3D circuit workspace', fallback,
  onSelect, onPartMove, onPartRotate, onWireCreate, onInputChange, onPinHover, onReady, onError, onStats,
}, ref) {
  const registry = useMemo(() => ({ ...builtinComponents, ...customRegistry }), [customRegistry]);
  const theme = useMemo(() => ({ ...graphiteTheme, ...customTheme }), [customTheme]);
  const [dragPreview, setDragPreview] = useState<{ id: string; position: Vec3 } | null>(null);
  const [wireStart, setWireStart] = useState<PinRef | null>(null);
  const [wireEnd, setWireEnd] = useState<Vec3 | null>(null);
  const [hoverPin, setHoverPin] = useState<PinRef | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const root = useRef<RootState | null>(null), cameraAPI = useRef<CameraAPI | null>(null);
  const gesture = useRef<Gesture | null>(null), pressing = useRef<string | null>(null);
  const inputCallback = useRef(onInputChange); inputCallback.current = onInputChange;
  const liveCircuit = useMemo(() => dragPreview ? { ...circuit, parts: circuit.parts.map(p => p.id === dragPreview.id ? { ...p, position: dragPreview.position } : p) } : circuit, [circuit, dragPreview]);
  const liveRef=useRef(liveCircuit); liveRef.current=liveCircuit;
  const setCameraAPI = useCallback((api: CameraAPI | null) => { cameraAPI.current = api; }, []);
  const release = useCallback(() => {
    if (pressing.current) inputCallback.current?.({ partId: pressing.current, property: 'pressed', value: false });
    pressing.current = null; setPressedId(null);
  }, []);
  const cancel = useCallback(() => {
    gesture.current = null; setDragPreview(null); setWireStart(null); setWireEnd(null); release();
  }, [release]);
  useEffect(() => { cancel(); setHoverPin(null); onPinHover?.(null); }, [mode, cancel]);
  useEffect(() => {
    const pointerup = () => release();
    window.addEventListener('pointerup',pointerup); window.addEventListener('blur',cancel);
    return () => {
      window.removeEventListener('pointerup',pointerup); window.removeEventListener('blur',cancel);
      if (pressing.current) inputCallback.current?.({ partId: pressing.current, property: 'pressed', value: false });
    };
  }, [release,cancel]);
  useEffect(() => {
    if(wireStart && !resolvePin(circuit,registry,wireStart)) {setWireStart(null);setWireEnd(null);}
    if(gesture.current && !circuit.parts.some(p=>p.id===gesture.current!.id)) cancel();
  },[circuit,registry,wireStart,cancel]);
  useImperativeHandle(ref, () => ({
    fit: () => cameraAPI.current?.fit(),
    setView: view => cameraAPI.current?.setView(view),
    cancelInteraction: cancel,
    projectPin: pin => {
      const r=root.current, point=resolvePin(liveRef.current,registry,pin);
      if(!r || !point)return;
      const ndc=new Vector3(...point).project(r.camera);
      return {x:(ndc.x+1)*r.size.width/2,y:(1-ndc.y)*r.size.height/2};
    },
    capture: (pixelRatio = 2) => {
      const r=root.current; if(!r)return;
      const previous=r.gl.getPixelRatio();
      try {
        r.gl.setPixelRatio(Math.max(1,Math.min(3,pixelRatio)));
        r.gl.render(r.scene,r.camera);
        return r.gl.domElement.toDataURL('image/png');
      } finally {r.gl.setPixelRatio(previous);r.invalidate();}
    },
  }), [cancel,registry]);
  const onDown = (e:ThreeEvent<PointerEvent>,part:CircuitPart) => {
    if(e.button!==0)return;
    e.stopPropagation(); onSelect?.({type:'part',id:part.id});
    if(mode==='move' && !part.locked) {
      const plane=new Plane(new Vector3(0,1,0),-part.position[1]);
      const hit=e.ray.intersectPlane(plane,new Vector3()); if(!hit)return;
      gesture.current={id:part.id,pointerId:e.pointerId,plane,offset:hit.sub(new Vector3(...part.position)),position:part.position,start:part.position};
      setDragPreview({id:part.id,position:part.position});
      (e.target as unknown as Element).setPointerCapture(e.pointerId);
    }
    if(mode==='interact') {
      const input=registry[part.kind]?.input;
      if(input==='momentary') {
        pressing.current=part.id;setPressedId(part.id);
        onInputChange?.({partId:part.id,property:'pressed',value:true});
        (e.target as unknown as Element).setPointerCapture(e.pointerId);
      }
      if(input==='analogue') {
        const value=snapshot?.parts?.[part.id]?.value ?? 0;
        onInputChange?.({partId:part.id,property:'value',value:value>=0.99?0:Math.min(1,value+0.1)});
      }
    }
  };
  const onMove = (e:ThreeEvent<PointerEvent>) => {
    const g=gesture.current; if(!g || e.pointerId!==g.pointerId)return;
    e.stopPropagation();
    const hit=e.ray.intersectPlane(g.plane,new Vector3()); if(!hit)return;
    hit.sub(g.offset);
    g.position=snapPosition([hit.x,g.start[1],hit.z],snap);
    setDragPreview({id:g.id,position:g.position});
  };
  const onUp = (e:ThreeEvent<PointerEvent>) => {
    const g=gesture.current;
    if(g && e.pointerId===g.pointerId) {
      e.stopPropagation();gesture.current=null;setDragPreview(null);
      if(g.start.some((v,i)=>v!==g.position[i]))onPartMove?.(g.id,g.position);
      (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    }
    release();
  };
  const onPin = (pin:PinRef) => {
    if(!wireStart) {setWireStart(pin);setWireEnd(resolvePin(liveCircuit,registry,pin) ?? null);}
    else if(!samePin(wireStart,pin)) {onWireCreate?.(wireStart,pin);setWireStart(null);setWireEnd(null);}
  };
  const onHover = (pin:PinRef|null) => {
    setHoverPin(pin);onPinHover?.(pin);
    if(wireStart && pin)setWireEnd(resolvePin(liveCircuit,registry,pin) ?? null);
  };
  const wireFrom=wireStart?resolvePin(liveCircuit,registry,wireStart):undefined;
  const defaultFallback=<div role="alert" style={{padding:24,color:theme.foreground}}>The 3D viewport could not start. Enable WebGL and hardware acceleration, then reload.</div>;
  return <div className={className} role="region" aria-label={ariaLabel} tabIndex={0}
    style={{position:'relative',width:'100%',height:'100%',minHeight:240,background:theme.background,overflow:'hidden',...style}}
    onKeyDown={e=>{
      if(e.key==='Escape'){cancel();onSelect?.(null);}
      if(e.key.toLowerCase()==='f'){e.preventDefault();cameraAPI.current?.fit();}
      if(e.key==='1')cameraAPI.current?.setView('isometric');
      if(e.key==='2')cameraAPI.current?.setView('top');
      if(e.key==='3')cameraAPI.current?.setView('front');
      const part=selection?.type==='part'?circuit.parts.find(p=>p.id===selection.id):undefined;
      if(mode==='move' && part && !part.locked) {
        if(e.key.toLowerCase()==='r')onPartRotate?.(part.id,(part.rotation ?? 0)+Math.PI/2);
        const deltas:Record<string,Vec3>={ArrowLeft:[-1,0,0],ArrowRight:[1,0,0],ArrowUp:[0,0,-1],ArrowDown:[0,0,1]};
        const d=deltas[e.key];if(d){e.preventDefault();const step=(snap>0?snap:1)*(e.shiftKey?10:1);onPartMove?.(part.id,[part.position[0]+d[0]*step,part.position[1],part.position[2]+d[2]*step]);}
      }
    }}>
    <RenderBoundary fallback={fallback ?? defaultFallback} onError={onError}>
      <Canvas orthographic camera={{position:[140,220,190],near:0.1,far:3000,zoom:3}} frameloop="demand"
        dpr={qualityProfiles[quality].dpr} shadows={{type:PCFSoftShadowMap}}
        gl={{antialias:true,alpha:false,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,outputColorSpace:SRGBColorSpace}}
        fallback={fallback ?? defaultFallback}
        onCreated={r=>{root.current=r;r.gl.toneMappingExposure=1;}}
        onPointerMissed={()=>{if(!gesture.current && !wireStart)onSelect?.(null);}}>
        <CameraRig circuit={liveCircuit} registry={registry} onAPI={setCameraAPI} disabled={!!dragPreview || !!pressedId} mode={mode}/>
        <StudioEnvironment/>
        <Lifecycle onReady={onReady} onStats={onStats} onError={onError}/>
        <Workbench theme={theme} grid={showGrid} quality={quality} onPointerMove={e=>{
          if(wireStart && wireFrom)setWireEnd([e.point.x,wireFrom[1],e.point.z]);
        }}/>
        {liveCircuit.parts.map(part=><PartModel key={part.id} part={part} definition={registry[part.kind]}
          state={pressedId===part.id?{...snapshot?.parts?.[part.id],pressed:true}:snapshot?.parts?.[part.id] ?? emptyState}
          selected={selection?.type==='part' && selection.id===part.id} labels={showLabels} wireMode={mode==='wire'} theme={theme}
          onPin={onPin} onPinHover={onHover} onDown={onDown} onMove={onMove} onUp={onUp} onCancel={cancel}/>) }
        {liveCircuit.wires.map(wire=>{
          const from=resolvePin(liveCircuit,registry,wire.from),to=resolvePin(liveCircuit,registry,wire.to);
          return from && to?<WireModel key={wire.id} wire={wire} from={from} to={to} accent={theme.accent} segments={qualityProfiles[quality].segments}
            selected={selection?.type==='wire' && selection.id===wire.id} active={snapshot?.activeWireIds?.includes(wire.id)}
            onSelect={e=>{e.stopPropagation();onSelect?.({type:'wire',id:wire.id});}}/>:null;
        })}
        {wireStart && wireFrom && wireEnd && <WireModel wire={{id:'draft',from:wireStart,to:wireStart,color:theme.accent}} from={wireFrom} to={wireEnd} segments={40} accent={theme.accent} preview/>}
      </Canvas>
    </RenderBoundary>
    {mode==='wire' && <div aria-live="polite" style={{position:'absolute',bottom:18,left:18,padding:'8px 12px',borderRadius:8,background:'#17252bed',color:'#edf7f1',font:'12px system-ui',pointerEvents:'none'}}>
      {wireStart ? `From ${wireStart.partId} / ${wireStart.pinId} · choose destination · Esc cancels` : 'Choose a component pin to begin wiring'}
      {hoverPin && <span> · {hoverPin.partId} / {hoverPin.pinId}{snapshot?.pins?.[pinKey(hoverPin)]?.voltage !== undefined ? ` · ${snapshot.pins[pinKey(hoverPin)].voltage!.toFixed(2)} V` : ''}</span>}
    </div>}
  </div>;
});

function Lifecycle({onReady,onStats,onError}:Pick<CircuitViewportProps,'onReady'|'onStats'|'onError'>) {
  const {gl,invalidate}=useThree();
  const ready=useRef(false);
  useEffect(()=>{
    const lost=(e:Event)=>{e.preventDefault();onError?.(new Error('WebGL context lost. Reload the viewport to recover.'));};
    const restored=()=>invalidate();
    gl.domElement.addEventListener('webglcontextlost',lost);gl.domElement.addEventListener('webglcontextrestored',restored);
    return()=>{gl.domElement.removeEventListener('webglcontextlost',lost);gl.domElement.removeEventListener('webglcontextrestored',restored);};
  },[gl,onError,invalidate]);
  useFrame(()=>{
    if(!ready.current){ready.current=true;onReady?.();}
    onStats?.({drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,pixelRatio:gl.getPixelRatio()});
  });
  return null;
}
