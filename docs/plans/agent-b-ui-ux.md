# Agent B — UI/UX and schematic presentation

Read trackpad-3d-ux.md and usability-interview.md first. Use docs/aas/usability/aas-stack.json: frontend-design, accessibility-compliance-accessibility-audit and javascript-testing-patterns. Read skills before applying them; no claim of accessibility conformance without scoped manual and automated checks.

Own apps/desktop/src/App.tsx, styles, features/Circuit3D.tsx host UI, new workspace/schematic/preferences components and UI tests. Coordinate project.ts, core models, persistence services, package changes and shared types with the parent. Do not edit renderer internals or vendor independently.

Deliver in order:
1. Circuit-focused shell, Code/inspector on demand, resizable/collapsible panes with keyboard alternative. Simple default and advanced controls available; no forced expert mode. Pins/connections/explanations lead the inspector, properties alongside.
2. Consistent wire workflow in2D/3D: connect, reconnect, move bends/segments, delete, color/label. Click source, optional bends, destination; Escape cancels. Keyboard pin picker and non-drag alternatives. Parent owns atomic commands and named undo/redo.
3. Physical2D/Schematic building paths and3D inspection path; editing remains available in all3views. Shared selection and warnings, no duplicate electrical graph.
4. Schematic editor and vector PDF after parent qualifies net resolution. First release MUST support electrical edits in all3views, not just schematic viewing. Preview suggested physical placements and require selection before any ambiguous edit commits. Route-only changes stay view-local.
5. A4-landscape PDF default with title block/values, optional parts list, Letter/portrait options. Verify text/line readability, clipping, revision and unresolved warnings.
6. Automatic local project saving/list/reopen/export with truthful pending/success/failure states. Coordinate the parent-owned durable storage adapter; deferred backend/user database stays out of scope.
7. Separate Build and Run; no auto-build on Run, no stale binary fallback. Parent supplies readiness/fingerprint logic. Explicit failure and rebuild guidance.
8. Light/dark themes, larger text/targets, reduced motion, non-color wire cues, keyboard-only controls and click-to-place alternatives. Small-circuit usability first; no requested additional board family beyond Uno starter.

Gates: small starter task, wire reconnection/bend editing, atomic undo across views, canceled placement unchanged, autosave/reopen/export, stale Build rejection, correct PDF defaults, keyboard/focus/zoom checks in both themes. Native storage and actual firmware simulation require their own execution evidence. A rendered screen is not a passed circuit simulation.
