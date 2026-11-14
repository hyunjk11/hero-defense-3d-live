import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ruleFunctionBodies,freshRelease} from '../direct/fresh-release.mjs';
const rules=fs.readFileSync(new URL('../direct/firestore.rules',import.meta.url),'utf8');
const indexes=JSON.parse(fs.readFileSync(new URL('../direct/firestore.indexes.json',import.meta.url)));
const bodies=ruleFunctionBodies(rules,'bootstrap');
assert(bodies.length>0);assert.equal(new Set(bodies).size,1);
assert.equal(freshRelease(rules,indexes).oldDataReads,0);
// Every generated scope must retain the same fresh-account isolation guard.
const guard="!exists(path(uid,'hd3d_sequences','_activation'))";
const positions=[...rules.matchAll(/!exists\(path\(uid,'hd3d_sequences','_activation'\)\)/g)].map(x=>x.index);
assert.equal(positions.length,bodies.length);
for(const at of positions)assert.throws(()=>freshRelease(rules.slice(0,at)+'true'+rules.slice(at+guard.length),indexes),/not isolated/);
assert.throws(()=>freshRelease(rules.replaceAll('function bootstrap(','function otherBootstrap('),indexes),/not isolated/);
assert.deepEqual(ruleFunctionBodies("// function bootstrap(x) { bad }\nfunction bootstrap(x){let z={'s':'} //'};return z;} /* function bootstrap(x) { bad } */",'bootstrap'),["letz={'s':'} //'};returnz;"]);
assert.throws(()=>ruleFunctionBodies('function bootstrap(x) { return x;','bootstrap'),/Unclosed/);
console.log('PASS 8 offline bootstrap scope and malformed-source boundaries');
