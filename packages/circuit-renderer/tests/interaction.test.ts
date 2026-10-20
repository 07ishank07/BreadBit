import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Vector3 } from 'three';
import { builtinComponents, workbenchFixture, pickCandidates, projectPoint, resolvePin, translateSegment,
  validateRendererEdit, isNoopEdit, exceedsThreshold, defaultNavigation, navigationPreferences, wheelIntent, wheelPixels, validCameraState } from '../src';
import type { CircuitDocument, RendererEdit, Vec3 } from '../src';
import { cameraSnapshot, panOffset } from '../src/navigation';

test('two finger scrolling defaults to pan; modifiers zoom and delta units normalize', () => {
  assert.equal(defaultNavigation.initialView, 'top');
  const event = { deltaX: 4, deltaY: 10, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false };
  assert.deepEqual(wheelIntent(event, defaultNavigation, 600), { type: 'pan', x: 4, y: 10 });
  assert.equal(wheelIntent({ ...event, ctrlKey: true }, defaultNavigation, 600).type, 'zoom');
  assert.equal(wheelIntent(event, { ...defaultNavigation, twoFingerAction: 'zoom' }, 600).type, 'zoom');
  assert.deepEqual(wheelPixels(1, 2, 1, 600), { x: 16, y: 32 });
  assert.deepEqual(wheelPixels(1, 2, 2, 600), { x: 600, y: 1200 });
  assert.deepEqual(wheelIntent({ ...event, deltaX: 0, shiftKey: true }, defaultNavigation, 600), { type: 'pan', x: 10, y: 0 });
  assert.deepEqual(wheelIntent(event, { ...defaultNavigation, invertPan: true }, 600), { type: 'pan', x: -4, y: -10 });
  assert.equal(navigationPreferences({ panSensitivity: NaN }).panSensitivity, 1);
});
test('camera snapshots and CSS pixel pan preserve orientation and are independent of viewport size', () => {
  const camera = new OrthographicCamera(-400, 400, 300, -300, 0.1, 3000);
  camera.position.set(0, 400, 0.001); camera.zoom = 4; camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const state = cameraSnapshot(camera, new Vector3());
  assert.equal(validCameraState(state), true);
  assert.equal(validCameraState({ ...state, zoom: NaN }), false);
  assert.equal(validCameraState({ ...state, position: state.target }), false);
  const delta = panOffset(camera, 800, 600, 40, 20);
  assert.ok(Math.abs(delta.x - 10) < 1e-6);
  assert.ok(Math.abs(delta.z - 5) < 1e-6);
  camera.left = -200; camera.right = 200; camera.top = 150; camera.bottom = -150;
  assert.deepEqual(panOffset(camera, 400, 300, 40, 20), delta);
  assert.deepEqual(cameraSnapshot(camera, new Vector3()), state);
});
test('pin picking preserves overlapping IDs rather than choosing the nearest or frontmost anchor', () => {
  const circuit: CircuitDocument = { parts: [
    { id: 'first', kind: 'led', position: [0, 0, 0] }, { id: 'second', kind: 'led', position: [0, 0, 0] },
  ], wires: [] };
  const camera = new OrthographicCamera(-100, 100, 75, -75, 0.1, 1000);
  camera.position.set(0, 200, 0.001); camera.lookAt(0, 0, 0); camera.zoom = 6; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const position = resolvePin(circuit, builtinComponents, { partId: 'first', pinId: 'A' })!;
  const point = projectPoint(position, camera, 800, 600)!;
  const hits = pickCandidates(circuit, builtinComponents, camera, { width: 800, height: 600 }, point, { pins: true, wires: false, radius: 12 });
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map(h => h.target.type === 'pin' && h.target.pin.partId).sort(), ['first', 'second']);
});
test('wire hit width stays in CSS pixels at different zoom levels; crossings remain candidates', () => {
  const circuit: CircuitDocument = { parts: [{ id: 'a', kind: 'led', position: [-20, 0, 0] }, { id: 'b', kind: 'led', position: [20, 0, 0] }], wires: [
    { id: 'one', from: { partId: 'a', pinId: 'A' }, to: { partId: 'b', pinId: 'A' } },
    { id: 'two', from: { partId: 'a', pinId: 'A' }, to: { partId: 'b', pinId: 'A' } },
  ] };
  const camera = new OrthographicCamera(-100, 100, 75, -75, 0.1, 1000);
  camera.position.set(0, 200, 0.001); camera.lookAt(0, 0, 0);
  for (const zoom of [1, 4, 8]) {
    camera.zoom = zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const hits = pickCandidates(circuit, builtinComponents, camera, { width: 800, height: 600 }, { x: 400, y: 309 }, { pins: false, wires: true, radius: 12 });
    assert.deepEqual(hits.map(h => h.key).sort(), ['wire:one', 'wire:two']);
    assert.equal(pickCandidates(circuit, builtinComponents, camera, { width: 800, height: 600 }, { x: 400, y: 325 }, { pins: false, wires: true, radius: 12 }).length, 0);
  }
});
test('segment movement preserves endpoints and creates presentation bends only', () => {
  const from: Vec3 = [0, 3, 0], to: Vec3 = [20, 3, 0], delta: Vec3 = [0, 0, 5];
  const bends: readonly Vec3[] = [[5, 8, 0], [15, 8, 0]];
  assert.deepEqual(translateSegment(from, to, bends, 1, delta), [[5, 8, 5], [15, 8, 5]]);
  assert.deepEqual(translateSegment(from, to, bends, 0, delta), [[0, 3, 5], [5, 8, 5], [15, 8, 0]]);
  assert.deepEqual(translateSegment(from, to, bends, 2, delta), [[5, 8, 0], [15, 8, 5], [20, 3, 5]]);
  assert.deepEqual(translateSegment(from, to, bends, 0, [0, 0, 0]), bends);
  assert.deepEqual(from, [0, 3, 0]); assert.deepEqual(to, [20, 3, 0]);
  assert.throws(() => translateSegment(from, to, bends, 4, delta), /Invalid/);
});
test('structural validation rejects missing pins, duplicate connections, locked parts and bad routes without mutating input', () => {
  const frozen = JSON.stringify(workbenchFixture);
  const edits: RendererEdit[] = [
    { type: 'part.move', id: 'bb', position: [0, 0, 0] },
    { type: 'wire.create', from: { partId: 'uno', pinId: 'missing' }, to: { partId: 'led', pinId: 'A' }, waypoints: [] },
    { type: 'wire.create', from: workbenchFixture.wires[0].to, to: workbenchFixture.wires[0].from, waypoints: [] },
    { type: 'wire.reconnect', id: 'signal', end: 'to', pin: workbenchFixture.wires[0].from },
    { type: 'wire.route', id: 'signal', waypoints: [[NaN, 0, 0]] },
    { type: 'wire.route', id: 'signal', waypoints: Array.from({ length: 257 }, () => [0, 0, 0] as Vec3) },
  ];
  for (const edit of edits) assert.ok(validateRendererEdit(edit, workbenchFixture, builtinComponents), edit.type);
  assert.equal(validateRendererEdit({ type: 'wire.reconnect', id: 'signal', end: 'from', pin: { partId: 'uno', pinId: '12' } }, workbenchFixture, builtinComponents), null);
  assert.equal(JSON.stringify(workbenchFixture), frozen);
});
test('no-op edits and subthreshold motion cannot create history entries', () => {
  assert.equal(exceedsThreshold({ x: 10, y: 10 }, { x: 12, y: 12 }), false);
  assert.equal(exceedsThreshold({ x: 10, y: 10 }, { x: 20, y: 10 }), true);
  assert.ok(isNoopEdit({ type: 'part.move', id: 'uno', position: workbenchFixture.parts[0].position }, workbenchFixture));
  assert.ok(isNoopEdit({ type: 'wire.route', id: 'signal', waypoints: [] }, workbenchFixture));
  assert.ok(isNoopEdit({ type: 'wire.reconnect', id: 'signal', end: 'from', pin: workbenchFixture.wires[0].from }, workbenchFixture));
});
