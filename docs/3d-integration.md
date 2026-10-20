# Integrated 3D workbench

The contributed MIT renderer from origin/main (88c2806) is merged into the AGPL BreadBit foundation branch. Its procedural meshes, camera controls, snapping, wire rendering and image capture are reused. Vendor Velxio is unchanged.

## Added integration

- Switch between 2D and lazily loaded 3D views of the same boards, components and wires. Hidden 2D elements remain mounted to retain simulation subscriptions; switching views does not reset the simulation.
- Move parts and boards in 3D; component rotations are translated to Velxio properties.rotation. Changes persist through the normal project envelope, export and recovery.
- Connect exact host pin IDs in Wire mode. Reject self-wiring, duplicate connections and pins absent from the real component. This is structural validation, not an electrical safety proof.
- Delete a selected component with its attached wires, or delete one selected wire. Board removal stays in 2D to preserve firmware group lifecycle.
- Discrete 3D edits flush the project history before and after the operation. Undo restores design state and resets runtime; it cannot rewind firmware execution. Circuit editing stops all running boards.
- LED brightness, servo angle and input values are sampled from mounted Velxio elements at 12.5 Hz. Button and potentiometer actions dispatch the same input events as 2D. This bridge still needs compiled-firmware scenario qualification.
- Camera presets, grid/label toggles, fit-to-circuit and PNG scene export expose the renderer's controls.

## Keyboard controls

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+Z | Whole-project undo outside text fields |
| Ctrl/Cmd+Shift+Z or Ctrl+Y | Redo outside text fields |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+Shift+S | Save as |
| Ctrl/Cmd+O | Open project |
| F / 1 / 2 / 3 in the focused 3D viewport | Fit / isometric / top / front |
| R / arrows in Move mode | Rotate selected part / nudge; Shift increases nudge |
| Delete / Backspace in 3D | Delete selected part or wire |
| Escape in 3D | Cancel pending interaction and clear selection |

Monaco retains its own text undo/redo. Hidden 2D canvas handlers do not receive 3D selection shortcuts.

## Limits

The 0.2 mm/pixel layout conversion is approximate, not manufacturing geometry. Breadboard visual hole IDs are not automatically mapped to Velxio IDs. Unmapped cables are omitted from the 3D picture and reported in Model limits; source topology is retained. Component placement and seating still follow the 2D host. Add components and manage boards in 2D. Unknown components use placeholders. OLED pixel frames, electrical probes, mechanically accurate seating and custom wire paths are not mirrored. Selection/camera are view-local; electrical IDs and design history are shared.

The renderer is a separate lazy chunk (about 980 kB uncompressed / 266 kB gzip in the first integration build). A single root React/Three installation is enforced by Vite deduplication. npm test runs application Vitest suites and the contributed node:test geometry suite separately.

Native Tauri/WebView2 execution and compiled firmware remain unqualified in this environment (Rust and compiler packs are absent). No AI provider was added in this change.
