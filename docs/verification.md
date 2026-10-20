# Verification record — 20 October 2026

Environment: Windows, Node 24.13.0, pinned Velxio 795a4fa3c1063e97cb301e82e9749b2bca54acd9.

- Unit/integration tests: 16 passed across project-core, runtime contracts and the mocked Velxio persistence adapter.
- BreadBit TypeScript: core, runtime and authored app/adapter checks passed.
- Upstream TypeScript: 68 diagnostics in the pinned source. Recorded in upstream-typecheck-baseline.txt; excluded from the authored-code check, not represented as passing.
- Production renderer: Vite build passed. Existing upstream locale chunk warnings and a roughly 4.8 MB main JavaScript chunk remain performance work.
- UI smoke: opened the actual local renderer in the in-app browser; verified Uno/circuit, firmware editor, inspector and assistant availability text. Renamed a board, observed revision advancement, then verified Undo and Redo restored the corresponding name while retaining sketch.ino.
- Git: upstream vendor working tree unchanged; pinned gitlink registered. No commit or push made.
- AAS: seven explicitly selected skills composed and inspected successfully; catalog/manifest records in docs/aas. No skills installed.
- Backend checker: correctly reports unavailable Python interpreter and Arduino CLI. No backend was launched.
- Native checks: Rust/Cargo absent. Native compilation, storage tests, dialogs, WebView2 behavior and installer qualification NOT executed.

The Vitest host needed TEMP/TMP pointed at C:\BreadBit\.cache\tmp because the sandbox's default temporary directory denied cache renames. This was an execution-environment adjustment; normal project test configuration is unchanged.

No compiled firmware run, physical electronics result, scenario assertion, schematic generation, autonomous AI repair, or 3D functionality was validated or claimed.

## 3D integration verification — 20 October 2026

- Merged origin/main 88c2806 into the foundation branch; upstream Velxio submodule is unchanged.
- npm test: 21 application tests plus 7 contributed renderer geometry tests passed.
- npm run typecheck: BreadBit app/adapters and core contracts passed; the pinned upstream still reports 68 diagnostics.
- npm run build: passed. The lazy 3D chunk is 981.24 kB (266.41 kB gzip). Existing large-main-chunk and mixed locale import warnings remain.
- Browser preview: rendered the contributed Uno/LED/resistor meshes and wires; verified 3D board nudge, Ctrl+Z, Ctrl+Shift+Z, component deletion with attached wires, undo restoration, and switching to 2D with restored entities.
- Native shell, compiled-firmware interaction bridge, all pin mappings and electrical scenarios remain unqualified. No claims of passed MCU simulation tests.
- Screenshot: captured the running integrated 3D workspace. Detailed controls and limits are in 3d-integration.md.
