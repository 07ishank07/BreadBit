# Integration handoff for the application agent

## Package ownership

This package is isolated from the application frame under `packages/circuit-renderer`. Import the package into the existing rendering panel; do not replace application routing or project state. `preview/` is a disposable laboratory and does not belong in the product shell.

Target versions: React 19, React Three Fiber 9 and Three.js 0.180 through 0.186. The verified development installation is recorded in `package-lock.json`. Keep one React instance. No renderer CSS import is required; the library is self contained. Give the parent a defined height.

The distributable is created with:

```sh
npm ci
npm run build
npm pack
```

Install that tarball in the host. Ensure `react`, `react-dom`, `three` and `@react-three/fiber` satisfy the peer ranges. The package is ESM and intended for a browser or desktop WebView with WebGL2. Mount it only on the client if the host renders on a server.

## Data contract

| Item | Contract |
| --- | --- |
| Coordinates | Millimetres; X right, Y up, Z towards the viewer |
| Component origin | Centre of footprint at its bottom surface |
| Rotation | Radians around Y; right hand convention |
| Identity | Persistent component IDs and pin IDs; never derived from array index |
| Connections | Endpoint references `{partId, pinId}`; rendered geometry resolves from current poses |
| Wire path | Optional intermediate world coordinates; pin endpoints always follow components |
| Snapshot | Read only display state; host owns simulation time and physics |
| Pins snapshot | Key with `pinKey({partId, pinId})`; optional voltage is in volts |
| Input value | Potentiometer value is normalized to 0 through 1; host converts to its simulation units |
| Servo angle | Degrees for display; host maps PWM or other actuator state |
| Brightness | Normalized 0 through 1; visual indication, not an electrical current calculation |

Treat inputs as immutable snapshots. Memoize custom registry and geometry objects in a high frequency host. Avoid pushing CPU instructions or individual emulated clock edges into React; aggregate visual state at the display rate.

## Controlled state

```tsx
import { CircuitViewport } from '@circuit-workbench/renderer';
import type { CircuitDocument, Selection, SimulationSnapshot } from '@circuit-workbench/renderer';

// These actions belong to the application's existing store and undo system.
<CircuitViewport
  circuit={scene as CircuitDocument}
  snapshot={visuals as SimulationSnapshot}
  selection={selection as Selection}
  mode={tool}
  onSelect={setSelection}
  onPartMove={(id, position) => commitLayoutChange(id, { position })}
  onPartRotate={(id, rotation) => commitLayoutChange(id, { rotation })}
  onWireCreate={(from, to) => validateThenCommitWire(from, to)}
  onInputChange={({ partId, property, value }) => setSimulatorInput(partId, property, value)}
/>
```

Callbacks propose changes. `onWireCreate` does not insert a wire locally; the host validates, commits it and returns the updated circuit. Movement previews locally while dragging, then emits a single commit. If the host rejects a move the component returns to the controlled position. No undo stack is duplicated inside the renderer.

The host should expose accessible equivalents for component selection, wiring and input adjustment. The preview's explorer demonstrates accessible selection; the 3D canvas alone is not a complete screen reader interface.

## Velxio boundary

```ts
import { adaptVelxioScene } from '@circuit-workbench/renderer';

const { circuit, warnings } = adaptVelxioScene({
  boards: simulatorState.boards,
  components: simulatorState.components,
  wires: simulatorState.wires,
}, {
  mmPerPixel: 0.2,
  poses: project.rendering3d.poses,
  kindMap: { 'my-custom-part': 'my-model-kind' },
  mapPin: pin => hostPinAliases(pin),
});
```

The default layout conversion is only a first placement estimate. Persist authoritative 3D poses separately, keyed by the same component IDs. Existing 2D layout values remain the application's responsibility. `mapPin` is the explicit boundary for differences between Wokwi/Velxio pin names and the chosen 3D model catalogue. Review `warnings`; do not silently invent mappings. Unknown components render a placeholder and unresolved wire endpoints are omitted.

Breadboard contacts in this catalogue use `a1` through `j30`, plus `tp1..25`, `tn1..25`, `bp1..25`, `bn1..25`. These names are the renderer contract, not an assertion of native Wokwi pin naming. Map them deliberately. Velxio seating connections marked `bb: true` are excluded from visible jumper cables but must remain in the host's electrical topology.

The adapter supplies scene data only. Velxio's existing DOM based part simulation needs a host side adapter or refactor before it can drive these models. Do not claim that passing a Velxio scene automatically ports every component's emulation.

## Extending the catalogue

```tsx
import type { ComponentDefinition, ComponentModelProps } from '@circuit-workbench/renderer';

function SensorModel({ state }: ComponentModelProps) {
  return <mesh position={[0, 2, 0]}>
    <boxGeometry args={[20, 4, 16]} />
    <meshStandardMaterial color={state.fault ? '#c65d5d' : '#286c74'} />
  </mesh>;
}

const sensor: ComponentDefinition = {
  kind: 'sensor', label: 'Custom sensor', size: [20, 4, 16],
  pins: [{ id: 'GND', position: [-2.54, 1, 8], role: 'ground' },
         { id: 'VCC', position: [0, 1, 8], role: 'power' },
         { id: 'SIG', position: [2.54, 1, 8], role: 'signal' }],
  Model: SensorModel,
};
const registry = { sensor }; // Keep this object stable across renders.
```

Custom models render inside an already positioned and rotated group. Keep their geometry in local millimetres. They may use procedural geometry or locally bundled GLB files. If loading a GLB, own its licensing, asset URL, loading boundary, scale and cleanup in that custom model. No GLB runtime download is required by the builtins.

## Native application considerations

The viewport uses WebGL2 through the WebView; verify GPU acceleration in the chosen desktop shell. All default resources are local, including canvas generated text and room lighting. The library does not open sockets or execute native commands. The host owns local backend startup, credentials, filesystem access and simulation services.

`capture(2)` returns a PNG data URL for the scene at twice the CSS pixel dimensions. It renders synchronously and restores the original pixel ratio afterwards. Route the result to a native save dialog in the host. Overlaid DOM labels and toolbars are not part of the scene export.

## Integration acceptance checklist

1. Mount the component in the real application panel and confirm it resizes correctly.
2. Connect one supported board, LED and button using explicitly mapped pin IDs.
3. Feed actual simulator output into the LED snapshot and confirm both views agree.
4. Forward press and release events to the simulator and check release on focus loss.
5. Persist a move and rotation, reopen the project and verify wire endpoints follow the restored poses.
6. Let the host validate a proposed wire, then exercise undo and redo.
7. Test the target desktop WebView, GPU drivers and high DPI display.

This package was not combined with the separate application's frame in this workspace. Its tests cover the rendering boundary and adapter, not the host emulator or desktop packaging.
