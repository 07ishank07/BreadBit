# BreadBit usability, graphics and schematic plan

Status: DRAFT — user interview in progress; no implementation started for this plan.
Branch: codex/trackpad-3d-ux. Created from the merged foundation, carrying the existing integration changes.
Date: 20 October 2026.

## Confirmed user requirements

- Usable across desktop and laptop computers, with trackpads and keyboard/mouse.
- Start in top-down view, with explicit Orbit and Pan tools.
- Default to a circuit-focused workspace; Code and inspector open on demand. Panes remain resizable/collapsible.
- Simple default interface, with advanced controls available through progressive disclosure; do not require a separate expert mode.
- Primary construction workflow is schematic or physical 2D according to experience level, followed by 3D inspection. Retain required electrical editing in all three views; do not remove 3D editing merely because inspection is its primary role.
- Realistic 3D components with adjustable quality, and light/dark themes.
- Fix wire editing in BOTH physical 2D and 3D as the first priority. All five actions are first-release requirements: connect pins, reconnect an existing end, move bends/segments, delete wires, and change color/label.
- Wiring uses click source, click optional bends, click destination; Escape cancels without committing.
- Electrical editing in all three views is required in the first release; ambiguous physical placement requires review.
- Add an LTspice-style schematic using the requested IEEE symbol conventions, synchronized with the physical views.
- Export the schematic to PDF. User confirmed American-style symbols (including zigzag resistors), node dots, net labels and orthogonal wires. PDF page size/orientation and optional contents were not individually specified by the blanket yes; propose configurable A4/Letter, portrait/landscape, title block, values and parts list. Proposed default: A4 landscape with values and title block, optional parts list. These defaults remain provisional.
- First complete task: build and simulate an Uno + button + LED circuit.
- Trackpad two-finger scrolling is configurable and defaults to pan. Visible Pan/Orbit/zoom controls remain available.
- Build must be explicitly completed before Run; Run must never auto-compile.
- Automatically save local projects, with explicit export to files.
- Ambiguous schematic edits show suggested physical placements; the user chooses before the edit is applied. Cancel leaves all views unchanged.
- A database for users' files/projects is later work; do not add authentication, cloud storage or a database now.

## Observed baseline versus proposals

Verified source findings: stock OrbitControls relies on wheel zoom and button-based panning; pin picking uses fixed world-size targets; camera refits on viewport resize; selection/camera are view-local; panels use fixed widths; wire editing is mainly endpoint creation rather than a consistent reconnect/bend workflow. Global project history exists, but names every captured edit Workspace edit. Schematic types exist in packages/project-core/src/schematic.ts; no schematic generator/editor or PDF exporter exists.

The prior integration passed 28 tests and a production build. BreadBit type checks passed with 68 existing vendor diagnostics. These checks do not establish trackpad usability, cross-platform support or firmware correctness. Current planning agents reviewed source, not physical trackpad behavior.

Recommended support policy: target Windows, macOS and Linux desktop/laptop browsers, then separately qualify the packaged Tauri/WebView hosts on each OS. Do not claim every hardware/browser combination. Test laptop and desktop layouts at 1280x720 and 1920x1080, with 100/150/200% scaling/zoom; record actual OS/input/browser combinations. Mobile/touchscreen is not required by the current request.

## Two agents and integration owner

| Owner | Files and responsibility | Exclusions |
|---|---|---|
| Agent A: graphics and spatial interaction | packages/circuit-renderer/src/**, renderer tests/preview and API documentation | No host global stores, electrical inference, schematic editor or PDF |
| Agent B: UI/UX and schematic presentation | apps/desktop/src/App.tsx, styles, features/Circuit3D.tsx, new workspace/components/schematic UI, shortcuts/preferences, PDF layout integration | No renderer internals; no duplicated electrical model |
| Parent/integrator | project-core, project.ts, scene mapping, net resolver, common command contract, persistence migrations, package/dependency changes and end-to-end checks | Coordinates shared changes; does not silently let both agents edit the same file |

Use these two agents for implementation after interview decisions are incorporated. Their current read-only audits are complete. The parent owns the extra electrical-model work because schematic editing is a substantial feature, not only UI styling.

## Phase 0: freeze shared contracts

1. NavigationPreferences: explicit trackpad/mouse profile, sensitivity, invert options, configurable two-finger scroll with pan default, top-down initial view. User chooses a profile; do not infer hardware reliably from wheel deltas.
2. CameraState: target, orientation and zoom retained through pane resize and view switches, stored as preferences/view state outside electrical undo.
3. Selection: stable component/wire/net IDs owned by host. Renderer reports events. Clear invalid selections on delete/import.
4. InteractionState: current tool, drag preview, source pin, candidate destination, cancellation. One operation owns the pointer at a time.
5. ProjectCommand: stable action ID, human-readable label, validated payload and expected project revision. Reconnect retains the old wire until commit. One completed action equals one undo step; no-op/rejected/canceled actions equal zero.
6. Capability/feedback: distinguish a visible mesh pin, a mapped electrical pin, and a simulated capability. Return structured errors with affected entity IDs and a recovery action.
7. Viewport API: fit, focus selection, pan, zoom, camera preset, cancel and camera snapshot. Keep rendering demand-driven.
8. Routes: physical 2D waypoints, 3D cable geometry and schematic orthogonal routes are separate representations of the same electrical connection. Route edits must not implicitly change electrical nodes.

## Agent A brief: 3D graphics and interaction

P0 — navigation and wiring reliability:
- Top-down default; emphasize inspection and explicit Pan/Orbit. Keep Select/Move, Wire and Interact readily accessible without cluttering the default view. Provide left-click routes for every essential action, plus mouse shortcuts.
- Prototype trackpad wheel/pinch routing within the viewport. Preserve ordinary sidebar/code scrolling and browser page zoom outside it. Handle wheel delta modes; no synthetic test can certify native pinch feel.
- Enlarge pin and wire hit areas in screen space, independently from visible geometry. Offer overlapping candidate IDs rather than silently choosing a hidden pin.
- Wire endpoints and bend handles: reconnect, insert/move/remove bends, preview source/target, Esc cancel. Parent validates before any committed topology change.
- Pointer movement threshold and explicit gesture arbitration prevent camera movement from moving parts. Release on pointer cancel, blur, lost capture and mode change.
- Preserve camera framing during panel resizing/view changes. Fit is explicit. Bare-key shortcuts must respect modifier keys and text/dialog focus.

P1 — visual clarity and rendering:
- Selection outlines, endpoint highlights, readable pin labels and useful wire isolation. Do not rely on color alone.
- Expose draft/balanced/high quality and reduced motion through host settings.
- Benchmark 20/100/300-part scenes on representative integrated/discrete GPU machines; record frame time, input latency, draw calls, memory and idle rendering. Provisional goal: smooth interaction near 60 FPS on the agreed typical fixture, with a usable lower-quality mode; no universal performance claim.
- Context-loss recovery keeps the current project and camera intact.

P2 — model polish:
- Improve realistic, recognizable meshes, labels, materials and cable appearance after wiring tests pass. Realism is a confirmed visual direction, with adjustable quality to preserve laptop usability. Pin legibility and electrical identity take precedence over decorative detail; realistic rendering does not imply calibrated physical accuracy.
- Keep approximate dimensions disclosed. No invented pin mappings or inferred simulation effects.

Agent A deliverables: updated renderer APIs, interaction prototype, geometry/picking/cancellation tests, benchmark report, screenshots and host migration notes. No separate standalone renderer demo may substitute for testing in BreadBit.

## Agent B brief: UI/UX, schematic editor and export

P0 — make daily editing usable:
- Circuit-focused default with Code and inspector closed until requested; offer Code / Split layouts, resizable/collapsible panes, remembered sizes and uncluttered toolbars. Simple controls first, advanced options on demand. Never unmount simulation subscriptions merely to change layouts.
- Clear active mode, device-specific help, accessible zoom/fit/pan/orbit buttons, shortcut reference.
- Common wire inspector in physical 2D and 3D: endpoints, reconnect, bend/segment operations, delete and label/color as required first-release actions. Net highlighting and auto-routing follow these priorities. Label text must distinguish decorative wire labels from connectivity-affecting net names.
- Keyboard-accessible part/pin picker and source/destination connection workflow; primary actions must not require hover precision or dragging.
- Contextual selected-entity inspector instead of permanent introductory copy; errors remain readable and actionable.
- Show named Undo/Redo actions; preserve Monaco text history. Camera/view/preferences do not dirty the circuit.
- Automatic local project persistence with a project list, stable IDs, last-saved status, reopen/rename and explicit file export. Keep recovery snapshots separate from the normal project collection; a single recovery draft is not autosave for multiple projects.
- Desktop storage recommendation: application-managed project files and a small local index, with atomic replacement and recovery. Browser preview needs a separate durable storage adapter (evaluate IndexedDB or OPFS); explain quota/eviction limits, catch failures, and offer export. This browser storage implementation is distinct from the deferred multi-user/backend database; do not add a server database or authentication now.
- Fix canceled New/Open behavior so cancellation leaves the current project intact. Show Saving / Saved locally / Save failed, distinguish exports from autosave, and never claim success before persistence confirms. Make unsaved work recoverable on failure; preserve project identity and schema versions for later storage migration.
- Separate Build and Run. Build records source/toolchain/board configuration fingerprints. Code, library or build-target changes invalidate the artifact; failed Build cannot fall back silently to an older binary. Disable Run with an actionable reason until a successful current build exists. Layout-only changes do not demand recompilation; electrical changes invalidate the simulation session and need validation/restart. Run uses the explicitly built artifact and never compiles automatically.

P1 — schematic and PDF, after net-model gate:
- Add Physical 2D / Schematic / 3D views sharing electrical IDs, selection and revision awareness. Guide newer users toward physical 2D and experienced users toward schematic construction, without hard-locking either workflow or imposing a separate expert mode. Present 3D as the natural inspection destination while retaining its editing tools.
- SVG-based symbol/route presentation recommended for editable crisp text and vector export. Start with Uno as a labeled functional block plus LED, resistor, pushbutton, power/ground and net labels.
- Orthogonal wires, explicit junction dots, unconnected crossings, stable reference designators and values. Do not infer a connection merely because drawn lines cross.
- Generate readable layout, permit manual symbol placement/route edits, preserve manual changes on regeneration where possible, and preview disruptive regeneration.
- Bidirectional electrical editing is a separate gate: apply shared validated commands and resolve physical-realization ambiguities before commit. The user requires this in the first release: layout-only schematic export is an intermediate milestone, not a completed deliverable.
- PDF export from a frozen project revision using vector primitives/text, page size/orientation, margins, title block and optional parts list. Include revision and warnings for unresolved content. Select a maintained export dependency only after compatibility/license checks; browser print is a fallback, not proof of a working dedicated export.
- Test multipage clipping, line weight, font embedding, symbols, selectable text and PDF opening. PDF is a static export, not a synchronized editable file.

P2 — efficiency and polish:
- Search/add components from either physical view, duplicate/multi-select and alignment after transaction semantics are stable.
- Consistent light/dark themes across shell, schematic and 3D; readable typography, comfortable targets, visible focus, keyboard tab patterns and optional onboarding. Test wire, selection and pin contrast in both themes.
- Future database boundary: keep stable project/asset IDs and schema versions; later add a repository/storage interface. No cloud-only identity requirement for local projects.

Agent B deliverables: task layouts, wire editor UI, accessibility and keyboard tests, schematic presentation/export module, user-facing shortcut guide and before/after workflow evidence.

## Shared schematic correctness gate

The current wire list is not a complete netlist. Resolve breadboard conductive strips, seating contacts, explicit jumpers and qualified component pin mappings using host behavior; do not build the schematic by simply tracing screen coordinates. Keep physical contacts and explicit wires distinct so deleting one route does not incorrectly disconnect an entire net.

Canonical net equivalence must be checked across physical input and schematic output. Tests include breadboard rail splits, junction vs crossing, same-name label scope, repeated ground pins, dangling pins, net merge/split, imported unknown parts and undo/redo. Unknown mappings block an authoritative electrical projection; show placeholders/warnings rather than fabricate connections.

Ambiguity examples:
- Moving a schematic symbol changes only schematic layout.
- Reconnecting a symbol pin changes electrical intent; if multiple breadboard holes/jumper paths could realize it, preview suggested placements and require a choice before committing either electrical intent or physical realization. Do not leave a partially applied pending design.
- Deleting a schematic segment in a net with alternate conductive paths might change only presentation. Distinguish delete-route from disconnect-terminal/net-split.
- Adding a component in schematic requires a physical placement choice; do not silently place it into an arbitrary hole.
- Store one atomic cross-view accepted transaction. Reject stale proposals after intervening edits. A canceled choice leaves every view unchanged.

## Milestones and release checks

M0: finish interview, freeze contracts and support matrix; establish baseline tasks.
M1: top-down navigation prototype + responsive shell; validate on an actual trackpad and mouse before rendering polish.
M2: shared wire creation/reconnection/bend/delete workflow across 2D/3D, with command history and cancellation.
M3: resolved electrical graph + qualified Uno starter symbols + schematic projection and PDF. This is an internal milestone only; first release also requires M4 electrical editing. Do not skip graph equivalence checks to meet a UI deadline.
M4: integrate supported electrical edits between all three views, explicit ambiguity choices, save/reopen migrations and regression tests.
M5: automatic local project storage/recovery/export, explicit Build/Run readiness, graphics polish, performance/accessibility pass and full starter-circuit qualification. Local persistence and Build/Run are release requirements, not optional follow-up work.
Later: users/projects database, authentication/sync policy and storage migrations. Revisit offline behavior before choosing a database.

Release scenario: add Uno, LED and series resistor, button with a defined input configuration; wire, reconnect and edit a bend in each supported physical view; undo/redo; inspect identical electrical nets in the schematic; export a legible PDF; verify automatic local save, close/reopen and export/import; explicitly Build, then Run qualified firmware and verify button-to-LED behavior with observed output. Record build/configuration and actual results. Compilation alone does not pass the simulation step. Change firmware after Build and verify Run is blocked until rebuilt; cancel a suggested placement and verify zero electrical/history change. Force an autosave failure and verify a visible error plus export/recovery path.

Input matrix: trackpad+keyboard and mouse+keyboard, keyboard-only alternatives for core actions, Windows/macOS/Linux browsers and separately packaged WebViews, differing display scaling, reduced motion, view resizing, cancel/blur, unsupported parts, malformed import, missing compiler and context loss. Trackpad checks require human physical-device testing; automation supplements them.

## AAS selection and limits

Actual local AAS McpServer discovery/get_skill/read_skill_file/compose_stack/inspect_stack calls were used. Catalog: agentic-awesome-skills 19.11.0, digest sha256-1f225febafbc8cb43666ed20ce23768b4576cf8bb7c545992e09945e69e67382. Manifest/inspection are under docs/aas/usability; inspection returned valid. This validates catalog identity/schema, not plan quality or usability.

Selected: 3d-web-experience (scene/controls/performance), threejs-interaction (picking/gesture reference), frontend-design (existing brand and functional layout), accessibility-compliance-accessibility-audit (keyboard/focus/contrast audit planning), javascript-testing-patterns (behavioral verification). Agent A uses the first two plus testing; Agent B uses design/accessibility plus testing. The first three declare critical risk in catalog prose; accessibility/testing declare safe. Sources are community, except 3d-web-experience names vibeship-spawner-skills Apache2.0. Risk metadata is not a capability or permission grant. Existing React/R3F/Three dependencies are prerequisites; no skill installation or imported scripts executed. AAS schema dependencies were restored only in local scratch tooling.

Compared but excluded: ui-ux-pro-max has a Python-driven generator setup not needed for this focused workbench plan; threejs-geometry is deferred until model optimization warrants it. Generic graphics guidance does not establish circuit correctness. Schematic/netlist engineering and PDF-specific validation remain explicit domain coverage gaps in this selected stack, addressed by the parent-owned correctness gates and primary references, not a fabricated AAS certification. The old foundation stack remains historical and has a stale no-3D constraint; this new stack applies to the current plan.

## Primary references and convention decisions

Analog Devices describes LTspice schematic capture and wiring: https://www.analog.com/en/resources/media-center/videos/6368296317112.html . Its official schematic reference documents named nodes and orthogonal routing: https://github.com/analogdevicesinc/ltspice-reference/blob/main/ai_ref/SCHEMATIC-REFERENCE.md . IEEE identifies IEEE/ANSI315-1975 as Graphic Symbols for Electrical and Electronics Diagrams: https://standards.ieee.org/ieee/315/515/ . These are references, not a claim that LTspice appearance establishes IEEE compliance. The familiar American-style appearance is confirmed; precise standards conformance and asset rights still require verification. Draw or use appropriately licensed symbols; do not bundle proprietary LTspice assets or standards PDFs.

See usability-interview.md for decisions and remaining questions. Only explicitly unanswered preferences remain provisional; confirmed user choices above are requirements.
