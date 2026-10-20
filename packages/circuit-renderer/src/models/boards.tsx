import { Cylinder, Instances, Solid, SurfaceText } from './primitives';
import type { ComponentModelProps, PinDefinition, Vec3 } from '../types';

export const unoPins: PinDefinition[] = [
  ...Array.from({ length: 14 }, (_, n) => ({ id: `${n}`, label: `D${n}`, position: [-16.5 + n * 2.54, 9, -22] as Vec3, role: 'signal' as const })),
  ...['IOREF', 'RESET', '3.3V', '5V', 'GND.1', 'GND.2', 'VIN'].map((id, n) => ({ id, position: [-19 + n * 2.54, 9, 22] as Vec3, role: id.startsWith('GND') ? 'ground' as const : 'power' as const })),
  ...Array.from({ length: 6 }, (_, n) => ({ id: `A${n}`, position: [8 + n * 2.54, 9, 22] as Vec3, role: 'signal' as const })),
];
export function ArduinoUno({ state }: ComponentModelProps) {
  return <group>
    <Solid size={[68.6, 1.6, 53.4]} at={[0, 1.5, 0]} color="#08706c" radius={2}/>
    <Solid size={[24, 3, 8]} at={[11, 4.2, 2]} color="#1d2427"/>
    <Instances positions={Array.from({ length: 14 }, (_, i) => [[-0.7 + i * 1.78, 3, -2.9], [-0.7 + i * 1.78, 3, 6.9]] as Vec3[]).flat()} size={[0.6, 1.8, 1.4]} color="#b3bec3" metal={0.85}/>
    <SurfaceText text="ATMEGA328P" at={[11, 5.75, 2]} width={19} height={2} color="#bbc5ca"/>
    <Solid size={[15, 11, 12]} at={[-29, 7.5, -12]} color="#b9c4c8" metal={0.85} rough={0.24}/>
    <Solid size={[10, 0.08, 7]} at={[-29, 13.04, -12]} color="#8b9da6" metal={0.65} rough={0.3} radius={0.1}/>
    <Solid size={[0.2, 7.8, 8.8]} at={[-36.6, 7.5, -12]} color="#303b41" radius={0.1}/>
    <Solid size={[13, 10, 9]} at={[-28, 7, 15]} color="#1c2327" radius={0.7}/>
    <Cylinder at={[-35, 7, 15]} radius={3.5} height={0.4} color="#94a3a8" metal={0.8} rotation={[0, 0, Math.PI / 2]}/>
    <Cylinder at={[-35.3, 7, 15]} radius={2.6} height={0.5} color="#0d1418" rotation={[0, 0, Math.PI / 2]}/>
    <Solid size={[36, 6.4, 3.8]} at={[0, 5.4, -22]} color="#202a2b"/>
    <Solid size={[19, 6.4, 3.8]} at={[-11.5, 5.4, 22]} color="#202a2b"/>
    <Solid size={[16, 6.4, 3.8]} at={[14.4, 5.4, 22]} color="#202a2b"/>
    <Instances positions={unoPins.map(p => [p.position[0], 8.67, p.position[2]])} size={[1.35, 0.14, 1.35]} color="#080e11"/>
    <Instances positions={unoPins.map(p => [p.position[0], 8.69, p.position[2]-0.42])} size={[0.7, 0.08, 0.18]} color="#a69267" metal={0.7}/>
    <Instances positions={[[-27, 2.34, -23], [28, 2.34, -23], [28, 2.34, 23], [-27, 2.34, 23]]} size={[3.2, 0.14, 3.2]} color="#d4b56d" metal={0.8}/>
    <Instances positions={[[-27, 2.44, -23], [28, 2.44, -23], [28, 2.44, 23], [-27, 2.44, 23]]} size={[1.7, 0.15, 1.7]} color="#1b272a"/>
    <SurfaceText text="UNO" at={[-10, 2.34, -5]} width={15} height={7}/>
    <SurfaceText text="DIGITAL  /  PWM" at={[0, 2.35, -17]} width={27} height={2}/>
    <SurfaceText text="POWER" at={[-10, 2.35, 16.6]} width={12} height={2}/>
    <SurfaceText text="ANALOG IN" at={[15, 2.35, 16.6]} width={15} height={2}/>
    <SurfaceText text="0  1  2  3  4  5  6  7  8  9  10 11 12 13" at={[0, 8.74, -22]} width={35} height={1.6}/>
    <SurfaceText text="OPEN HARDWARE" at={[4, 2.35, 11]} width={23} height={2}/>
    <Solid size={[6, 1.5, 3]} at={[-18, 3.2, -10]} color="#b6c5cb" metal={0.8}/>
    <Solid size={[5, 2.8, 5]} at={[-18, 4.3, 8]} color="#a6b7bd" metal={0.7}/>
    <Solid size={[2.7, 2, 2.7]} at={[-18, 6.4, 8]} color="#262e32"/>
    {[[-11, 9], [-6, 9], [21, -9]].map(([x,z], i) => <group key={i} position={[x, 3, z]}>
      <mesh><boxGeometry args={[1.6, 1, 1]}/><meshStandardMaterial color={i === 2 ? '#83ecac' : '#efcd6b'} emissive={i === 2 ? '#54df8e' : '#b68f39'} emissiveIntensity={i === 2 ? 0.8 : (state.brightness ?? 0)}/></mesh>
    </group>)}
    <Cylinder at={[-19, 5.5, 15]} radius={2.5} height={6} color="#697c84" metal={0.6}/>
  </group>;
}

const rows = ['a','b','c','d','e','f','g','h','i','j'];
export const breadboardPins: PinDefinition[] = [
  ...rows.flatMap((row, r) => Array.from({ length: 30 }, (_, c) => ({
    id: `${row}${c+1}`, position: [(c-14.5)*2.54, 9.1, r < 5 ? -13.97+r*2.54 : 3.81+(r-5)*2.54] as Vec3,
  }))),
  ...['tp','tn','bp','bn'].flatMap((rail, r) => Array.from({ length: 25 }, (_, c) => ({
    id: `${rail}${c+1}`, position: [(c+Math.floor(c/5)-14)*2.54, 9.1, [-24,-21,21,24][r]] as Vec3,
    role: rail.endsWith('p') ? 'power' as const : 'ground' as const,
  }))),
];
export function Breadboard() {
  return <group>
    <Solid size={[83, 8.8, 55]} at={[0,4.4,0]} color="#d9ddda" radius={1.2}/>
    <Solid size={[79,0.3,2.1]} at={[0,8.8,0]} color="#aebbb7" radius={0.15}/>
    <Instances positions={breadboardPins.map(p=>[p.position[0],8.88,p.position[2]])} size={[1.9,0.1,1.9]} color="#b7bfbb"/>
    <Instances positions={breadboardPins.map(p=>[p.position[0],8.96,p.position[2]])} size={[1.05,0.1,1.05]} color="#384548"/>
    {[-25.9,19.2].map(z=><Solid key={z} at={[0,9,z]} size={[77,0.06,0.23]} color="#ce6561" radius={0}/>) }
    {[-19.2,25.9].map(z=><Solid key={z} at={[0,9,z]} size={[77,0.06,0.23]} color="#5e94b1" radius={0}/>) }
    {[1,5,10,15,20,25,30].map(n=><SurfaceText key={n} text={String(n)} at={[(n-15.5)*2.54,9.03,-17]} width={3} height={1.7} color="#6d7977"/>) }
    <SurfaceText text="a b c d e" at={[-40,9.02,-9]} width={12} height={1.4} color="#6d7977" rotation={[-Math.PI/2,0,Math.PI/2]}/>
    <SurfaceText text="f g h i j" at={[-40,9.02,9]} width={12} height={1.4} color="#6d7977" rotation={[-Math.PI/2,0,Math.PI/2]}/>
  </group>;
}
