import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const engine=read('tools/set-lab/engine.mjs'),runner=read('tools/set-lab/run.mjs');
assert.match(engine,/fetch:no, WebSocket:no, XMLHttpRequest:no/);
assert.match(engine,/localStorage:\{getItem:no,setItem:no,removeItem:no\}/);
assert.match(engine,/account\/account\.js':\{A:\{user:null\},load:no,update:no\}/);
assert.match(engine,/importModuleDynamically:no/);
assert.match(runner,/Output folder exists; preserve previous evidence/);
assert.match(runner,/connect-src 'none'/);
for(const p of ['tools/set-lab/engine.mjs','tools/set-lab/run.mjs']) {
  const s=read(p);
  assert.doesNotMatch(s,/cloudfunctions\.net|firestore\.googleapis|securetoken|signInWith|serviceAccount|https:\/\/hyunjk11|[A-Z]:\\/);
}
// No production JS source may import or expose the fixture.
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):e.name.endsWith('.js')||e.name.endsWith('.mjs')?[path.join(p,e.name)]:[]);
let scanned=0;
for(const dir of ['src','server'])for(const p of walk(path.join(root,dir))){if(p.endsWith('.test.mjs'))continue;assert.doesNotMatch(fs.readFileSync(p,'utf8'),/tools\/set-lab|createLab\(|set-lab-memory-only/);scanned++;}
console.log(`set-lab-isolation: ${scanned} production modules have no fixture entry; network/account stubs and output guards verified`);
