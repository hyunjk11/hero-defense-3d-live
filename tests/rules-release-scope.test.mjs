import assert from 'node:assert/strict';
import fs from 'node:fs';
import {releaseArtifacts} from '../direct/release-artifacts.mjs';
const source=fs.readFileSync(new URL('../direct/firestore.rules',import.meta.url),'utf8');
const gate="function demo() { return request.auth.token.aud == 'demo-hd3d-direct'; }";
const sites=[...source.matchAll(/function demo\(\) \{ return request.auth.token.aud == 'demo-hd3d-direct'; \}/g)];
assert(sites.length>1);
const output=releaseArtifacts(source,{}).rules;
assert(!output.includes("token.aud == 'demo-hd3d-direct'"));
assert.equal(output.split("token.aud == 'hero-defense-3d-independent'").length-1,sites.length);
for(const site of sites){
 for(const bad of ["function demo() { return true; }","function demo() { return request.auth.token.aud == 'other'; }"]){
  const changed=source.slice(0,site.index)+bad+source.slice(site.index+gate.length);
  assert.throws(()=>releaseArtifacts(changed,{}),/audience gate/);
 }
}
console.log('PASS every scoped audience gate must match exactly before offline release generation');
