import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = new URL('../verification/agent-a/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const software = process.env.SOFTWARE_RENDERING === '1';
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), headless: true,
  args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [], checks = [], benchmarks = [], diagnostics = [];
let ambiguousPickCount = 0;
page.on('pageerror', error => errors.push(error.message));
const check = name => { checks.push(name); console.log('PASS', name); };
const api = (method, ...args) => page.evaluate(({ method, args }) => window.rendererPreview.getHandle()[method](...args), { method, args });
const scene = () => page.evaluate(() => window.rendererPreview.getCircuit());
const count = () => page.evaluate(() => window.rendererPreview.getCommits().length);
const waitCommit = async n => { await page.waitForFunction(n => window.rendererPreview.getCommits().length === n + 1, n); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
const region = page.getByRole('region', { name: 'Interactive 3D circuit workspace' });
const point = async pin => {
  const p = await page.evaluate(pin => window.rendererPreview.projectPin(pin), pin);
  assert.ok(p, 'Pin is projected'); const box = await page.locator('canvas').boundingBox();
  return { x: box.x + p.x, y: box.y + p.y };
};
const clickPin = async (pin, label = pin.pinId) => {
  const p = await point(pin); await page.mouse.click(p.x, p.y);
  const choices = page.getByRole('group', { name: 'Overlapping targets' });
  if (await choices.isVisible()) { ambiguousPickCount++; await choices.getByRole('button', { name: `${pin.partId} / ${label} (visual)`, exact: true }).click(); }
};
const nearCamera = (a, b) => {
  for (const name of ['position', 'target', 'up']) a[name].forEach((value, i) => assert.ok(Math.abs(value - b[name][i]) < 1e-7, name));
  assert.ok(Math.abs(a.zoom - b.zoom) < 1e-7, 'zoom');
};
try {
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4173');
  await page.getByText('Renderer online', { exact: true }).waitFor({ timeout: 45000 });
  await page.waitForFunction(() => window.rendererPreview?.getStats().triangles > 0);
  const initial = await api('getCameraState');
  assert.ok(initial.position[1] - initial.target[1] > 390);
  assert.ok(Math.abs(initial.position[2] - initial.target[2]) < 0.01);
  await page.screenshot({ path: fileURLToPath(new URL('top.png', output)) });
  check('Top view is the initial camera');
  const originalCount = await count();
  await api('pan', 40, -20); await api('zoom', 1.2);
  const framed = await api('getCameraState');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(150); nearCamera(await api('getCameraState'), framed);
  await page.evaluate(() => window.rendererPreview.setMounted(false));
  await page.locator('canvas').waitFor({ state: 'detached' });
  await page.evaluate(() => window.rendererPreview.setMounted(true));
  await page.locator('canvas').waitFor(); await page.waitForTimeout(200);
  nearCamera(await api('getCameraState'), framed);
  assert.equal(await count(), originalCount);
  check('Resize and host-restored remount preserve camera without commands');
  await page.setViewportSize({ width: 1440, height: 900 });
  await api('fit');
  const beforeWheel = await api('getCameraState');
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 90); await page.mouse.wheel(30, 60);
  await page.waitForTimeout(100);
  const afterWheel = await api('getCameraState');
  assert.equal(afterWheel.zoom, beforeWheel.zoom); assert.notDeepEqual(afterWheel.target, beforeWheel.target);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -50); await page.keyboard.up('Control');
  await page.waitForTimeout(100); assert.ok((await api('getCameraState')).zoom > afterWheel.zoom);
  const beforeSidebar = await api('getCameraState');
  await page.getByRole('heading', { name: 'Graphics and navigation' }).hover(); await page.mouse.wheel(0, 80); await page.waitForTimeout(100);
  nearCamera(await api('getCameraState'), beforeSidebar);
  check('Viewport wheel pans, modified wheel zooms, sidebar wheel is isolated');
  await api('fit');
  await page.getByRole('button', { name: 'Wire', exact: true }).click();
  let n = await count();
  await clickPin({ partId: 'uno', pinId: '12' }, 'D12');
  await page.getByRole('status').filter({ hasText: 'From uno / 12' }).waitFor();
  const cb = await page.locator('canvas').boundingBox();
  await page.mouse.click(cb.x + cb.width * 0.45, cb.y + cb.height * 0.8);
  assert.equal(await count(), n);
  await clickPin({ partId: 'uno', pinId: 'A0' });
  await waitCommit(n);
  let added = (await scene()).wires.at(-1);
  assert.equal(added.waypoints.length, 1); assert.equal(added.from.pinId, '12'); assert.equal(added.to.pinId, 'A0');
  assert.ok(ambiguousPickCount > 0, 'Overlapping screen targets require an explicit choice');
  check('Source, bend and destination click flow commits exactly once');
  const retained = JSON.stringify(await scene());
  n = await count();
  await api('beginReconnect', added.id, 'to');
  assert.equal(JSON.stringify(await scene()), retained);
  await region.focus(); await page.keyboard.press('Escape');
  assert.equal(JSON.stringify(await scene()), retained); assert.equal(await count(), n);
  await api('beginReconnect', added.id, 'to'); await api('choosePin', { partId: 'uno', pinId: 'A1' });
  await waitCommit(n);
  assert.equal((await scene()).wires.at(-1).id, added.id); assert.equal((await scene()).wires.at(-1).to.pinId, 'A1');
  check('Reconnect retains old wire until commit and Escape is a no-op');
  n = await count(); const routeBefore = JSON.stringify(await scene());
  await api('beginRouteEdit', added.id); await api('insertBend', 1, [10, 25, 10]); await api('moveBend', 0, [-10, 20, 5]);
  await api('moveSegment', 1, [0, 0, 5]); await api('removeBend', 1);
  assert.equal(JSON.stringify(await scene()), routeBefore);
  await api('commitRoute'); await waitCommit(n);
  await page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
  assert.equal(JSON.stringify(await scene()), routeBefore);
  check('Bend and segment preview commits once and one undo restores the route');
  n = await count();
  await api('beginRouteEdit', added.id); await api('commitRoute');
  assert.equal(await count(), n);
  await api('beginReconnect', added.id, 'to');
  await page.evaluate(() => window.rendererPreview.replaceCircuit({ ...window.rendererPreview.getCircuit() }));
  await page.getByRole('alert').filter({ hasText: 'circuit changed' }).waitFor();
  assert.equal(await count(), n);
  await page.evaluate(() => window.rendererPreview.setRejectNext(true));
  await api('beginReconnect', added.id, 'to'); await api('choosePin', { partId: 'uno', pinId: 'A2' });
  await page.getByRole('alert').filter({ hasText: 'host rejected' }).waitFor();
  assert.equal(await count(), n); assert.equal((await scene()).wires.at(-1).to.pinId, 'A1');
  check('No-op routes, stale drafts and rejected commands leave topology unchanged');
  await api('cancelInteraction');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  let p = await point({ partId: 'uno', pinId: '8' });
  const beforeMove = (await scene()).parts.find(p => p.id === 'uno').position;
  n = await count();
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 35, p.y + 20, { steps: 6 });
  assert.deepEqual((await scene()).parts.find(p => p.id === 'uno').position, beforeMove);
  await page.mouse.up(); await waitCommit(n);
  const moved = (await scene()).parts.find(p => p.id === 'uno').position;
  assert.equal(moved[1], beforeMove[1]); assert.notDeepEqual(moved, beforeMove);
  n = await count(); p = await point({ partId: 'uno', pinId: '8' });
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 30, p.y, { steps: 3 });
  await page.keyboard.press('Escape'); await page.mouse.up(); assert.equal(await count(), n);
  assert.deepEqual((await scene()).parts.find(p => p.id === 'uno').position, moved);
  check('Part drag previews and commits once; Escape cancels without a command');
  p = await point({ partId: 'uno', pinId: '8' });
  await page.mouse.click(p.x, p.y); await page.mouse.move(p.x + 40, p.y + 20);
  assert.equal(await count(), n); await page.mouse.click(p.x + 40, p.y + 20);
  await waitCommit(n);
  check('Click-to-place does not require holding a drag');
  for (const eventName of ['pointercancel', 'lostpointercapture']) {
    n = await count(); const beforeCancel = JSON.stringify(await scene());
    p = await point({ partId: 'uno', pinId: '8' });
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 25, p.y, { steps: 3 });
    await page.locator('canvas').dispatchEvent(eventName, { pointerId: 1, bubbles: true }); await page.mouse.up();
    assert.equal(await count(), n); assert.equal(JSON.stringify(await scene()), beforeCancel);
  }
  check('Pointer cancellation and lost capture discard previews');
  n = await count(); await api('beginPlacement', 'uno'); await api('previewPlacement', [0, 0, 0]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await api('commitPlacement'); assert.equal(await count(), n);
  await region.focus(); await page.keyboard.press('ArrowRight');
  await waitCommit(n);
  await page.getByLabel('Scene selection').selectOption('wire:' + added.id);
  const cameraBeforeShortcut = await api('getCameraState');
  await page.getByLabel('Wire label').fill('proof'); await page.getByLabel('Wire label').press('f');
  nearCamera(await api('getCameraState'), cameraBeforeShortcut);
  check('Window blur cancels placement; keyboard movement works; typing does not trigger viewport shortcuts');
  await page.getByRole('button', { name: 'Interact', exact: true }).click();
  await page.getByLabel('Scene selection').selectOption('part:button'); await region.focus();
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.rendererPreview.getSnapshot().parts.button.pressed === true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.rendererPreview.getSnapshot().parts.button.pressed === false); await page.keyboard.up('Space');
  check('Keyboard momentary input is released on blur');
  const saved = await api('getCameraState'), documentBeforeLoss = JSON.stringify(await scene());
  const contextAvailable = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    window.lossExtension = extension; extension.loseContext(); return true;
  });
  if (contextAvailable) {
    await page.getByRole('status').filter({ hasText: 'Graphics context lost' }).waitFor();
    await page.waitForTimeout(150); await page.evaluate(() => window.lossExtension.restoreContext());
    await page.getByRole('status').filter({ hasText: 'Graphics context lost' }).waitFor({ state: 'detached' });
    nearCamera(await api('getCameraState'), saved); assert.equal(JSON.stringify(await scene()), documentBeforeLoss);
    check('WebGL context restoration retains project and camera');
  }
  await page.getByLabel('Porcelain theme').check(); await page.getByLabel('Larger targets').check(); await page.getByLabel('Reduced motion').check();
  await page.getByRole('button', { name: 'Isometric view', exact: true }).click();
  await page.screenshot({ path: fileURLToPath(new URL('light-isometric.png', output)) });
  // Exercise the exported scene API directly; browser/OS download permission is
  // a separate host integration check, not a prerequisite for pixel validation.
  const data = await api('capture', 2); assert.ok(data?.startsWith('data:image/png;base64,'));
  const png = Buffer.from(data.split(',')[1], 'base64'); await fs.writeFile(new URL('scene-2x.png', output), png);
  assert.ok(png.readUInt32BE(16) > 2000); check('Light theme, larger targets and PNG export render');
  await page.getByLabel('Larger targets').uncheck();
  await page.getByLabel('Benchmark fixture').selectOption('20');
  for (const quality of ['draft', 'balanced', 'high']) {
    await page.getByLabel('Rendering quality').selectOption(quality); await api('fit');
    await page.waitForTimeout(200); await page.evaluate(() => window.rendererPreview.clearSamples());
    const frameIntervals = await page.evaluate(async () => {
      const times = []; let previous = performance.now();
      for (let i = 0; i < 45; i++) {
        window.rendererPreview.getHandle().orbit(2, 0);
        await new Promise(requestAnimationFrame); const now = performance.now(); times.push(now - previous); previous = now;
      }
      return times;
    });
    await page.waitForTimeout(150);
    const samples = await page.evaluate(() => window.rendererPreview.getSamples());
    const sorted = samples.map(s => s.renderMs).sort((a, b) => a - b), intervals = frameIntervals.slice(3).sort((a, b) => a - b);
    const inputSamples = await page.evaluate(async () => {
      const values = [], canvas = document.querySelector('canvas');
      for (let i = 0; i < 10; i++) {
        const before = window.rendererPreview.getStats().renderedFrames, start = performance.now();
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: i % 2 ? -8 : 8, bubbles: true, cancelable: true }));
        while (window.rendererPreview.getStats().renderedFrames === before) await new Promise(requestAnimationFrame);
        values.push(performance.now() - start);
      }
      return values.sort((a, b) => a - b);
    });
    const idleBefore = await page.evaluate(() => window.rendererPreview.getStats().renderedFrames);
    await page.waitForTimeout(500);
    const idleAfter = await page.evaluate(() => window.rendererPreview.getStats().renderedFrames);
    assert.equal(idleAfter, idleBefore, 'No continuous rendering at rest');
    benchmarks.push({ quality, parts: 21, wires: 20, frames: samples.length,
      renderCpuMedianMs: sorted[Math.floor(sorted.length / 2)], renderCpuP95Ms: sorted[Math.floor(sorted.length * .95)],
      orbitFrameIntervalP95Ms: intervals[Math.floor(intervals.length * .95)], syntheticWheelToRenderP95Ms: inputSamples[Math.floor(inputSamples.length * .95)], idleFramesIn500ms: idleAfter - idleBefore,
      lastFrame: samples.at(-1) });
  }
  check('Small-fixture performance samples and idle rendering recorded for all quality modes');
  if (process.env.RUN_LARGE_DIAGNOSTICS === '1') {
    await page.getByLabel('Rendering quality').selectOption('draft');
    for (const count of ['100', '300']) {
      await page.getByLabel('Benchmark fixture').selectOption(count); await api('fit');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      diagnostics.push({ parts: Number(count) + 1, wires: Number(count), quality: 'draft', frame: await page.evaluate(() => window.rendererPreview.getStats()) });
    }
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { scope: 'Renderer component preview; not the integrated BreadBit task or a physical trackpad test',
    environment: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, browser: browser.version(), softwareRendering: software, viewport: '1440x900', deviceScaleFactor: 1 },
    checks, errors, contextAvailable, exportMethod: 'capture API; OS download unqualified', exportPixels: [png.readUInt32BE(16), png.readUInt32BE(20)], benchmarks, diagnostics };
  await fs.writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)) }).catch(() => {});
  console.error('Browser errors:', errors); throw error;
} finally { await browser.close(); }
