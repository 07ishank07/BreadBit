# BreadBit project core

Pure TypeScript boundary around Velxio's serializable `.vlx` document. It contains no renderer, solver, AI provider, filesystem access, or 3D implementation.

`createProject(document, id)`, `parseProject(text)` and `serializeProject(project)` preserve the upstream document in a versioned BreadBit envelope. Upstream board IDs, file groups, rotation, libraries, SD data, wire metadata and unknown extension fields survive round trips. The current upstream runtime component shape is `id/metadataId/x/y/properties`; the older `types/components.ts` is not the runtime source of truth.

`validateVlx(document, pinCatalog?)` checks structure, unique IDs, file group references, board selection, and wire endpoint references. When a qualified catalog is supplied it checks exact pin names too. Unknown catalog entries produce warnings for import preservation; AI edits reject them. This is structural validation, not electrical rule checking or simulation accuracy certification.

`new ProjectHistory(project, catalog?)` exposes cloned `snapshot`, `canUndo`, `canRedo`, `apply(transaction)`, `undo()` and `redo()`. Transactions use an expected revision and commit a validated final document in one undo entry. Removing a connected part requires removing its wires in the same transaction. Undo/redo advance revisions, so old evidence/proposals remain stale. History is in memory, bounded to 100 entries; it is not a recovery journal.

`validateProposal(project, untrustedProposal, catalog)` previews only allowlisted operations without changing the live project. The host must present the diff and apply against the current revision separately. No tool executes arbitrary shell commands. Catalog input must come from a trusted, qualified runtime adapter, not from the AI provider. Evidence run IDs in a proposal are references, not trusted proof; the host must resolve them against its run ledger.

`classifyEdit(operation)` conservatively requires restart for connectivity and component movement (seated movement may rewire breadboard connections), and recompilation for firmware or full-document replacement. Camera/selection operations are view state outside this document. `evidenceStatus` distinguishes a compile result from a simulation assertion result and marks evidence from another project/revision stale. Evidence must be supplied by the trusted runtime adapter; no simulation runs in this package.

Limitations: no canonical breadboard-net extraction yet, no property range/ERC rules, no simulation checkpoint restoration, no upstream store synchronization adapter, no generated schematics, and no arbitrary provider tools. File names are preserved as document data; a future disk exporter must independently enforce project-root containment.
