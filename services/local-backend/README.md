# Local backend integration boundary

BreadBit reuses `vendor/velxio/backend`, pinned by `upstream.lock.json`. It does not copy or rewrite the compiler service. The public source is stateless and explicitly unauthenticated; it also exposes library, IoT gateway and hardware flashing routes. Binding to loopback limits network reach but is not authentication.

**The packaged desktop backend is disabled until an authenticated sidecar boundary is implemented and qualified.** The Tauri application must not automatically start this development server, silently fall back to a hosted compiler, or advertise local compilation as ready merely because Python exists.

## Explicit development setup

Use a Python virtual environment and install the pinned source's `backend/requirements.txt` deliberately. This repository does not automatically install Python, dependencies, Arduino CLI or board toolchains. Some upstream requirements are version ranges: the source pin does not make their resolved versions reproducible. A shipping sidecar needs a platform-specific resolved dependency lock and SBOM.

Example commands from the repository root, after independently installing Python:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r vendor/velxio/backend/requirements.txt
$env:BREADBIT_PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
node services/local-backend/dev.mjs --check
```

Arduino CLI and `arduino:avr` must also be deliberately installed and configured before compiling Uno projects. `--check` verifies the source revision, tracked backend modifications, interpreter and dependency presence, and CLI availability. It does not download anything, import the backend, start a server or compile firmware. It does not certify board cores or QEMU installation.

When the checks succeed, `node services/local-backend/dev.mjs --start` explicitly starts upstream Uvicorn on `127.0.0.1:8000`, with product news disabled. Stop it with Ctrl+C. Use only for local development with trusted projects. This development command does not authenticate or reduce upstream routes and is not a substitute for desktop integration. Cloud AI and hosted services are not configured by it. The checker cannot establish that a future library/compiler request will be offline; those workflows can download dependencies if explicitly used.

## Before enabling a packaged sidecar

- Issue a per-launch credential and enforce it on every HTTP and WebSocket route; verify origin/host independently of CORS.
- Expose only needed compile/health operations. Keep flash, gateway, dependency installation and optional board providers disabled until explicitly enabled and tested.
- Pass fixed process arguments, constrain project/build paths, bound output and execution time, and terminate child processes when the application closes.
- Resolve platform-specific Python dependencies, compiler/core versions and signatures. Qualify clean-machine Windows behavior before adding another OS.
- Bind compilation outputs to project revision, board, source hash and toolchain digest. Preserve error output; compilation success is not simulation success.

Runtime interfaces live in `packages/runtime-contracts`; project documents and undo/redo live in `packages/project-core`. Neither package runs a compiler or AI provider.

## Renderer connection for explicit development

The backend launcher uses 127.0.0.1:8000. In a second PowerShell terminal at the repository root, set `$env:VITE_BREADBIT_DEV_BACKEND='1'` then run `npm run dev`. This opts the development server into proxying /api to the local backend; without the flag there is no proxy. Native production builds never get this development proxy. This is an unqualified development path, not the authenticated sidecar design.
