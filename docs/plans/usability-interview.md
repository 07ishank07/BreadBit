# Usability interview

Confirmed answers, round 1:
1. Target all desktop/laptop users, not one personal machine.
2. Primary pain: editing wires in physical2D and3D. Add LTspice-style IEEE-convention schematic with synchronization and PDF. Database later.
3. Top-down default with explicit Orbit/Pan.
4. Acceptance circuit: build and simulate Uno + button + LED.

Confirmed answers, round 2:
5. All five are important: connect pins; reconnect existing wire end; move bends/segments; delete wires; change color/label. No specific failure reproduction supplied yet; do not require one to improve these known workflows.
6. Click source, click optional bends, click destination; Escape cancels.
7. First version must support electrical editing in all three views, with review when physical placement is ambiguous. Layout-only schematic is an intermediate milestone, not a scope reduction.
8. Yes to the described American-style symbols, junction dots, net labels and orthogonal wires. The compound yes does not select A4 vs Letter or portrait vs landscape. This was resolved in answer20: A4 landscape, title block and values included, optional parts list.

Confirmed answers, round 3:
9. Circuit-focused default; Code and inspector available when needed. Panes still resizable/collapsible.
10. Simple default with advanced controls available. No separate mandatory beginner/expert modes requested.
11. Build mainly in schematic or physical 2D according to experience level, then view in 3D. The earlier requirement for electrical editing in all three views still stands.
12. Realistic components, adjustable graphics quality, and light/dark themes.

Confirmed answers, round 4:
13. Two-finger scrolling is user-configurable; default to pan. Explicit Pan/Orbit/zoom controls stay available.
14. Always require Build first, then Run. Never auto-compile on Run. Show artifact freshness and rebuild requirements.
15. Automatically save local projects, with export to files. Requires a real multi-project local persistence flow, not only the current recovery draft. Backend user/project database remains later work.
16. Preview suggested physical placements and choose one before applying an ambiguous schematic edit. No partial electrical commit while the choice is pending; cancel leaves the committed project unchanged.

Confirmed answers, final round:
17. Inspector shows pins/connections and explanations first, with properties alongside them. No separate preference for a simulation instrument was specified.
18. All listed usability options: larger text/click targets, reduced motion, wire labels/patterns beyond color, keyboard-only controls, click-to-place instead of holding a drag.
19. Smaller projects. Engineering working fixture: one board and about10–30 parts; this number is a proposal, not an explicit user requirement. No additional board family specified.
20. Confirmed A4 landscape, title block and component values included, parts list optional. Also offer Letter and portrait settings.

Interview complete. Confirmed decisions are requirements in trackpad-3d-ux.md; remaining engineering assumptions are labeled. No further preference round is required. Physical-device testing remains necessary even with a cross-platform target. The interview completion finalizes planning; it does not claim the planned features are already implemented.
