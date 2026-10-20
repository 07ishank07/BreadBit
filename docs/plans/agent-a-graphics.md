# Agent A — graphics and spatial interaction

Read trackpad-3d-ux.md and usability-interview.md first; they are the authoritative plan and user decision record. Use docs/aas/usability/aas-stack.json: 3d-web-experience, threejs-interaction and javascript-testing-patterns. Read the selected skill instructions/references before executing them; the manifest is not installation or proof of quality.

Own packages/circuit-renderer/src/**, renderer tests/preview and API documentation. Do not edit apps/desktop/src, vendor, project-core or dependency manifests without coordinating with the integrator.

Start with the agreed NavigationPreferences, CameraState, selection, interaction, wire-route and command callback contracts. Coordinate the types with Agent B before parallel edits.

Deliver in order:
1. Top-down default and explicit pan/orbit; configurable two-finger scrolling defaulting to pan. Mouse/keyboard equivalents and visible-control APIs, no required middle/right-click.
2. Screen-space pin/wire targets, unambiguous candidate picking, click-source/optional-bends/destination wiring, endpoint reconnection and bend/segment editing. Escape cancels; preview never mutates topology; one validated commit per action.
3. Preserve camera through resize/view switching; scope shortcuts and release gestures on blur/cancel; click-to-place and keyboard alternatives.
4. Realistic models, adjustable quality, light/dark readability, larger-target support, non-color selection/wire cues and reduced motion. Keep electrical IDs independent of mesh geometry.
5. Benchmark small one-board circuits (working assumption10–30parts), context-loss recovery and screenshot export. Larger fixtures are diagnostics.

Wire color/label UI is host-owned; renderer consumes style/label state and preserves IDs. Parent validates real pins, reconnection and electrical edits. Renderer must never infer nets from crossing cables or arbitrary geometry.

Gate: actual BreadBit task passes on trackpad+keyboard and mouse+keyboard; synthetic gestures alone do not establish physical-trackpad usability. Include cancellation, overlapping pins, no camera history entries and one undo per completed edit. Report untested native/OS cases. Deliver tests, measured results and API migration notes to the integrator.
