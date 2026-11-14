import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {buildReview,moduleSpecifiers,root} from './build-review.mjs';
const dist=process.argv[2];if(!dist)throw Error('Provide the already-built local review directory');
const cases=[];
assert.deepEqual(moduleSpecifiers(`/* from 'https://example.invalid/model.bin' */ import {x} from './a.js'; // import('https://example.invalid/')\n export {x} from './b.js'; import './c.js'; const m=import('./d.js'); const text="from 'not-a-module'";`),['./a.js','./b.js','./c.js','./d.js']);cases.push('comments and strings are not imports; all four declaration forms');
assert.deepEqual(moduleSpecifiers(`import.meta.url; const sample=\`from 'not-a-module'\`;`),[]);cases.push('import.meta and template text');
assert.throws(()=>moduleSpecifiers('import(variable)'),/Nonliteral/);cases.push('nonliteral dynamic imports stop preparation');
await assert.rejects(buildReview(root),/never overwrite/);cases.push('source directory rejected before writes');
await assert.rejects(buildReview(resolve(root,'src')),/never overwrite/);cases.push('source subdirectory rejected before writes');
const m=JSON.parse(await readFile(join(dist,'_review-manifest.json'),'utf8'));assert.equal(m.productionReady,false);assert.equal(m.activation,'pending-rules-and-data');
const keys=Object.keys(m.sourceFiles),digest=b=>createHash('sha256').update(b).digest('hex');
for(const n of keys){const a=await readFile(join(root,n)),b=await readFile(join(dist,n));assert.equal(digest(a),m.sourceFiles[n].sha256,n);assert.deepEqual(a,b,n);}
cases.push('all static output bytes match staged source');
for(const edge of m.moduleEdges){assert.ok(keys.includes(edge.from),edge.from);assert.ok(keys.includes(edge.to),edge.to);const uri=new URL(edge.to,'https://hyunjk11.github.io/hero-defense-3d-live/');assert.ok(uri.pathname.startsWith('/hero-defense-3d-live/'));}
for(const n of keys)assert.ok(!/^(direct|tests|docs|supabase|shots|tools)\//.test(n),n);
for(const n of ['server/http.mjs','server/backend.test.mjs','server/memory-store.mjs'])assert.ok(!keys.includes(n));
assert.equal(keys.filter(n=>/^models\/.*\.glb$/.test(n)).length,19);assert.ok(keys.includes('audio/KENNEY_LICENSE.txt'));assert.ok(keys.includes('server/operations.mjs'));assert.ok(keys.includes('.nojekyll'));
const html=await readFile(join(dist,'index.html'),'utf8');
for(const [,spec]of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert.ok(!spec.startsWith('/'));assert.ok(keys.includes(spec));}
assert.ok((await readFile(join(dist,'src/core/nav.js'),'utf8')).includes("location.pathname + '?'"));
cases.push('project subpath, exact dependency names, all models, licenses and no server entry');
await assert.rejects(buildReview(dist),/EEXIST/);assert.equal(digest(await readFile(join(dist,'index.html'))),m.sourceFiles['index.html'].sha256);cases.push('existing output cannot be overwritten');
console.log(JSON.stringify({passed:cases.length,failed:0,cases,staticFiles:keys.length,moduleEdges:m.moduleEdges.length,productionReady:false},null,2));
