# Agent A verification

Executed 20 October 2026. This record supersedes the original renderer verification for the changed interaction APIs. Scope is the renderer package, not full BreadBit acceptance or electrical simulation.

## Executed checks

| Check | Result |
| --- | --- |
| Renderer geometry, adapter and interaction tests | 14 passed with the exact cached lockfile versions of Three.js and TSX |
| Renderer source typecheck | Passed using `tsc -p packages/circuit-renderer/tsconfig.build.json --noEmit --emitDeclarationOnly false` |
| Source, preview and test typecheck | Passed with a scratch config extending the package config, excluding unavailable Vite config imports and using the runtime's existing Node declarations |
| Offline preview bundle | Passed with cached esbuild; no dependency manifest or lockfile changed |
| Browser component workflows | 15 groups passed; no page exceptions recorded |
| Context loss/restoration | Passed with `WEBGL_lose_context`; circuit and camera unchanged |
| Scene PNG capture | Passed at 2232 by 1342 pixels; original pixel ratio restored |
| Root `npm test` | Blocked: incomplete install; `vitest` executable unavailable |
| Root `npm run typecheck` | Blocked: incomplete install; root `tsc` command shim unavailable. Direct renderer checking above passed |
| Root `npm run build` | Blocked: `prepare-assets.mjs` reports missing pinned Velxio source |
| Physical trackpad, real GPU, native OS/WebView and firmware tasks | Not executed |

The normal dependency installation failed, and offline npm installation could not obtain all locked packages. The local cache supplied 122 packages whose integrity matched the root lockfile; their contents were extracted locally without changing source manifests. The exact renderer dependencies were sufficient for scoped checks. The Velxio directory remains unpopulated. Its pinned gitlink and lock revision were not changed.

The selected AAS skill IDs and manifest were read from the plan. Their original skill source path was on another machine; local instructions were absent, and remote fetches failed. No skill installation, script execution or AAS quality claim was made. Implementation followed the explicit repository contribution rules and Agent A requirements.

## Browser scope

Environment: Windows 10.0.26200, Node 24.13.0, Chromium 155.0.8059.85, Intel Core i5-1235U, **SwiftShader software rendering**, 1440 by 900 CSS pixels at device scale factor 1. A 1280 by 720 resize was also checked.

Loopback navigation was denied in this execution environment, so the same preview source was bundled as a local offline HTML fixture with esbuild and loaded from disk. This is a renderer component test, not the running BreadBit application. The standalone fixture cannot pass the plan's integrated task gate.

Verified behaviours:

1. Top-down initial camera.
2. Camera persistence through resize and an explicit host-managed remount; no edit commands for navigation.
3. Default wheel pan, modified-wheel zoom, and sidebar scroll isolation.
4. Source, intermediate bend and destination pointer workflow; overlapping candidates require explicit selection; one command.
5. Reconnection preserves the old connection until commit, retains its ID, and cancels without change.
6. Bend insertion/movement/removal and segment movement stay in a preview; one Apply and one undo restore the route.
7. No-op routes, changed revisions and rejected host commands preserve topology.
8. Part drag remains a preview until release; Escape produces no edit.
9. Click-to-place completes without holding a drag.
10. Pointer cancellation and lost capture discard the preview.
11. Window blur cancellation, keyboard movement and text-field shortcut isolation.
12. Keyboard momentary input releases on blur.
13. Context restoration keeps circuit and camera.
14. Light theme, larger targets, reduced-motion settings and scene PNG capture render.
15. Small-fixture quality profiles and zero idle frames after settling.

Reduced motion is immediate by construction: the camera has no damping or decorative transitions in either mode. This does not certify every system preference, assistive technology or platform combination. Synthetic modified-wheel events do not establish physical trackpad pinch quality.

Browser download persistence was not qualified. An attempted Playwright download was canceled by the environment; the final check instead validated the actual `capture(2)` PNG data and pixel dimensions. Host native-save and browser-download flows remain separate gates.

## Performance measurements

Main fixture: one Uno and 20 small components, with 20 cables. Forty-five requested orbit steps per quality mode, followed by ten synthetic wheel dispatches. Rendering remained demand-driven. Times are a single diagnostic run, not a statistically controlled hardware qualification.

| Quality | CPU render median / p95 ms | Orbit frame interval p95 ms | Synthetic wheel to rendered frame p95 ms | Draw calls | Triangles | Idle frames / 500 ms |
| --- | --- | --- | --- | --- | --- | --- |
| Draft | 4.2 / 8.8 | 153.1 | 149.7 | 196 | 46,276 | 0 |
| Balanced | 6.4 / 8.3 | 200.5 | 176.6 | 359 | 111,656 | 0 |
| High | 7.9 / 13.0 | 216.2 | 208.0 | 359 | 130,856 | 0 |

Each mode reported 209 geometries and 33 textures after settling. These are WebGL resource counts, not GPU memory bytes. CPU render time measures JavaScript submission to `gl.render`; it is not GPU completion time. Orbit intervals include browser scheduling and software rasterization. Synthetic wheel timing measures script dispatch to a subsequently observed render, not physical-device latency or display presentation.

The provisional 60 FPS target is **not demonstrated**. Software rendering is visibly slower than that target, even in Draft. Test representative integrated and discrete GPUs before making a performance claim. All three profiles rendered at DPR 1 on this display; high-DPI quality/performance still needs a separate check.

Non-blocking Draft diagnostics:

| Fixture | Draw calls | Triangles | Geometries / textures | One CPU submission sample ms |
| --- | --- | --- | --- | --- |
| One board + 100 parts | 864 | 209,620 | 877 / 113 | 11.4 |
| One board + 300 parts | 2,533 | 620,520 | 2,546 / 313 | 39.3 |

The larger scenes are diagnostics only. They are not a release scope expansion, FPS claim or electrical test. Resource counts indicate that model/material instancing would be the next optimization if larger scenes become a requirement.

## Reproduction and artifacts

With a complete dependency installation, start the package preview and run `node packages/circuit-renderer/tests/browser.mjs` from the repository root. `PREVIEW_URL` can select another local URL or file URL, `CHROME_PATH` selects Chromium, and `PLAYWRIGHT_MODULE` can point to an existing Playwright module. Set `SOFTWARE_RENDERING=1` to identify a SwiftShader run and `RUN_LARGE_DIAGNOSTICS=1` to include the optional 100/300-part diagnostic samples. The script writes its output under the ignored `verification/agent-a` directory.

The retained report is [agent-a-browser-report.json](agent-a-browser-report.json). Screenshots show the initial [top view](agent-a-top.png) and [light isometric view](agent-a-light.png). These are visual fixtures, not evidence of a correct or simulated circuit.

## Outstanding acceptance gates

The host needs `onCommand`, `projectRevision`, separate route persistence and current camera/shortcut UI, described in [AGENT_A_HANDOFF.md](AGENT_A_HANDOFF.md). Then run the actual Uno/button/LED construction task, named undo across views, source/import ID preservation, native storage, real compile and firmware behaviour. Run root checks again with complete dependencies and the pinned submodule. The previous repository record of 68 upstream TypeScript diagnostics is historical; it was not regenerated or represented as passing here.

Physical trackpad and mouse usability, keyboard-only host workflows, 100/150/200% display scaling, screen-reader/focus/contrast audits, representative GPUs and Windows/macOS/Linux packaged hosts remain unverified. No installer, firmware simulation pass, electrical-model qualification or general accessibility conformance is claimed.
