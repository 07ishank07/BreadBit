# Runtime contracts

This package defines a boundary for adapting Velxio execution to BreadBit project identities. It is not an emulator, compiler, AI agent or claim that every upstream board is qualified.

- `FirmwareArtifact` identifies exact source/toolchain/board output and project revision.
- `SimulationSession` identifies a run, engine version and artifact. `sessionMatchesArtifact` rejects revision, board or artifact mismatch; callers must also compare with the current project revision when deciding whether observations are stale.
- `EngineCapability` distinguishes available, unavailable and unqualified engines. Only an adapter with actual validation evidence may report `available`.
- `updatePolicy` allows view changes without runtime changes, gates live input/parameter updates on explicit capability names and conservatively restarts or recompiles other changes.
- `RuntimeAdapter` is an interface only. There is no fabricated default adapter. A concrete adapter must validate payloads, reject unsupported input values, constrain lifetimes and surface real observations.

These DTOs intentionally use string IDs to avoid coupling to a second circuit model. `packages/project-core` owns the durable project document and its conservative edit classifier. Integration code maps accepted document edits to runtime changes; this package's policy is not automatically wired into the upstream simulation store in the foundation pass.

Hash fields must be generated from actual bytes by implementations; these interfaces do not compute or verify cryptographic digests. The tests use synthetic identity fixtures to exercise mismatch rejection, not to assert real compilation or simulation success.
