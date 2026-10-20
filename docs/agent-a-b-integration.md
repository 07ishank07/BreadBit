# Combined Agent A / B integration

Agent B workbench and schematic editing are combined with `agent-a-renderer` (9cc7de7).

The desktop host now consumes renderer commands rather than legacy edit callbacks. It flushes queued edits before checking project revisions, validates real host pins, rejects duplicate connections and invalid routes, and deduplicates successful gesture IDs. Completed gestures enter shared undo history. 3D bends use `route3d` metadata separately from physical 2D and schematic routes. Route edits do not stop simulation, though undo/redo conservatively reloads non-schematic changes. Electrical and component edits stop simulation.

Camera state is local per project, outside electrical history. Scrolling defaults to pan with a selectable zoom preference; explicit navigation controls remain visible. Larger targets and reduced motion use workbench preferences. Renderer net selection is not currently surfaced by the host.

Validation: 39 application/core tests and 14 renderer tests pass (53 total). BreadBit TypeScript checks pass; the pinned upstream still has 61 diagnostics. Production build passes with existing locale import and large chunk warnings. This integration has not qualified physical trackpad hardware, native packaging, real compiler execution, or end-to-end firmware simulation. Agent A's standalone browser verification is documented separately in its handoff.
