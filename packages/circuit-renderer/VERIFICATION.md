# Verification record

Verified on 20 October 2026 in Windows with Node.js, Chromium and the dependency versions recorded in `package-lock.json`.

## Build and data tests

`npm run check` passed: TypeScript checking, seven geometry and adapter tests, ESM library build and production preview build.

The tests cover stable pin IDs, transformed endpoints, movement snapping with preserved elevation, wire paths, camera bounds, Velxio ID and pose preservation, hidden seating connections, and diagnostics for unsupported parts or pins.

The renderer bundle is approximately 40 kB before compression, excluding its React and Three.js peers. The standalone preview is approximately 1.21 MB of JavaScript before compression, including those dependencies. Vite reports a preview chunk size advisory; applications can lazy load their rendering panel.

## Browser checks

`node tests/browser.mjs` passed against the running component laboratory. It exercised a real WebGL renderer using Chromium's software GPU backend in this test environment.

* Scene rendering at pixel ratio 2, with 163 draw calls and 68,288 triangles for the initial fixture.
* PNG scene export at 2648 by 1766 pixels.
* Pointer based pin selection and a new connection committed through the host callback.
* Movement preview without intermediate host commits; one commit on release.
* Grid snapping, preservation of component elevation, and Escape cancellation.
* Keyboard movement and 90 degree rotation.
* Momentary button press and release.
* Theme and label updates.
* Responsive layout at 390 pixels wide without horizontal overflow.
* Zero observed browser console errors, uncaught errors or external asset requests.

The exact browser report and screenshots are in `verification/`. The dark screenshot records the initial high quality fixture. The light and mobile screenshots record the modified fixture at draft quality after interaction checks.

## Integration still to verify

The application frame was developed separately and was not available here. Actual emulator outputs, host undo, project persistence, native save dialogs and desktop WebView compatibility require testing in that application. Model shapes and pin locations are approximate visual assets, not manufacturing CAD. These checks do not establish electrical correctness or measure performance on a physical GPU.
