# BreadBit desktop host

BreadBit owns this Tauri 2 shell. It does not reuse Velxio's closed desktop shell, licensing handshake, authentication endpoints, or private toolchain manager. The pinned public Velxio code is an upstream integration source.

## Implemented frame

- Vite renderer on port 1420; production assets in `apps/desktop/dist`.
- Native open / save / save-as dialogs for JSON project documents.
- Native-issued project handles: JavaScript cannot supply an arbitrary filesystem path.
- SHA-256 revision checking, serialized in-process saves, previous-content `.bak` file, synced temporary writes in the destination directory and atomic replacement.
- 16 MiB file limit and JSON-object validation before a save. Domain schema validation remains the shared model's responsibility.
- Restrictive production CSP, local main-window capability, no renderer shell/filesystem grant.
- Explicit unavailable status for unbundled backend and QEMU. No process is launched and no remote compile request is silently substituted.

Save As currently requires a new filename. Save updates only an opened file with the expected revision. If another application changed or removed it, the operation returns a `CONFLICT:` error; the UI should offer reopen or Save As. A cancelled dialog returns null and leaves the document unchanged. The `.bak` is one generation, not a full recovery journal. External conflict checking is optimistic, not an OS-wide transactional lock; a competing writer can race the final check. Parent directory fsync / power-loss durability and multi-process locking require further qualification.

## Invoke contract

All command names are snake case, and JavaScript arguments use camel case (Tauri's default mapping).

```ts
type NativeProject = {
  handle: string; // ephemeral token, valid only in the current app process
  path: string; // display-only; never accepted back as a command argument
  content: string; // JSON document
  revision: string; // SHA-256 of exact UTF-8 bytes
};
invoke<NativeProject | null>('open_project');
invoke<NativeProject | null>('save_project_as', { content });
invoke<NativeProject>('save_project', { handle, content, expectedRevision });
invoke<void>('close_project', { handle });
invoke('runtime_status');
```

`runtime_status` returns `{ platform, version, projectStorage: 'native-dialog', backend: { state: 'not-configured', message }, capabilities: { localCompilation: false, qemu: false } }`. A UI must not infer runtime readiness from a configured filename, successful build of the renderer, or this status call alone. There is deliberately no renderer-configurable executable path or arbitrary command runner.

## Development prerequisites and verification

Install Node for the frontend and stable Rust/Cargo (Rust >= 1.90), plus the [Tauri native prerequisites](https://v2.tauri.app/start/prerequisites/). Windows needs the C++ build tools and WebView2; other platforms have their own prerequisites. Run the workspace's desktop dev script from the repository root. The Tauri before-dev/build commands execute in `apps/desktop` and use `npm --prefix ../..` to call root scripts. Development binds to `127.0.0.1:1420`.

Run `npm run doctor` to probe Node, Git, repository revision, frontend assets, Rust, Cargo, Python, and Arduino CLI. Use `npm run doctor -- --strict` for a nonzero exit when a required probed prerequisite is missing. Native SDK/WebView installation still needs manual qualification; presence of command-line tools is not proof of runtime readiness.

Run native tests with `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`. They cover backup preservation, external edits, deleted originals, accidental overwrites, invalid JSON and oversize content. Run the native app separately to qualify dialog cancellation, opening and saving Unicode paths, write-denied folders, recovery, and WebView behavior. The initial environment did not expose `cargo` or `rustc` on PATH, so this frame has not been compiled or packaged here. Dependency resolution must produce and commit Cargo.lock before release.

Installers are disabled (`bundle.active: false`) until the runtime, licensing notices, icons, signatures, clean-machine installation and shutdown tests are qualified. This is a development frame, not a released installer. Existing-file replacement uses tempfile's atomic persist contract; new files use its no-clobber persist, which does not overwrite an existing destination but is not guaranteed atomic on every filesystem. The Rust tests must be executed on Windows to qualify its filesystem behavior.

## Native backend packaging gate

The public backend is not yet a managed desktop pack. The integration service can be exercised independently during development; do not imply that this shell starts or bundles it. Before enabling `backend_start`:

1. Package a known Python/FastAPI build for each OS/architecture, with a manifest pinning executable hash, upstream revision, toolchain versions, and licenses. Paths come from the trusted resource directory, never renderer arguments.
2. Start only that allowlisted executable using an argument array. Bind to loopback on an OS-selected port; use a per-launch random token and Host/Origin checks for HTTP and WebSocket. Keep credentials in native state; never persist tokens in project files.
3. Require authenticated health readiness with protocol/capability negotiation. Model `unavailable -> starting -> ready -> stopping -> stopped` and `starting/ready -> failed`; capture bounded stderr and give actionable failure messages.
4. Own and kill the complete compiler/QEMU process tree on app exit and startup failure. On Windows use a job object; test abrupt close and crashes. Never rely only on killing the Python parent.
5. Route approved compile and runtime requests through a narrow native transport or tightly scoped authenticated connection. Expand CSP only for the qualified endpoint; do not permit arbitrary hosts or renderer shell access.
6. Validate Uno native compilation and cached offline use before adding QEMU. A Linux shared library from Docker is not a Windows runtime pack.

No 3D renderer, geometry assets, or 3D runtime is part of this frame.

References: [Tauri dialogs](https://v2.tauri.app/plugin/dialog/), [Tauri sidecars](https://v2.tauri.app/develop/sidecar/), [Tauri CSP](https://v2.tauri.app/security/csp/), [tempfile atomic persist semantics](https://docs.rs/tempfile/latest/tempfile/struct.NamedTempFile.html#method.persist), [Velxio desktop source documentation](https://github.com/davidmonterocrespo24/velxio/blob/master/docs/desktop-app.md).
