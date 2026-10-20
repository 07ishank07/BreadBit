// Build from the repository root so the Site source retains shared packages.
// This does not register or publish a Site. The Sites workflow owns publication.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const service = path.join(root, 'services/project-cloud');
const manifest = path.join(root, '.openai/hosting.json');
if (existsSync(manifest)) {
  const config = JSON.parse(readFileSync(manifest,'utf8'));
  if (config.d1 !== 'DB' || config.static) throw new Error('Cloud Site requires the DB binding and Worker hosting.');
  writeFileSync(path.join(service,'.openai/hosting.json'), JSON.stringify(config,null,2)+'\n');
}
const result = spawnSync(process.execPath, [path.join(service,'scripts/run-framework.mjs'),'build'], { cwd:service, stdio:'inherit', windowsHide:true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
// Both server code and Drizzle metadata are emitted by the retained Sites plugin.
const output = path.join(root,'dist'); mkdirSync(output,{recursive:true});
cpSync(path.join(service,'dist'),output,{recursive:true});
