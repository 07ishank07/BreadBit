import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootArgument = process.argv.indexOf('--root');
const root = rootArgument >= 0 ? resolve(process.argv[rootArgument + 1] ?? '.') : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const results = [];
function report(name, ok, detail, required = true) {
  results.push({ name, ok, detail, required });
  console.log(`${ok ? 'OK  ' : required ? 'MISS' : 'NOTE'} ${name}: ${detail}`);
}
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000, shell: false });
  return { ok: result.status === 0 && !result.error, text: (result.stdout || result.stderr || result.error?.message || '').trim() };
}
function tool(name, executable, args, required = true) {
  const found = run(executable, args);
  report(name, found.ok, found.ok ? found.text.split(/\r?\n/)[0] : `not available on PATH (${executable})`, required);
  return found;
}

console.log(`BreadBit environment doctor — ${root}\n`);
report('Node', Number(process.versions.node.split('.')[0]) >= 22, `${process.version} (${process.execPath}); requires >=22`);
const git = tool('Git', 'git', ['--version']);
if (git.ok) {
  const checkout = run('git', ['rev-parse', '--show-toplevel']);
  report('Repository', checkout.ok && resolve(checkout.text).toLowerCase() === root.toLowerCase(), checkout.ok ? checkout.text : 'not a Git checkout');
  const upstream = run('git', ['-C', 'vendor/velxio', 'rev-parse', 'HEAD']);
  let expected;
  try {
    const lock = JSON.parse(readFileSync(resolve(root, 'upstream.lock.json'), 'utf8'));
    expected = lock.commit ?? lock.revision ?? lock.upstream?.commit;
  } catch { /* Report missing/unreadable pin below instead of inventing one. */ }
  report('Velxio source', upstream.ok && existsSync(resolve(root, 'vendor/velxio/frontend/package.json')), upstream.ok ? upstream.text : `${upstream.text}; check folder access, then git submodule update --init --recursive if uninitialized`);
  report('Velxio revision', Boolean(expected) && upstream.text === expected, expected ? `actual ${upstream.text}; pinned ${expected}` : 'no recognized commit pin in upstream.lock.json');
}
report('Frontend dependencies', existsSync(resolve(root, 'node_modules/vite/package.json')), 'run npm install if missing');
report('Local runtime assets', existsSync(resolve(root, 'apps/desktop/public/components-metadata.json')) && existsSync(resolve(root, 'apps/desktop/public/monaco/vs/loader.js')), 'run npm run assets if missing');
const rust = tool('Rust', 'rustc', ['--version']);
if (rust.ok) {
  const match = rust.text.match(/rustc (\d+)\.(\d+)/);
  report('Rust minimum', Boolean(match) && (Number(match[1]) > 1 || Number(match[2]) >= 90), 'Tauri dialog dependency requires Rust >=1.90');
}
tool('Cargo', 'cargo', ['--version']);
let python = run('python', ['--version']);
if (!python.ok) python = run('python3', ['--version']);
report('Python development backend', python.ok, python.ok ? python.text : 'not on PATH; only needed for backend development', false);
tool('Arduino CLI', 'arduino-cli', ['version'], false);
report('Managed native backend', false, 'not bundled or qualified; see docs/desktop.md', false);
report('Platform SDK qualification', false, process.platform === 'win32' ? 'check MSVC C++ build tools and WebView2 using Tauri prerequisites; PATH checks do not certify them' : 'check native Tauri platform packages; PATH checks do not certify them', false);
const missing = results.filter((result) => result.required && !result.ok);
console.log(`\n${missing.length ? `${missing.length} prerequisite checks need attention.` : 'All probed prerequisites found.'} This probe does not certify a compiled native app, installer, or simulator.`);
if (strict && missing.length) process.exitCode = 1;
