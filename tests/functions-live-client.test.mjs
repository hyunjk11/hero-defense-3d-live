import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOUD} from '../src/config/cloud.js';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import {resolveFunctionsConfig} from '../src/account/functions-config.js';
import {initialOwnerPlan,LIVE_ROOT,liveHandler} from '../server/live.mjs';
test('pending production and wrong endpoints stop before Auth/network; demo never targets live',async()=>{
 let calls=0;await assert.rejects(createFirebaseClient({...CLOUD,functionsActivation:'pending-deployment'},{sdk:{getApps(){calls++;}},fetch(){calls++;}}),e=>e.code==='FUNCTIONS_ACTIVATION_REQUIRED');assert.equal(calls,0);
 const c={...CLOUD,functionsActivation:'deployment-verified',apiUrl:'https://asia-northeast3-hero-defense-3d-independent.cloudfunctions.net/gameApi'};assert.equal(resolveFunctionsConfig(c).emulated,false);
 for(const change of [{apiUrl:'https://attacker.invalid'},{apiUrl:'https://legacy.example.invalid/api/game'},{authEmulator:'http://127.0.0.1:9199'},{firebase:{...c.firebase,projectId:'other'}},{firestoreEndpoint:'https://firestore.googleapis.com'}])assert.throws(()=>resolveFunctionsConfig({...c,...change}),e=>e.code==='FUNCTIONS_CONFIG_INVALID');
 const demo={...c,storageMode:'functions-prototype',firebase:{...c.firebase,projectId:'demo-hd3d-direct'},apiUrl:'http://127.0.0.1:10742/api/game',authEmulator:'http://127.0.0.1:9199'};assert.equal(resolveFunctionsConfig(demo).emulated,true);
 assert.throws(()=>resolveFunctionsConfig({...demo,apiUrl:c.apiUrl}));assert.throws(()=>resolveFunctionsConfig({...demo,firebase:c.firebase}));
});
test('A to B transition discards late A response, skips queued A writes and never replays',async()=>{
 const a={uid:'a',email:'a@example.invalid',getIdToken:async()=>'fake-a'},b={uid:'b',email:'b@example.invalid',getIdToken:async()=>'fake-b'};
 const auth={currentUser:a,authStateReady:async()=>{}},app={name:'hero-defense-live',options:CLOUD.firebase};let release,entered;const ready=new Promise(r=>entered=r),seen=[];
 const sdk={getApps:()=>[app],getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:{},signOut:async()=>{auth.currentUser=null;}};
 const config={...CLOUD,functionsActivation:'deployment-verified',apiUrl:'https://asia-northeast3-hero-defense-3d-independent.cloudfunctions.net/gameApi'};
 const client=await createFirebaseClient(config,{sdk,fetch:async(url,o)=>{seen.push(o.headers.Authorization);entered();return new Promise(r=>release=()=>r(Response.json({data:{secret:'a-only'}})));}});
 const first=client.rpc('write-a'),queued=client.rpc('queued-a');await ready;auth.currentUser=b;release();
 assert.equal((await first).error.code,'ACCOUNT_CHANGED');assert.equal((await queued).error.code,'ACCOUNT_CHANGED');assert.deepEqual(seen,['Bearer fake-a']);assert.equal(client.atomicGear,true);assert.equal(client.atomicMail,true);assert.equal(client.serverEconomy,true);
 await client.auth.signOut();assert.equal((await client.rpc('write')).status,401);assert.equal(seen.length,1);
});
test('owner initialization pins identity, creates only once, never activates runtime',async()=>{
 const p=initialOwnerPlan({uid:'verified-fixture',verifiedEmail:'owner@example.invalid',at:'2026-11-13T00:00:00Z'});
 assert.equal(p.writes.length,1);assert(p.writes[0].update.name.startsWith(LIVE_ROOT+'/hd3d_admins/'));assert.equal(p.writes[0].currentDocument.exists,false);assert.equal(p.activationIncluded,false);
 for(const input of [{uid:'../escape',verifiedEmail:'owner@example.invalid'},{uid:'ok',verifiedEmail:'other@example.invalid'}])assert.throws(()=>initialOwnerPlan({...input,at:'2026-11-13T00:00:00Z'}));
 let requests=0;const gated=liveHandler({request:()=>{requests++;}});assert.equal((await gated(new Request('https://local.invalid'))).status,503);assert.equal(requests,0);
});
