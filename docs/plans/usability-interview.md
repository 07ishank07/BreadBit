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
8. Yes to the described American-style symbols, junction dots, net labels and orthogonal wires. The compound yes does not select A4 vs Letter or portrait vs landscape. Offer both; proposed default A4 landscape, values/title block on and parts list optional, pending preference.

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

Final round — currently asked:
17. Inspector priority: properties/values, pins/connections, or observed signals? Which simulation feedback is most useful: circuit highlights, serial, logic traces, or guided explanations?
18. Accessibility preferences: larger text/targets, reduced motion, non-color wire cues, keyboard-only operation, click-to-place alternatives to dragging. Treat baseline focus/contrast/cancellation as engineering requirements regardless of optional preferences.
19. Typical project size and priority boards/parts after Uno starter? This defines performance fixtures and symbol scope.
20. PDF defaults: confirm or override proposed A4 landscape, title block and component values, optional parts list. Offer A4/Letter and both orientations regardless of default.

Keep interviews in short rounds; do not interpret unanswered questions as approval. Existing confirmed requirements do not need reconfirmation. Settings/defaults remain proposals until selected. Physical-device testing remains required even with a cross-platform product target.
