# BreadBit

A local electronics workbench built around a pinned public Velxio revision. This repository contains the **working development foundation**, not a qualified desktop release. The current scope is 2D circuits, firmware editing, project storage boundaries and structured AI/runtime contracts. **3D is deferred and has no implementation or dependency here.**

## Run the editor

Use Node.js 22.12+ and Git. From this directory:

```powershell
git submodule update --init vendor/velxio
npm ci
npm run dev
```

Open `http://127.0.0.1:1420`. This is the development preview of the desktop renderer. It uses Velxio's actual 2D component editor, Monaco and simulator integrations; no imitation canvas was created. Assets and Monaco are served locally. The root package is deliberately one install, with separate source packages and no workspace symlink requirement on Windows.

For the native app, install the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) including Rust, MSVC tools and WebView2, then run:

```powershell
npm run doctor
npm run desktop:dev
```

Rust/Cargo are not installed on the machine used for this foundation. Native compilation, native file dialogs, storage tests and clean-machine installation therefore remain **unverified**. Installer bundling is disabled. `npm run desktop:build` builds a native executable when prerequisites are available; it does not produce a qualified signed installer.

## Repository map

```text
apps/desktop/
  src/App.tsx                 BreadBit workbench around Velxio components
  src/integrations/           Project snapshot adapter, native IPC, local telemetry policy
  src-tauri/                  Own Rust/Tauri shell, native storage, restricted capabilities
packages/
  project-core/              Versioned documents, validation, transactions, history, AI proposals
  runtime-contracts/         Artifacts, sessions, capabilities and update-policy contracts
services/local-backend/      Explicit development checker/launcher for upstream FastAPI
vendor/velxio/               Public upstream Git submodule; do not edit casually
scripts/                    Assets, prerequisites and integration type checks
docs/
  aas/                      Actual AAS selection, catalog identity and validation
  architecture/             Decisions and boundaries
  desktop.md                Native IPC and packaging gates
  implementation-status.md  What exists, verification evidence and next work
.github/workflows/          JavaScript checks and opt-in Windows native checks
upstream.lock.json          Exact upstream commit and origin
velxio-desktop-plan.md       Product plan, with current scope amendment
```

## Working functionality and boundaries

- Live 2D editing, firmware files and the existing upstream instruments are integrated. The imported catalog is broader than the currently qualified desktop runtime; its presence is not a support guarantee.
- Native storage commands have open/save/save-as dialogs, opaque file handles, bounded JSON, backups and external-edit conflict detection. Browser preview uses import/download instead.
- `.breadbit` files contain a versioned envelope around a Velxio-compatible document. `.vlx` interchange is retained. This first frame uses a single JSON file; the plan's project-directory format remains a later migration.
- The adapter observes design changes, captures recovery drafts and provides whole-project undo/redo. Undo reloads the simulator and discards runtime state. It is not time travel. Monaco and upstream canvas also retain their own local editing histories.
- AI proposal validation and tool names are implemented as contracts, with no provider calls or autonomous execution. The inspector shows this explicitly. Compilation is never presented as a passed simulation test.
- A packaged Python backend, local compiler pack, authenticated sidecar and QEMU are not connected. The optional developer launcher checks prerequisites and does not install them. See [backend setup](services/local-backend/README.md).
- Schematic generation/editing, complete qualified pin definitions, scenario runner, cloud AI and 3D are not implemented.

The desktop composition does not mount upstream marketing, accounts, news or its private desktop/license flow. A small Vite integration suppresses upstream run telemetry. Hosted features are not unlocked or copied. Other optional upstream network features are not qualified for the offline desktop product.

## Checks

```powershell
npm test
npm run typecheck
npm run build
npm run doctor
npm run backend:check
```

`typecheck` checks our core, runtime contracts and authored app/adapter files. Upstream TypeScript diagnostics are recorded separately in `.cache/upstream-typecheck.txt`; this is not a claim that upstream passes TypeScript. The Vite production build includes the real upstream modules.

On restricted Windows test runners, point `TEMP` and `TMP` at a writable local directory if Vitest reports a temporary-cache rename denial. This affects the test host, not the app code.

## Upstream and licenses

Velxio is pinned to `795a4fa3c1063e97cb301e82e9749b2bca54acd9`. Its AGPLv3 license and notices are retained. This foundation follows the open-source derivative path; no proprietary license was purchased or assumed. See [third-party notices](THIRD_PARTY_NOTICES.md). Private desktop code and hosted-only emulators are not part of this repository.

Before upgrading, review the upstream diff, update the submodule pointer and `upstream.lock.json` together, then run import/history tests and the renderer build. Never assume a dependency or asset's presence establishes redistribution or electrical-model qualification.
