// Threat sampler receives a stage and seed count, never a boolean difficulty flag.
// This is a deterministic structural regression, not an all-hero balance claim.
import assert from 'node:assert/strict';
import {STAGES} from '../src/data/stages.js';
import {HARD_STAGES} from '../src/data/hard.js';
import {avgThreat} from '../src/core/threat.js';
const before=JSON.stringify(STAGES);let samples=0;
assert.equal(Object.keys(STAGES).length,60);
for(const s of Object.values(HARD_STAGES)){
 assert.equal(s.hard,true);assert.equal(s.id,'hard-'+s.normalId);
 assert.ok(s.hp>STAGES[s.normalId].hp);
 for(const wave of [1,Math.ceil(s.waves/2),s.waves]){
  const a=avgThreat(s,wave,3),b=avgThreat(s,wave,3);assert.deepEqual(a,b);
  for(const key of ['hp','dps','n'])assert.ok(Number.isFinite(a[key])&&a[key]>0);
  samples++;
 }
}
assert.equal(samples,180);assert.equal(JSON.stringify(STAGES),before);
console.log('PASS: 180 deterministic hard-stage samples; normal 60 definitions untouched');
