import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {releaseMap} from '../scripts/stamp-browser-release.mjs';
test('browser release stamps every module, including dependencies not only entrypoint',()=>{
 const r=releaseMap(process.cwd()),html=fs.readFileSync('index.html','utf8'),map=JSON.parse(html.match(/<script type="importmap">([^<]*)<\/script>/)[1]);
 assert.deepEqual(map.imports,r.imports);assert.ok(r.files.length>250);
 for(const p of ['src/main.js','src/world/towers.js','src/world/beam.js','src/data/towers.js','src/ui/hud.js','src/account/account.js'])assert.equal(map.imports['./'+p],'./'+p+'?v='+r.version);
 for(const p of ['practice-storage','analytics'])assert.ok(html.includes(`src="./src/${p}.js?v=${r.version}"`));
 assert.ok(html.indexOf('type="importmap"')<html.indexOf('type="module"'));
 // Relative specifiers normalize against the versioned parent path, not its query.
 const parent=new URL(map.imports['./src/world/towers.js'],'https://example.test/game/');
 const dependency=new URL('../data/towers.js',parent);
 assert.equal(dependency.href,new URL('./src/data/towers.js','https://example.test/game/').href);
 assert.ok(map.imports['./src/data/towers.js'].endsWith('?v='+r.version));
});
