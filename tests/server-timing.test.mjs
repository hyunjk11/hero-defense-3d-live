import test from 'node:test';
import assert from 'node:assert/strict';
import {requestTiming, timedJson, firestorePhase} from '../server/timing.mjs';
import {FirestoreStore, ROOT, PROJECT} from '../server/firestore.mjs';
import {verifyIdentity, makeFirestoreRequest, handleGameApi} from '../server/http.mjs';

function fixture({sampled=true, signal, ray='a511936c1c1af29c-ICN'}={}) {
  let clock=0,timer; const logs=[];
  const request=new Request('https://test.invalid/api/game',{headers:{'cf-ray':ray},signal});
  const timing=requestTiming(request,{now:()=>clock,sampled,schedule:fn=>(timer=fn,1),cancel:()=>{},write:(level,message)=>logs.push({level,data:JSON.parse(message)})});
  return {timing,logs,tick:n=>clock+=n,slow:()=>timer()};
}
test('default sampling includes the cold first request, then only one per 32',async()=>{
  const fresh=await import('../server/timing.mjs?sampling-test'),logs=[];
  for(let i=0;i<64;i++)fresh.requestTiming(new Request('https://test.invalid'),{schedule:()=>1,cancel:()=>{},write:()=>logs.push(i)}).finish();
  assert.deepEqual(logs,[0,32]);
});
test('fast requests are sampled; phase durations and slow in-flight snapshot are bounded',async()=>{
  const f=fixture({sampled:false});await f.timing.measure('auth.verify',async()=>{f.tick(20);});f.timing.finish();assert.equal(f.logs.length,0);
  const g=fixture({sampled:false});let release;const pending=g.timing.measure('oauth.wait',()=>new Promise(r=>release=r));g.tick(5000);g.slow();
  assert.equal(g.logs.length,1);assert.deepEqual(g.logs[0].data.pending,[{phase:'oauth.wait',elapsed_ms:5000}]);
  g.tick(48000);release('token');await pending;g.timing.finish('ok',200);g.timing.finish('ok');g.slow();
  assert.equal(g.logs.length,2);assert.equal(g.logs[1].data.phases['oauth.wait'].ms,53000);assert.equal(g.logs[1].data.request_id,'cf:a511936c1c1af29c');
  const h=fixture();const all=[];const releases=[];for(let i=0;i<50;i++)all.push(h.timing.measure('auth.verify',()=>new Promise(r=>releases.push(r))));h.slow();
  assert.equal(h.logs[0].data.pending.length,16);assert.equal(h.logs[0].data.pending_count,50);releases.forEach(r=>r());await Promise.all(all);h.timing.finish();
});
test('abort records disconnection and retains the eventual outcome without duplicating the operation',async()=>{
  const ac=new AbortController(), f=fixture({signal:ac.signal,sampled:false});let release;
  const p=f.timing.measure('firestore.read.headers',()=>new Promise(r=>release=r));f.tick(100);ac.abort();
  assert.equal(f.logs[0].data.kind,'disconnect');assert.equal(f.logs[0].data.outcome,'aborted');assert.equal(f.logs[0].data.pending_count,1);release(9);assert.equal(await p,9);f.timing.finish();assert.equal(f.logs.length,2);assert.equal(f.logs[1].data.kind,'end');assert.equal(f.logs[1].data.pending_count,0);assert.equal(f.logs[1].data.client_aborted,true);
  const g=fixture({sampled:false}),e=new DOMException('PRIVATE secret timeout URL','TimeoutError');
  await assert.rejects(g.timing.measure('auth.lookup.headers',()=>{throw e;}),x=>x===e);g.timing.finish('timeout',504);
  assert.equal(g.logs[0].data.phases['auth.lookup.headers'].last_failure,'timeout');assert.equal(g.logs[0].data.pending_count,0);
  assert.ok(!JSON.stringify(g.logs).includes('PRIVATE'));
});
test('untrusted operation names, headers, paths, errors and return values never enter log fields',async()=>{
  const f=fixture({ray:'PRIVATE_UID_email_key'});f.timing.operation({kind:'rpc',name:'hd3d_PRIVATE_UID_email_key'});f.timing.count('PRIVATE_UID');
  await assert.rejects(f.timing.measure('https://private.invalid/PRIVATE_UID',()=>{throw new Error('Authorization Bearer PRIVATE_TOKEN');}));f.timing.finish('error');
  const text=JSON.stringify(f.logs);for(const bad of ['PRIVATE','Authorization','Bearer','https://private'])assert.ok(!text.includes(bad),bad);
  assert.equal(f.logs[0].data.operation,'rpc.other');assert.equal(firestorePhase('projects/private/documents/uid:batchGet'),'firestore.read');
  assert.equal(firestorePhase('projects/private/uid'),'firestore.other');
  const t=requestTiming(new Request('https://test.invalid'),{sampled:true,write:()=>{throw new Error('log unavailable');}});
  assert.equal(await t.measure('auth.verify',()=>42),42);assert.doesNotThrow(()=>t.finish());
});
test('fetch header and body waits are separate; rejected fetch runs once and preserves the error',async()=>{
  const original=globalThis.fetch, f=fixture();let calls=0;
  try{
    globalThis.fetch=async()=>{calls++;f.tick(20);return {status:200,json:async()=>{f.tick(7);return {private:'SECRET_BODY'};}};};
    assert.deepEqual((await timedJson(f.timing,'auth.lookup','https://private.invalid',{})).body,{private:'SECRET_BODY'});
    f.timing.finish();assert.equal(f.logs[0].data.phases['auth.lookup.headers'].ms,20);assert.equal(f.logs[0].data.phases['auth.lookup.body'].ms,7);assert.ok(!JSON.stringify(f.logs).includes('SECRET_BODY'));
    const g=fixture(),err=new Error('PRIVATE_URL');globalThis.fetch=async()=>{calls++;throw err;};await assert.rejects(timedJson(g.timing,'oauth.token','https://private.invalid',{}),x=>x===err);g.timing.finish('error');assert.equal(calls,2);assert.equal(g.logs[0].data.pending_count,0);
  }finally{globalThis.fetch=original;}
});
test('read/write transactions, rollback, commit and existing ABORTED retry retain their call sequence',async()=>{
  const f=fixture(),calls=[];let attempts=0;
  const request=async(_method,path,body)=>{const op=path.split(':').at(-1);calls.push({op,body});if(op==='beginTransaction'){attempts++;assert.deepEqual(body.options,{readWrite:{}});return {transaction:'private-transaction-token'};}if(op==='batchGet')return [{missing:'private-document'}];if(op==='commit'&&attempts===1)throw Object.assign(new Error('PRIVATE conflict'),{status:409,code:'ABORTED'});return {};};
  const store=new FirestoreStore(request,f.timing);
  const value=await store.transaction(async tx=>{await tx.get('hd3d_progress','PRIVATE_UID');await tx.put('hd3d_progress',{user_id:'PRIVATE_UID',data:{souls:8}});return 8;});
  assert.equal(value,8);assert.deepEqual(calls.map(x=>x.op),['beginTransaction','batchGet','commit','rollback','beginTransaction','batchGet','commit']);
  f.timing.finish();assert.equal(f.logs[0].data.counts.transaction_attempt,2);assert.equal(f.logs[0].data.counts.transaction_retry,1);assert.equal(f.logs[0].data.counts.transaction_commit,2);assert.ok(!JSON.stringify(f.logs).includes('PRIVATE'));
  const g=fixture(),readCalls=[];await new FirestoreStore(async(_m,p,b)=>{readCalls.push(p.split(':').at(-1));return p.endsWith(':beginTransaction')?{transaction:'x'}:{};},g.timing).transaction(()=>3);g.timing.finish();assert.deepEqual(readCalls,['beginTransaction','rollback']);assert.equal(g.logs[0].data.counts.transaction_rollback,1);
});
test('failed transaction rollback and exhausted retry errors still terminate timing',async()=>{
  const f=fixture();let begins=0,rollbacks=0;const error=Object.assign(new Error('PRIVATE'),{code:'ABORTED'});
  const store=new FirestoreStore(async(_m,p)=>{if(p.endsWith(':beginTransaction')){begins++;return {transaction:'x'};}if(p.endsWith(':rollback')){rollbacks++;return {};}},f.timing);
  await assert.rejects(store.transaction(()=>{throw error;}),x=>x===error);f.timing.finish('error');assert.equal(begins,5);assert.equal(rollbacks,5);assert.equal(f.logs[0].data.counts.transaction_retry,4);assert.equal(f.logs[0].data.pending_count,0);
});
test('identity cache and denied API preserve validation while emitting no identity or token',async()=>{
  const original=globalThis.fetch, originalLog={log:console.log,warn:console.warn,error:console.error};let lookups=0;const output=[];
  const claims={aud:PROJECT,iss:'https://securetoken.google.com/'+PROJECT,sub:'PRIVATE_UID',exp:Date.now()/1000+600,iat:Date.now()/1000};
  const token='header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.PRIVATE_SIGNATURE';
  try{
    globalThis.fetch=async()=>{lookups++;return new Response(JSON.stringify({users:[{localId:'PRIVATE_UID',email:'PRIVATE_EMAIL',createdAt:'1'}]}));};
    const a=fixture(),b=fixture();assert.equal((await verifyIdentity(token,a.timing)).id,'PRIVATE_UID');await verifyIdentity(token,b.timing);a.timing.finish();b.timing.finish();
    assert.equal(lookups,1);assert.equal(a.logs[0].data.counts.auth_cache_miss,1);assert.equal(b.logs[0].data.counts.auth_cache_hit,1);assert.ok(!JSON.stringify([a.logs,b.logs]).includes('PRIVATE'));
    for(const k of Object.keys(originalLog))console[k]=m=>output.push(String(m));
    const resp=await handleGameApi(new Request('https://test.invalid/api/game',{method:'POST',headers:{authorization:'Bearer PRIVATE_BAD_TOKEN'},body:JSON.stringify({kind:'rpc',name:'PRIVATE_UID'})}),{});
    assert.equal(resp.status,401);assert.equal(output.length,1);assert.equal(JSON.parse(output[0]).outcome,'error');assert.ok(!output[0].includes('PRIVATE'));
  }finally{globalThis.fetch=original;Object.assign(console,originalLog);}
});
test('OAuth miss, shared refresh and hit stay coalesced; Firestore metadata is path-free',async()=>{
  const original=globalThis.fetch;let tokens=0,dbCalls=0,release,started;
  const tokenStarted=new Promise(r=>started=r), tokenResponse=new Promise(r=>release=r);
  // Ephemeral offline key for a fake transport; no service-account credential is created or saved.
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const der=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
  const env={HD3D_FIREBASE_SERVICE_ACCOUNT:{project_id:PROJECT,client_email:'runtime-fixture@'+PROJECT+'.iam.gserviceaccount.com',private_key_id:'test-only-'+crypto.randomUUID(),private_key:'-----BEGIN PRIVATE KEY-----\n'+der+'\n-----END PRIVATE KEY-----'}};
  const a=fixture(),b=fixture(),c=fixture();
  try{
    globalThis.fetch=async url=>{if(url==='https://oauth2.googleapis.com/token'){tokens++;started();await tokenResponse;return new Response(JSON.stringify({access_token:'PRIVATE_FAKE_TOKEN',expires_in:3600}));}if(String(url).startsWith('https://firestore.googleapis.com/v1/')){dbCalls++;return new Response(JSON.stringify({result:'PRIVATE_BODY'}));}throw new Error('unexpected mocked URL');};
    const p=makeFirestoreRequest(env,a.timing)('POST',ROOT+':batchGet',{documents:['PRIVATE_UID']});await tokenStarted;
    const q=makeFirestoreRequest(env,b.timing)('POST',ROOT+':runQuery',{private:'PRIVATE_UID'});release();await Promise.all([p,q]);
    await makeFirestoreRequest(env,c.timing)('POST',ROOT+':rollback',{transaction:'PRIVATE_TX'});for(const f of [a,b,c])f.timing.finish();
    assert.equal(tokens,1);assert.equal(dbCalls,3);assert.equal(a.logs[0].data.counts.oauth_cache_miss,1);assert.equal(b.logs[0].data.counts.oauth_shared_wait,1);assert.equal(c.logs[0].data.counts.oauth_cache_hit,1);
    const text=JSON.stringify([a.logs,b.logs,c.logs]);for(const bad of ['PRIVATE','Authorization','https://','documents','private_key'])assert.ok(!text.includes(bad),bad);
  }finally{globalThis.fetch=original;}
});
