# Usability interview

Confirmed answers, round 1:
1. Target all desktop/laptop users, not one personal machine.
2. Primary pain: editing wires in physical2D and3D. Add LTspice-style IEEE-convention schematic with synchronization and PDF. Database later.
3. Top-down default with explicit Orbit/Pan.
4. Acceptance circuit: build and simulate Uno + button + LED.

Round 2 — currently asked:
5. Prioritize four wire edits: creation, endpoint reconnection, bends/segments, deletion, color/labels, overlapping-wire selection, complete net highlight, automatic routing. What specifically fails now?
6. Click source/bends/destination, auto-route then edit, or simple/advanced modes?
7. First schematic release: editable electrical intent in all views with ambiguity review, or generated layout-editable schematic/PDF before electrical editing?
8. Confirm American-style symbols/node dots/net labels/orthogonal wires; PDF page size, orientation, title block, values and parts list.

Round 3 — workspace and learning:
9. Default Circuit / Code / Split / remember last layout? Which panes must stay visible?
10. Beginner guided controls, compact expert workbench, or switchable modes?
11. Which physical view is primary:2D build then3D inspect, mainly3D building, or frequent switching?
12. Component inspector priority: properties/values, pins/connections, or observed signals?
13. Preferred visual direction: simplified readable electronics, realistic models, or adjustable quality? Keep current dark green theme, light theme, or both?

Round 4 — accessibility, debugging and files:
14. Must every move/connection support click-to-place instead of hold-and-drag? Any modifiers/gestures to avoid? Default two-finger scroll should pan or zoom in top view?
15. Larger text/targets, reduced motion, non-color wire cues, keyboard-only interaction: which should be prominent preferences?
16. On Run, should the app compile automatically, or use separate Build/Run? Which feedback is most useful: highlighted circuit, serial, logic traces, or step-by-step guidance?
17. Save model: autosave+explicit files, explicit files+recovery, or automatic local projects? Desired unsaved/recovery behavior before the later database?
18. When a schematic change has several valid breadboard placements: choose a suggested placement, leave a clearly marked pending proposal, or switch to physical view to place manually? No silent ambiguous rewiring.
19. Typical project size and priority boards/parts after Uno starter? Decide performance fixture and symbol scope.
20. What is the minimum release you would actually use, and what can wait? Rank wiring, schematic/PDF, compiler reliability, graphics polish and future AI assistance.

Keep interviews in short rounds; do not interpret unanswered questions as approval. Existing confirmed requirements do not need reconfirmation. Settings/defaults remain proposals until selected. Physical-device testing remains required even with a cross-platform product target.
