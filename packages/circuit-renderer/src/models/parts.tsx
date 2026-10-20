import { Cylinder, Instances, Solid, SurfaceText } from './primitives';
import type { ComponentModelProps } from '../types';

export function Led({ part, state }: ComponentModelProps) {
  const color = String(part.properties?.color ?? '#ff5e45');
  const brightness = Math.max(0, Math.min(1, state.brightness ?? 0));
  return <group>
    <Instances positions={[[-1.27,2,0],[1.27,2,0]]} size={[0.5,4,0.5]} color="#b5bfc2" metal={0.8}/>
    <Cylinder at={[0,4.3,0]} radius={2.9} height={0.8} color={color}/>
    <mesh position={[0,6.25,0]} castShadow><cylinderGeometry args={[2.5,2.5,3.2,40]}/><meshPhysicalMaterial color={state.fault ? '#483c38' : color} roughness={0.17} clearcoat={1} emissive={color} emissiveIntensity={brightness*2.3}/></mesh>
    <mesh position={[0,7.85,0]} castShadow><sphereGeometry args={[2.5,40,20,0,Math.PI*2,0,Math.PI/2]}/><meshPhysicalMaterial color={state.fault ? '#483c38' : color} roughness={0.17} clearcoat={1} emissive={color} emissiveIntensity={brightness*2.3}/></mesh>
    {brightness>0.1 && <pointLight position={[0,8,0]} color={color} intensity={brightness*28} distance={18} decay={2}/>}
  </group>;
}
export function Resistor({ part }: ComponentModelProps) {
  const bands = Array.isArray(part.properties?.bands) ? part.properties.bands as string[] : ['#bb4144','#bb4144','#6b3930','#bba359'];
  return <group>
    <Cylinder at={[0,3,0]} radius={1.25} height={6.5} color="#d8c5a1" rotation={[0,0,Math.PI/2]}/>
    {bands.slice(0,5).map((c,i)=><Cylinder key={i} at={[-2.2+i*1.45,3,0]} radius={1.28} height={0.55} color={c} rotation={[0,0,Math.PI/2]}/>)}
    <Cylinder at={[0,3,0]} radius={0.25} height={14} color="#c1c9cc" metal={0.9} rotation={[0,0,Math.PI/2]}/>
    {[-7,7].map(x=><Cylinder key={x} at={[x,1.5,0]} radius={0.25} height={3} color="#c1c9cc" metal={0.9}/>)}
  </group>;
}
export function Pushbutton({ state }: ComponentModelProps) {
  return <group>
    <Solid size={[6,3.5,6]} at={[0,2.5,0]} color="#253035"/>
    <Solid size={[5.8,0.45,5.8]} at={[0,4.4,0]} color="#b7c3c8" metal={0.8}/>
    <Cylinder at={[0,state.pressed ? 4.8 : 5.5,0]} radius={1.75} height={1.5} color="#233034"/>
    <Instances positions={[[-3.8,0.8,-2.25],[-3.8,0.8,2.25],[3.8,0.8,-2.25],[3.8,0.8,2.25]]} size={[1.8,1.2,0.6]} color="#a6b5bd" metal={0.8}/>
  </group>;
}
export function Potentiometer({ state }: ComponentModelProps) {
  const value = Math.min(1, Math.max(0, state.value ?? 0.5));
  return <group>
    <Solid size={[11,3,11]} at={[0,2,0]} color="#3a74a5"/>
    <Cylinder at={[0,5,0]} radius={5.3} height={3.4} color="#aab4b7" metal={0.8}/>
    <Cylinder at={[0,8,0]} radius={4} height={5.5} color="#222d33"/>
    <group position={[0,10.8,0]} rotation={[0,-2.3+value*4.6,0]}><Solid size={[0.55,0.15,2.7]} at={[0,0,-1.1]} color="#dfe9e5" radius={0}/></group>
    <Instances positions={[[-2.54,0.5,7],[0,0.5,7],[2.54,0.5,7]]} size={[0.7,1,3]} color="#b7c4c8" metal={0.8}/>
  </group>;
}
export function Servo({ state }: ComponentModelProps) {
  return <group>
    <Solid size={[23,22,12]} at={[0,11,0]} color="#2877ac" radius={1}/>
    <Solid size={[32,2,12]} at={[0,17,0]} color="#316d93"/>
    <Solid size={[23,3,12]} at={[0,23,0]} color="#2c5774"/>
    <Cylinder at={[-5,25,0]} radius={4.2} height={3} color="#c8d2d2"/>
    <group position={[-5,27,0]} rotation={[0,(state.angle ?? 90)*Math.PI/180,0]}>
      <Solid size={[24,1.8,3.4]} color="#e7ebe7" radius={1.5}/>
      <Cylinder at={[0,1.2,0]} radius={1.4} height={0.5} color="#8d9eaa" metal={0.9}/>
      <Instances positions={[-9,-6,6,9].map(x=>[x,0.93,0])} size={[0.9,0.1,0.9]} color="#657a83"/>
    </group>
    <SurfaceText text="MICRO SERVO" at={[0,12,-6.06]} width={18} height={4} rotation={[0,Math.PI,0]}/>
  </group>;
}
export function Oled({ state }: ComponentModelProps) {
  const lines=state.displayLines ?? ['READY', '128 × 64'];
  return <group>
    <Solid size={[27,1.5,28]} at={[0,1,0]} color="#153e54" radius={1}/>
    <Solid size={[24,1.5,18]} at={[0,2.5,-1]} color="#101c24" radius={0.4}/>
    <Solid size={[22,0.2,14]} at={[0,3.31,-1]} color="#081218" radius={0.2} rough={0.16}/>
    {lines.slice(0,3).map((t,i)=><SurfaceText key={i} text={t} at={[0,3.44,-4+i*4]} width={19} height={3} color="#83dafa"/>) }
    <Instances positions={[-3.81,-1.27,1.27,3.81].map(x=>[x,2,12])} size={[0.6,4,0.6]} color="#d7bc77" metal={0.8}/>
    <SurfaceText text="GND VCC SCL SDA" at={[0,1.79,8.7]} width={22} height={1.8}/>
  </group>;
}
export function UnknownModel({ part }: ComponentModelProps) {
  return <group><Solid size={[12,8,12]} at={[0,4,0]} color="#695f65"/>
    <SurfaceText text={part.kind} at={[0,8.1,0]} width={10} height={2} color="#ffffff"/>
  </group>;
}
