import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let failed = 0, passed = 0;
for (const name of readdirSync(new URL('./', import.meta.url)).filter(n => n.endsWith('.test.mjs')).sort()) {
  const r = spawnSync(process.execPath, ['tests/' + name], { cwd: root, encoding: 'utf8', timeout: 120000 });
  if (r.status === 0) { passed++; console.log('PASS ' + name); }
  else { failed++; console.error('FAIL ' + name + '\n' + r.stdout + r.stderr); }
}
console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
