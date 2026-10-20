#!/usr/bin/env node
// Development only: this does not implement the authenticated desktop sidecar.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const start = args.includes('--start');
if (args.some(arg => !['--start', '--check'].includes(arg))) {
  console.error('Usage: node services/local-backend/dev.mjs [--check|--start]'); process.exit(2);
}
const pin = JSON.parse(readFileSync(path.join(root, 'upstream.lock.json'), 'utf8'));
const upstream = path.join(root, 'vendor', 'velxio');
const backend = path.join(upstream, 'backend');
const errors = [];
const probe = (command, argv, cwd = root) => spawnSync(command, argv, {
  cwd, encoding: 'utf8', shell: false, windowsHide: true, timeout: 15000,
});
const revision = probe('git', ['-C', upstream, 'rev-parse', 'HEAD']);
if (revision.status !== 0 || revision.stdout.trim() !== pin.commit) errors.push('Velxio checkout does not match upstream.lock.json; initialize the pinned submodule.');
const clean = probe('git', ['-C', upstream, 'diff', '--quiet', 'HEAD', '--', 'backend']);
if (clean.status !== 0) errors.push('Velxio backend has tracked modifications; review/reconcile the pinned source before starting.');
if (!existsSync(path.join(backend, 'app', 'main.py'))) errors.push('Pinned backend source is missing.');
if (existsSync(path.join(backend, 'app', 'pro')) || existsSync(path.join(backend, 'app', 'pro_boards'))) errors.push('Private overlay detected; this bootstrap supports the pinned public distribution only.');
const python = process.env.BREADBIT_PYTHON || 'python';
const pythonVersion = probe(python, ['--version']);
if (pythonVersion.status !== 0) errors.push('Python cannot run. Set BREADBIT_PYTHON to the virtual environment interpreter.');
else {
  console.log(pythonVersion.stdout.trim() || pythonVersion.stderr.trim());
  const dependencies = probe(python, ['-c', "import importlib.util,sys; names=['uvicorn','fastapi','pydantic_settings','mcp','httpx','wasmtime']; missing=[n for n in names if importlib.util.find_spec(n) is None]; print('Missing Python modules: '+', '.join(missing) if missing else 'Python dependency imports discoverable'); sys.exit(bool(missing))"]);
  if (dependencies.status !== 0) errors.push(dependencies.stdout.trim() || 'Python dependency check failed.');
  else console.log(dependencies.stdout.trim());
}
const cli = probe('arduino-cli', ['version']);
if (cli.status !== 0) errors.push('arduino-cli is not on PATH. Compile support is unavailable until explicitly installed with the required board core.');
else console.log(cli.stdout.trim());
if (errors.length) {
  for (const error of errors) console.error(`Unavailable: ${error}`);
  process.exit(1);
}
console.log(`Pinned source verified: ${pin.commit}`);
console.log('Dependency presence is not compilation, board-core qualification, or simulation evidence.');
if (!start) process.exit(0);
console.warn('Starting the PUBLIC, UNAUTHENTICATED Velxio backend for explicit local development only on 127.0.0.1:8000. It includes compile/library/hardware routes. Do not expose the port or use it as a production desktop sidecar.');
const env = { ...process.env, FRONTEND_URL: 'http://127.0.0.1:1420', VELXIO_NEWS: 'off' };
delete env.PYTHONPATH;
const child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
  cwd: backend, env, stdio: 'inherit', shell: false, windowsHide: true,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', error => { console.error(`Backend startup failed: ${error.message}`); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
