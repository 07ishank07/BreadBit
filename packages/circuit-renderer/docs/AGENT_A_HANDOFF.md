# Agent A renderer handoff

Implemented against `docs/plans/agent-a-graphics.md` and the confirmed usability interview, 20 October 2026. Changes are confined to the renderer source, tests, preview and documentation. The host shell, project model, vendor checkout and dependency manifests are unchanged.

## Integration status

The renderer implementation is available. The full BreadBit acceptance gate is **not passed**: this checkout has no populated Velxio submodule, and the new command contract still needs to be connected by the integration owner. Physical trackpad use, real GPU performance, native WebViews and compiled firmware are unqualified. The component laboratory is supplementary evidence, not a substitute for the actual BreadBit task.

Read [AGENT_A_VERIFICATION.md](AGENT_A_VERIFICATION.md) for executed checks and measured limitations.

## Additive API and host migration

All types are exported from `src/index.ts`. Existing simple `onPartMove`, `onPartRotate` and two-pin `onWireCreate` callbacks remain usable. An `onCommand` handler takes precedence over all legacy edit callbacks; never apply both paths for one gesture.

| Contract | Renderer behaviour | Host responsibility |
| --- | --- | --- |
| `NavigationPreferences` | Explicit `trackpad` or `mouse` profile; configurable scroll action, sensitivities and inversion; initial view defaults to `top` | Store user preferences. Hardware is never inferred from wheel deltas |
| `CameraState` | Target, position, up vector and zoom; resize does not fit or reset the camera | Save `onCameraChange` outside electrical history; pass `initialCameraState` on remount |
| `Selection` | Controlled stable part, wire or net ID; reports invalid part/wire selection after removal | Own selection across views. For a net selection, supply `highlightedWireIds`; renderer does not resolve nets |
| `InteractionState` | Idle, wire draft, reconnection, placement, route preview or pending host result | Optional `onInteractionChange` for contextual controls |
| `RendererCommand` | One `actionId`, human-readable `label`, `expectedRevision` and typed `edit` per completed action | Validate and apply atomically through the shared command facade, producing one undo entry |
| `CommandResult` | Waits for `{accepted:true}` or `{accepted:false,feedback}`; prevents another edit while pending | Return an acknowledgement only after validation/commit. Do not return success for a queued or partial mutation |
| `ViewportFeedback` | Code, message, affected IDs and recovery instruction; shown locally and emitted via `onFeedback` | Present an accessible host error if appropriate |
| `PinDefinition.capability` | `visual` by default; optional host-declared `mapped` or `simulated` | Validate actual host pin identities and capabilities. Geometry does not establish electrical support |
| `CircuitWire` | Original ID and pin references; optional `waypoints`, `label`, `pattern`, colour and cable lift | Own persisted style, routes and connectivity. Labels are decorative, never net names |

The new advanced edit path requires **both** `projectRevision` and `onCommand`. Without them, legacy part edits and direct two-pin wiring remain available; unsupported route/reconnection requests return an unavailable message. This avoids dropping waypoint data through the old two-argument callback.

### Command payloads

| `edit.type` | Payload | Semantics |
| --- | --- | --- |
| `part.move` | `id`, `position` | Proposed physical placement in renderer millimetres |
| `part.rotate` | `id`, `radians` | Y-axis rotation |
| `wire.create` | `from`, `to`, `waypoints` | Host allocates the persistent wire ID; `actionId` can be its idempotency key |
| `wire.reconnect` | `id`, `end: 'from' \| 'to'`, `pin` | Preserve the old wire ID and all other fields until the entire edit is accepted |
| `wire.route` | `id`, `waypoints` | Replace only the 3D presentation route; preserve both electrical endpoints |
| `wire.delete` | `id` | Request deletion through the host, not a geometry-based net operation |

Before dispatching, the renderer checks finite geometry, route bounds, visible pin references, locked parts, self-connections, duplicates, missing entities, unchanged edits and stale previews. These are structural checks only. The parent must additionally validate the expected **project** revision, authoritative electrical pins, existing contacts, runtime policy and any ambiguous physical placement. Recheck revision at commit time for asynchronous validation.

Once submitted, a command belongs to the host. Escape cannot undo an already submitted command. A pending host command must resolve or reject; cancellation of an asynchronous host operation is not claimed. The command's action ID is unique and should be deduplicated by the host if it retries delivery.

`projectRevision` must reflect design changes, not camera movement, simulator observations or hover. The renderer also compares its input circuit when a draft is active, so an import or changed scene cancels a stale draft. An accepted edit produces no private renderer undo record. Preview state is discarded after acknowledgement and the renderer displays the supplied circuit.

### Minimal wiring example

The following `validateAndCommit` function is deliberately a host-supplied boundary, not an existing `ProjectController` method:

```tsx
<CircuitViewport
  ref={viewport}
  circuit={mappedScene}
  selection={sharedSelection}
  onSelect={setSharedSelection}
  mode={tool}
  projectRevision={project.revision}
  onCommand={validateAndCommit}
  navigation={preferences.navigation}
  initialCameraState={viewState.camera}
  onCameraChange={saveCameraPreference}
  largerTargets={preferences.largerTargets}
  labelScale={preferences.largerText ? 1.25 : 1}
  reducedMotion={preferences.reducedMotion}
  onFeedback={showFeedback}
/>
```

Coordinate this exported contract with Agent B before changing the host controls. This branch does not change `apps/desktop/src/features/Circuit3D.tsx`. In particular, its old camera selector/help text still describes isometric/wheel-zoom defaults and must be updated. It currently uses legacy callbacks, so the advanced editing workflow is a host integration gate, not a completed host feature.

## Navigation and persistence

The initial camera is top down. Visible Select, Pan, Orbit, zoom, Fit and Top controls are included by default. Set `showNavigationControls={false}` when the host provides equivalent accessible controls. `mode` accepts `inspect`, `pan`, `orbit`, `move`, `wire` and `interact`. `inspect` selects without orbiting. Pan and Orbit use the primary button. Middle/right dragging are optional pan shortcuts, not requirements.

`twoFingerAction` defaults to `pan` for both profiles. Set it explicitly to `zoom` for a conventional mouse wheel if desired. Pixel, line and page wheel deltas are normalized. Shift redirects a vertical pan horizontally; Ctrl/Meta wheel zooms within the canvas. Wheel listeners are attached only to the canvas. Sidebars keep normal scrolling. Native trackpad pinch feel is not established by synthetic modified-wheel events.

The handle exposes `fit`, `focusSelection`, `setView`, `pan(xPixels,yPixels)`, `zoom(factor)`, `orbit(xPixels,yPixels)`, `getCameraState`, `restoreCamera`, `setNavigationTool` and `cancelInteraction`. Camera presets retain target and zoom; Fit is explicit. Changing a controlled `mode` cancels the old interaction. A host using the built-in navigation override should reset its mode through the handle when reactivating an already selected edit tool.

Remount persistence is intentionally explicit: use `onCameraChange` and `initialCameraState`. There is no global camera store keyed ambiguously across projects. A hidden but mounted viewport retains its own camera. Save preferences separately from the canonical circuit and history.

All camera changes are immediate, with no inertia, damping or decorative transitions. `reducedMotion` therefore requires no different animation path. Actual host-supplied simulation state is still displayed; reduced motion does not fabricate a different output.

## Picking and editing

Pin and cable hit tests use a radius of 12 CSS pixels, or 22 with `largerTargets`. Their hit regions are independent of visible mesh size. All nearby candidates are returned, including overlapping or occluded anchors. The renderer shows a keyboard-focusable choice list rather than silently selecting a hidden pin. `onPickCandidates` and `chooseCandidate(key)` let a host supplement that list.

Wiring is source click, zero or more background bend clicks, destination click. Reconnection keeps the original cable until an accepted command. Escape, window blur, pointer cancellation, lost capture and mode change cancel held gestures. Focus moving to an external host pin picker releases held input but retains a click-based wiring draft so the picker can finish it. Pointer motion below five CSS pixels cannot become a part drag.

A Move click starts click-to-place; the next canvas click or Enter commits. Dragging is also supported and commits on release. Arrow keys provide placement alternatives. Each completed movement submits once; no-op, rejected and canceled edits create no renderer-originated history transaction.

A selected wire exposes reconnect controls and route editing when `onCommand` is enabled. Route handles are buttons: select a bend/segment, then click a position or use arrows, then Apply. Adding/removing bends, moving segments and editing several points stays in one preview. Endpoints remain attached to pins. Moving an endpoint-adjacent segment inserts presentation bends instead of moving a pin. The original automatic arch is replaced only when explicit route points are applied.

For host-owned keyboard controls, the handle exposes:

```ts
viewport.choosePin({ partId, pinId });
viewport.addWireBend([x, y, z]);
viewport.beginReconnect(wireId, 'to');
viewport.beginPlacement(partId);
viewport.previewPlacement([x, y, z]);
viewport.commitPlacement();
viewport.beginRouteEdit(wireId);
viewport.insertBend(index, [x, y, z]);
viewport.moveBend(index, [x, y, z]);
viewport.removeBend(index);
viewport.moveSegment(segmentIndex, [dx, dy, dz]);
viewport.commitRoute();
viewport.deleteWire(wireId);
viewport.cancelInteraction();
```

Do not pass upstream 2D `waypoints` into this 3D array as though their coordinate systems were identical. Store 2D physical routes, 3D cable paths and schematic routes separately, attached to the same connection ID. The existing Velxio adapter was not changed to reinterpret route metadata. Map host style/label state explicitly into `CircuitWire`; preserve all host extension fields when committing.

## Visuals, quality and recovery

Draft disables shadow rendering and uses lower cable tessellation. Balanced/high increase shadows and cable quality. Device pixel ratio limits are 1, 2 and 3 respectively, without forcing 2x rendering on a 1x display. Shader lighting, contact details, resistor end caps and LED polarity marking remain procedural and local. Dimensions and pin locations are approximate; no CAD-fit or electrical qualification is implied.

Selection uses corner brackets and cable markers, plus endpoint/route handles. `pattern` adds contrasting cable markers; `label` appears as decorative text. `isolateSelectedWire` dims other wires, and `highlightedWireIds` accepts explicit host selection. Theme foreground colours control labels and selection contrast. `labelScale` enlarges scene labels and overlay text; `largerTargets` enlarges hit areas and controls. This is not a WCAG conformance claim.

Context loss pauses rendering, cancels drafts/held inputs and keeps controlled circuit/camera state. On restoration the local environment texture is rebuilt and the camera restored. No simulator is restarted by the renderer. A failure to regain a context still requires reopening the viewport.

`capture(1..3)` returns a scene PNG data URL and restores the prior pixel ratio, including on failure. Non-finite requested ratios fall back to 2. It returns undefined during context loss. The scene capture excludes HTML toolbars, candidate lists and wire label overlays. The host owns native save dialogs and truthful save status.

## Remaining integration gates

1. Attach the command adapter and preserve imported IDs, extension fields, label/style and route metadata. Validate exact real pins. Keep vendor pinned.
2. Share selection, preferences and camera state with Agent B; expose a keyboard pin list and update the current host help text.
3. Connect the parent's atomic history/runtime policy. Test exactly one undo per completed edit in actual BreadBit, and no history changes for navigation, rejected/canceled edits or preview points.
4. Complete the actual Uno/button/LED task on a physical trackpad and on a mouse. Confirm electrical edits and view changes preserve the intended identities.
5. Qualify real GPU performance, 100/150/200% scaling, keyboard/screen-reader behaviour, and each native OS/WebView separately.
6. Run full root tests, typecheck and build once the locked dependencies and pinned Velxio checkout are available. Execute compiled-firmware checks separately; these renderer checks are not simulation evidence.
