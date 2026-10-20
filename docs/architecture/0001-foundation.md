# ADR 0001: Keep the BreadBit shell and domain boundaries around pinned Velxio

Status: accepted for the development foundation; native runtime and board qualification remain pending.

## Context

The Velxio desktop plan calls for a local electronics development application with synchronized physical and schematic views, firmware, simulation and structured AI operations. The current user instruction explicitly defers all 3D work. Public Velxio provides useful React editing, component and emulator code, but its documented private desktop product and hosted agent are not assumed to be present.

## Decision

Pin the public Velxio Git submodule and record its revision in `upstream.lock.json`. Reuse its existing 2D workbench behind BreadBit's desktop composition and adapters. Keep durable project documents, validation and transaction history in `packages/project-core`. Add narrow session, artifact and capability DTOs in `packages/runtime-contracts`; these hold references to project identities rather than a second circuit model. The Rust/Tauri shell supplies the native boundary; it does not silently launch an unauthenticated upstream backend.

UI-only changes never restart a running engine. Qualified runtime input events may be live; unknown inputs are unsupported. Topology and unqualified parameter changes require restart. Firmware, board and toolchain changes require recompilation. The foundational project edit classifier remains conservative; adapter-specific runtime policy is only used when the adapter has qualified capabilities.

AI changes must use validated project transactions. The contract can report unavailable integrations; it must never manufacture a compiled artifact, simulation observation or AI answer. An artifact belongs to a specific project revision, board and toolchain, and a run additionally identifies the engine/version. Trace verification and richer instrumentation remain implementation work.

The current implementation contains no 3D renderer, assets, dependency, controls or placeholder 3D mode. Stable component/pin identities make future views possible without implementing those views now.

## Alternatives and consequences

- A complete frontend rewrite would increase integration risk and duplicate Velxio behavior. Reuse preserves working paths, but upstream React state and simulation coupling must be audited before projecting it into new views.
- Editing the vendor source directly would be quick but obscure upstream maintenance. Prefer adapters and small explicit integration points; record any unavoidable patches separately.
- Automatically starting the OSS backend would make compilation appear ready but introduces unauthenticated native process/hardware endpoints. Keep packaged sidecar integration disabled, provide an explicit development checker/start command, and qualify authentication before shipping.
- A shared runtime/project mega-store would simplify initial plumbing but mix reproducible document edits with high-frequency observations. Separate them and bind evidence through identities.

## Verification and revisit triggers

Exercise project import/export, invalid transaction rejection, history restoration and stale artifact rejection. Check the pinned vendor tree during upgrades. Require actual firmware compile/run evidence before claiming board support. Qualify native signing, clean-machine startup, process cleanup and authenticated sidecar transport before distribution. Revisit view projection boundaries when schematic editing is integrated; revisit runtime capabilities when a second board family is qualified.
