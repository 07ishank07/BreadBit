import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinComponents, circuitBounds, resolvePin, snapPosition, validateCircuit, wireCurve, workbenchFixture, worldPosition, adaptVelxioScene } from '../src';

test('fixture wire ends resolve, and every catalogue pin has a stable unique ID',()=>{
  assert.deepEqual(validateCircuit(workbenchFixture,builtinComponents),[]);
  for(const definition of Object.values(builtinComponents)) {
    assert.equal(new Set(definition.pins.map(p=>p.id)).size,definition.pins.length,definition.kind);
    for(const p of definition.pins) assert.ok(p.position.every(Number.isFinite));
  }
});
test('rotation and translation produce the same electrical endpoint in world space',()=>{
  const part={id:'r',kind:'resistor',position:[10,5,20] as const,rotation:Math.PI/2};
  const result=worldPosition(part,[7,0.5,0]);
  assert.ok(Math.abs(result[0]-10)<1e-10);
  assert.equal(result[1],5.5);assert.equal(result[2],13);
  assert.deepEqual(resolvePin({parts:[part],wires:[]},builtinComponents,{partId:'r',pinId:'2'}),result);
});
test('drag snap preserves mounting elevation and handles negative coordinates',()=>{
  assert.deepEqual(snapPosition([-3.2,9.4,5.2],2.54),[-2.54,9.4,5.08]);
  assert.deepEqual(snapPosition([1.2,4.3,5.6],0),[1.2,4.3,5.6]);
});
test('curved wires retain exact endpoint positions including custom paths',()=>{
  const a=[1,2,3] as const,b=[12,6,8] as const;
  for(const options of [{lift:7},{waypoints:[[2,10,4],[8,11,6]] as const}]){
    const curve=wireCurve(a,b,options);
    assert.ok(curve.getPoint(0).toArray().every((v,i)=>Math.abs(v-a[i])<1e-10));
    assert.ok(curve.getPoint(1).toArray().every((v,i)=>Math.abs(v-b[i])<1e-10));
    assert.ok(curve.getPoints(30).every(p=>Number.isFinite(p.length())));
  }
});
test('camera bounds include rotated footprints and elevated wires',()=>{
  const scene={parts:[{id:'r',kind:'resistor',position:[0,0,0] as const,rotation:Math.PI/2}],wires:[]};
  const box=circuitBounds(scene,builtinComponents);
  assert.ok(Math.abs(box.max.z-7.5)<1e-9);assert.ok(Math.abs(box.max.x-1.5)<1e-9);
  const full=circuitBounds(workbenchFixture,builtinComponents);assert.ok(full.max.y>=30);
});
test('adapter preserves host IDs, respects authoritative poses and hides seating wires',()=>{
  const result=adaptVelxioScene({boards:[{id:'u',boardKind:'uno',x:0,y:0}],components:[{id:'l',metadataId:'wokwi-led',x:200,y:10}],wires:[
    {id:'wire',start:{componentId:'u',pinName:'13'},end:{componentId:'l',pinName:'A'}},
    {id:'seat',start:{componentId:'u',pinName:'GND.1'},end:{componentId:'l',pinName:'C'},bb:true},
  ]},{poses:{l:{position:[1,2,3],rotation:1.3}}});
  assert.deepEqual(result.warnings,[]);assert.equal(result.circuit.parts[0].kind,'arduino-uno');
  assert.deepEqual(result.circuit.parts[1].position,[1,2,3]);assert.equal(result.circuit.wires.length,1);
});
test('invalid endpoints and unknown components are reported without inventing pin mappings',()=>{
  const result=adaptVelxioScene({components:[{id:'unknown',type:'unavailable-chip',x:0,y:0}],wires:[{id:'w',start:{componentId:'unknown',pinName:'1'},end:{componentId:'missing',pinName:'2'}}]});
  assert.ok(result.warnings.some(w=>w.includes('Unknown')));assert.ok(result.warnings.some(w=>w.includes('Unresolved')));
  assert.throws(()=>adaptVelxioScene({components:[],wires:[]},{mmPerPixel:0}),/positive/);
});
