# Accounts and cloud projects

This branch implements the desktop account and project storage feature in isolated modules. It is disabled by default until its hosted and native release gates pass. The current renderer work and pinned Velxio revision are unchanged.

## Behaviour

Users sign in through Sites' existing ChatGPT browser flow. The desktop displays a matching approval code. After explicit browser approval, a scoped device credential authorizes project operations. There is no separate password database or custom OAuth callback. The application never embeds a Sites service bypass credential.

The desktop stages each observed edit in account scoped IndexedDB before attempting a cloud save. Manual Save uses the same queue. A remembered account can work with cached projects offline after restarting, but must sign in again before synchronising. Device credentials remain in native process memory, or browser preview memory, and are not written to localStorage, IndexedDB or project files. Closing the application ends the local authenticated session. Persisting credentials in an OS credential store is a later improvement.

The service stores one current project document for each owner and project ID. Conditional writes compare an opaque cloud version independently of the document's revision and UI coordinates. A repeated mutation ID recovers an acknowledged save whose response was lost. A conflict retains both the local document and the received cloud document until the user reviews them and chooses one. Further cloud changes can produce another conflict; there is no automatic overwrite or semantic merge.

Guests can edit. With accounts enabled, BreadBit's Save, Save as and Velxio export actions require an account. Guest edits do not enter the persistent recovery queue. This is a product workflow restriction, not DRM against someone inspecting their local application. Inherited Velxio menus still require a complete UI audit with the pinned source populated.

Published links are anonymous, read only snapshots. Updating a private project does not change its published snapshot. Publishing again updates the existing link; revoking removes it. Firmware source is included only by explicit choice. Unknown extension fields, binaries, board options, SPIFFS payloads and runtime data never enter a public snapshot. The public viewer displays a simplified circuit diagram, exact explicit endpoint connections and optional source. It does not run firmware or claim to resolve breadboard buses or electrical behaviour.

Prototype limits are 1 MiB per private project and 200 projects per account. These are application limits, not claims about free hosting allowances. No paid service was provisioned and no hosting quota has been confirmed.

## Module boundaries

| Path | Responsibility |
| --- | --- |
| `packages/cloud-projects/src/protocol.ts` | Portable contracts, bounded validation and public projection |
| `packages/cloud-projects/src/sync.ts` | Account scoped draft queue, retries and conflict decisions |
| `packages/cloud-projects/src/server.ts` | Database operations, ownership checks and device grants |
| `apps/desktop/src/features/cloud/` | Account panel, IndexedDB and frontend integration |
| `apps/desktop/src-tauri/src/cloud.rs` | Fixed origin transport, memory credentials and restricted browser opening |
| `services/project-cloud/` | Sites browser approval, public viewer, database schema and retained build integration |

The root npm lockfile, project document format, renderer package, runtime contracts and vendor source are unchanged. App integration consists of imports, the account tab, save guards and a recovery switch. A small project rename method preserves normal edit history. Root package scripts only add dedicated cloud checks and a cloud build command.

## Enable locally

Keep the whole repository checkout together: the hosted service imports the shared packages using relative paths. Use Node 24 for the independent SQLite contract tests.

```powershell
git submodule update --init vendor/velxio
npm ci
npm ci --prefix services/project-cloud
npm run test:cloud
npm run typecheck:cloud
```

The service retains the Sites Vinext starter, including its supported local mock ChatGPT identity on loopback. Mock identity is development only. Follow the retained service README for execution profile setup and local D1 migration commands. The initial SQL and metadata are checked in; run `npm run db:generate` within the service and review any differences before first deployment. Do not replay an applied schema migration.

Copy the account settings from the root `.env.example` into `apps/desktop/.env.local`, or set them in the process environment. Vite's project root is `apps/desktop`, so a root `.env` alone does not configure the app.

```text
VITE_BREADBIT_ACCOUNTS=1
VITE_BREADBIT_CLOUD_URL=https://YOUR_ACTUAL_SITE_ORIGIN
```

For a native build, also set `BREADBIT_CLOUD_URL` in the Cargo build environment to the same origin. This is a compile time setting; no renderer supplied host or arbitrary HTTP headers are accepted. HTTPS is required in release builds. Loopback HTTP is accepted only by debug builds and browser development previews.

The native bridge follows no redirects. It exposes only the project API, device login and validated share or connection pages on the configured origin. It does not broaden renderer CSP, filesystem access or shell permissions. The browser preview allows explicit loopback CORS origins on port 1420 and does not send browser cookies to the project API.

## Sites publication

Build and publish from the repository root to retain shared package source. Use the Sites workflow to register the project once, persist its returned ID in root `.openai/hosting.json`, and set `d1` to `DB`, `r2` to `null`, without a `static` field. Never invent a project ID. `npm run build:cloud` copies that identity into the service manifest, builds the service with its retained Sites integration and copies its artifact to root `dist`.

The Site must permit public requests for anonymous viewing and native device requests. Private project routes still enforce application device grants and owner checks. Changing the Site audience and configuring the desktop origin belong to deployment, not merely merging this branch. The source currently contains no Site ID or live deployment URL.

Use the existing Sites source and deployment helpers to push the exact source, package the cloud artifact and deploy a saved version. Do not deploy the root desktop Vite output as the cloud service. Check migrations before deployment; the Sites workflow applies them before uploading the Worker.

## Verification on 20 October 2026

The independent suite exercises the real cloud TypeScript and SQL using Node's SQLite runtime. It covers device approval, expiry and rate limits, credential revocation, owner isolation, idempotency, concurrent writers, fixed and revoked snapshots, firmware omission, offline drafts, conflict resolution and edits during an in flight save. The schema fixture also checks the initial metadata against SQLite. These are storage and authorization checks, not a passed circuit simulation.

TypeScript and TSX parsing was checked using the available esbuild installation. Parsing is not typechecking.

The required `npm test`, `npm run typecheck` and `npm run build` commands were attempted. The first two cannot start because Vitest and TypeScript are not installed. The app build stops because the pinned Velxio submodule is not populated in the supplied checkout. No upstream TypeScript diagnostic count can be established in this environment.

Dependency installation encountered filesystem permission errors; a retry with serial directory preparation could not finish with restricted network access. Service build and Drizzle generation also remain blocked by unavailable dependencies. Initial migration SQL and metadata were prepared and checked against SQLite; they have not been generated or confirmed by an executed Drizzle command here.

Cargo is unavailable. Native Rust compilation, WebView2 behaviour, OS browser launch, hosted dispatch identity, actual D1 execution and the complete desktop sign in flow remain unverified. No Site was registered or deployed because the service build and authentication release gates have not passed. The feature flag remains off.

## Merge handoff

The original checkout has read only Git metadata and contains unrelated renderer edits. A separate checkout was created from a local Git bundle at base commit `43bceece6f7580e75351f5325f98643baaa951aa`, with branch `feature/accounts-cloud-projects`. Its commit is exported as a bundle so the original repository can import it without copying source over current work.

After the original repository permits Git writes:

```powershell
git fetch C:/School/BreadBit/handoff/accounts-cloud-projects.bundle feature/accounts-cloud-projects:feature/accounts-cloud-projects
git log --oneline main..feature/accounts-cloud-projects
```

Review or merge that branch after saving the other work. Retain the existing App structure if resolving concurrent app changes: mount the cloud hook once, add the account panel and route the save actions through its guard. Keep the renderer and chatbot changes independent. The separate cloud CI workflow installs its own dependencies and verifies contracts, types and build.
