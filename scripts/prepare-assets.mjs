import { cp, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'vendor/velxio/frontend/public');
const target = resolve(root, 'apps/desktop/public');
await access(resolve(source, 'components-metadata.json')).catch(() => { throw new Error('Missing pinned Velxio source. Run git submodule update --init vendor/velxio.'); });
await mkdir(target, { recursive: true });
for (const name of ['boards', 'bus-chips', 'component-svgs', 'components', 'firmware', 'fonts', 'wasm', 'components-metadata.json']) {
  await cp(resolve(source, name), resolve(target, name), { recursive: true });
}
await cp(resolve(root, 'node_modules/monaco-editor/min/vs'), resolve(target, 'monaco/vs'), { recursive: true });
console.log('Local component, simulation and Monaco assets prepared.');
