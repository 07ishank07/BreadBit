# Foundation status

Scope: implement the BreadBit application frame using public Velxio and AAS guidance, now extended with the 3D renderer from origin/main. See [3D integration](3d-integration.md) for current behavior and limits.

## Implemented

| Boundary | Implementation |
|---|---|
| Reuse | Public Velxio pinned as a submodule; original frontend/backend remain unchanged |
| App | Own React entry and workbench composed from upstream 2D canvas, firmware editor, files, toolbar, serial and scope |
| Projects | Typed version-1 envelope, structural reference checks, compatible imports/exports, observed edit history and recovery draft |
| Native shell | Tauri configuration, native file commands, opaque handles, JSON limits, backup/atomic replacement and conflict detection |
| Runtime | Artifact/session identities and conservative edit policy, with explicit unavailable states |
| AI | Bounded structured proposal validation and supported tool contracts; no model provider or fake response |
| Maintenance | Root lockfile, CI, prerequisite doctor, architecture decision and actual validated AAS manifest |

## Verification

See [verification.md](verification.md) for executed checks and unverified native/runtime gates. Schematic pin/symbol/intent contracts are defined in project-core/src/schematic.ts; there is no schematic generator or editor yet.

## Intentional foundation limits

The upstream 2D stores remain the live editor authority. BreadBit observes their changes into a durable envelope; it does not pretend all upstream mutations already flow through one canonical command facade. Global history groups edits after a short debounce. An undo reloads the upstream state and restarts runtime setup. Subsequent work should route individual UI and AI edits through the same transaction dispatcher.

The file adapter repairs two upstream import omissions: custom firmware group IDs and serial baud rate. It preserves board options/SPIFFS fields and uses projected design properties rather than transient sensor observations. Derived endpoint coordinates do not generate undo entries. Tests cover these cases.

Native storage is implemented in source but not executed here because Rust/Cargo are unavailable. The native shell does not spawn unqualified compiler processes. Development backend startup is separate, explicit and loopback-only; production authentication and lifecycle handling are future work.

The inspector's connection list is an explicit-wire list, not a resolved netlist or generated schematic. Breadboard strips and implicit contacts require the existing resolver and equivalence fixtures before a schematic projection is safe.

Recovery uses one local draft. Opening another project requires discarding unsaved changes; save a project file first to retain both. Native multi-file journal recovery, multiple drafts and migrations are later work. Browser downloads cannot confirm the user retained the file.

## Next implementation gates

1. Build/run this shell with the Windows Rust/MSVC toolchain; execute native storage tests and validate keyboard shortcuts, file conflicts, CSP, workers and local assets in WebView2.
2. Package the Python backend and AVR compiler with scoped authenticated transport, process shutdown, health probes and offline fixture tests.
3. Qualify one Uno/button/LED circuit using compiled firmware and recorded inputs/outputs. Reject stale binaries and disclose model limits.
4. Replace observed snapshots with command transactions shared by UI and agent tools. Add qualified catalog pin definitions.
5. Add an actual bounded AI provider/tool execution loop and immutable scenario evidence; retain candidate preview and rollback.
6. Add schematic projection and equivalence tests. Qualify breadboard geometry and complete the 3D pin mapping catalog.

No installer, firmware compilation success, simulated test success, AI repair or general electrical accuracy is claimed by the current scaffold.
