import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CLOUD} from '../src/config/cloud.js';
import {freshRelease,initialOwnerPlan,FRESH_ROOT} from '../direct/fresh-release.mjs';
import {bootstrapDocuments} from '../src/account/direct-bootstrap.js';
import {LIVE_PROJECT} from '../src/account/direct-config.js';
const ADMIN_EMAIL='owner@example.invalid';
import {encodeFields} from '../src/account/direct-store.js';
const rules=fs.readFileSync(new URL('../direct/firestore.rules',import.meta.url),'utf8');
const indexes=JSON.parse(fs.readFileSync(new URL('../direct/firestore.indexes.json',import.meta.url)));
const plan=freshRelease(rules,indexes);
assert.equal(plan.productionReady,false);assert.equal(plan.oldDataReads,0);assert.equal(plan.oldDataWrites,0);
assert.equal(plan.repositoryName,'hero-defense-3d-live');assert.equal(CLOUD.storagePrefix,'hd3d_live');
assert.equal(CLOUD.authStorageKey,'hd3dLiveFirebaseAuth');assert.equal(CLOUD.storageMode,'functions');assert.equal(CLOUD.functionsActivation,'pending-deployment');assert.equal(CLOUD.apiUrl,'https://asia-northeast3-hero-defense-3d-independent.cloudfunctions.net/gameApi');
assert(plan.initialWrites.length>100);assert(plan.initialWrites.every(w=>w.currentDocument.exists===false&&w.update.name.startsWith(FRESH_ROOT+'/hd3d_live_')));
assert.equal(new Set(plan.initialWrites.map(w=>w.update.name)).size,plan.initialWrites.length);
assert.deepEqual(plan.initialWrites.at(-1).update.fields,encodeFields({value:0}));
assert(bootstrapDocuments('old-auth-uid','fixture@example.invalid',0,LIVE_PROJECT).every(d=>d.name.startsWith(FRESH_ROOT+'/hd3d_live/old-auth-uid/')));
const uid='owner-fixture',prefix=FRESH_ROOT+'/hd3d_live/'+uid+'/',stamp='2026-11-11T00:00:00Z';
const activation={name:prefix+'hd3d_sequences/_activation',updateTime:stamp,fields:encodeFields({owner:uid,row:{schema:1,enabled:true}})};
const revision={name:prefix+'hd3d_sequences/_revision',updateTime:stamp,fields:encodeFields({owner:uid,row:{value:0}})};
const input={uid,verifiedEmail:ADMIN_EMAIL,activation,revision,at:stamp},owner=initialOwnerPlan(input);
assert.equal(owner.writes.length,3);assert.equal(owner.writes[0].currentDocument.updateTime,stamp);assert.equal(owner.writes[2].currentDocument.exists,false);
for(const change of [{uid:'../bad'},{verifiedEmail:'outsider@example.invalid'},{activation:{...activation,name:activation.name.replace('hd3d_live','hd3d_direct')}},{revision:{...revision,updateTime:undefined}},{at:'invalid'}])assert.throws(()=>initialOwnerPlan({...input,...change}));
const src=new URL('../src/',import.meta.url);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(new URL(x.name+'/',dir)):x.name.endsWith('.js')?[new URL(x.name,dir)]:[]);}
for(const file of walk(src)){
 const text=fs.readFileSync(file,'utf8');
 assert(!text.includes('hd3d_independent'),file.pathname);
 assert(!text.includes('hd3d_direct/'),file.pathname);
 for(const key of ['hd3d_audio','hd3d_best','hd3d_seenMon','hd3d_lastRun','hd3d_dgparty','hd3d_sppick','hd3d_gfx','hd3d_autoSkill','hd3d_autoWave','hd3d_speed','hd3d_keepSpeed'])assert(!text.includes("'"+key+"'"),file.pathname+': '+key);
}
console.log(JSON.stringify({pass:true,checks:['new namespace only','new local keys','pending gate','create-only catalog/counter','fresh bootstrap','owner requires verified identity/current snapshots','owner collision and drift preconditions','old runtime keys absent'],initialDocuments:plan.initialWrites.length,network:false}));
