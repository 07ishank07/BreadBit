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

Round 3 — currently asked:
9. Default circuit-focused, circuit/code split, or remember last layout (initial split)? All panes resizable/collapsible.
10. Simple with advanced controls, beginner/expert modes, or compact expert workbench?
11. Frequent switching across all three views, mainly2D building, or mainly3D/schematic building?
12. Simplified readable components, realistic adjustable-quality components, or keep appearance and prioritize usability? Light/dark themes are offered in the first two options.

Remaining inspector question:
13. On selecting a component, prioritize properties/values, pins/connections, or observed signals?

Round 4 — accessibility, debugging and files:
14. Must every move/connection support click-to-place instead of hold-and-drag? Any modifiers/gestures to avoid? Default two-finger scroll should pan or zoom in top view?
15. Larger text/targets, reduced motion, non-color wire cues, keyboard-only interaction: which should be prominent preferences?
16. On Run, should the app compile automatically, or use separate Build/Run? Which feedback is most useful: highlighted circuit, serial, logic traces, or step-by-step guidance?
17. Save model: autosave+explicit files, explicit files+recovery, or automatic local projects? Desired unsaved/recovery behavior before the later database?
18. When a schematic change has several valid breadboard placements: choose a suggested placement, leave a clearly marked pending proposal, or switch to physical view to place manually? No silent ambiguous rewiring.
19. Typical project size and priority boards/parts after Uno starter? Decide performance fixture and symbol scope.
20. What is the minimum release you would actually use, and what can wait? Rank wiring, schematic/PDF, compiler reliability, graphics polish and future AI assistance.

Keep interviews in short rounds; do not interpret unanswered questions as approval. Existing confirmed requirements do not need reconfirmation. Settings/defaults remain proposals until selected. Physical-device testing remains required even with a cross-platform product target.
