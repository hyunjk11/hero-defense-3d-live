import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createHttpBridge} from '../cloud-functions/bridge.mjs';
import {createRuntimeTokenProvider} from '../cloud-functions/runtime-auth.mjs';
import {GAME_API_OPTIONS,PROJECT} from '../cloud-functions/options.mjs';
import {handleGameApi,makeFirestoreRequest} from '../server/http.mjs';
import {MemoryStore} from '../server/memory-store.mjs';
import {empty} from '../src/account/progress.js';
const ORIGIN='https://legacy.example.invalid';
class ResponseDouble extends EventEmitter {
  headers={};statusCode=200;destroyed=false;writableFinished=false;writableEnded=false;headersSent=false;ends=0;
  status(s){this.statusCode=s;return this;}
  set(o){for(const [k,v] of Object.entries(o))this.setHeader(k,v);return this;}
  setHeader(k,v){this.headers[k.toLowerCase()]=v;}
  send(s){return this.end(s);}
  end(s){this.ends++;this.body=s===undefined?'':Buffer.from(s).toString();this.writableFinished=this.writableEnded=this.headersSent=true;this.emit('finish');this.emit('close');return this;}
}
function pair(method='POST',raw='{}',headers={}){
  const req=Object.assign(new EventEmitter(),{method,headers:{origin:ORIGIN,'content-type':'application/json',...headers},rawBody:raw===null?undefined:Buffer.from(raw),aborted:false});
  return {req,res:new ResponseDouble()};
}
async function call(bridge,method,raw,headers){const p=pair(method,raw,headers);await bridge(p.req,p.res);assert.equal(p.req.listenerCount('aborted'),0);assert.equal(p.res.listenerCount('close'),0);return p.res;}

test('HTTP bridge preserves bytes, authorization, CORS headers and response codes',async()=>{
  let seen;const bridge=createHttpBridge(async r=>{seen={method:r.method,auth:r.headers.get('authorization'),raw:await r.text()};return new Response('{"ok":true}',{status:409,headers:{'content-type':'application/json','access-control-allow-origin':ORIGIN,'cache-control':'no-store'}});});
  const raw=' { "value": 123 } ';const r=await call(bridge,'POST',raw,{authorization:'Bearer test-not-a-real-token'});
  assert.deepEqual(seen,{method:'POST',auth:'Bearer test-not-a-real-token',raw});assert.equal(r.statusCode,409);assert.equal(r.body,'{"ok":true}');assert.equal(r.headers['access-control-allow-origin'],ORIGIN);assert.equal(r.ends,1);
});
test('real API method, preflight, origin, size and missing-token policies survive adapter',async()=>{
  const bridge=createHttpBridge(r=>handleGameApi(r,{}));
  let r=await call(bridge,'OPTIONS',null);assert.equal(r.statusCode,204);assert.equal(r.headers['access-control-allow-origin'],ORIGIN);
  r=await call(bridge,'GET',null);assert.equal(r.statusCode,405);
  r=await call(bridge,'POST','{}',{origin:'https://attacker.invalid'});assert.equal(r.statusCode,403);
  r=await call(bridge,'POST','{}',{origin:'http://127.0.0.1:8999'});assert.equal(r.statusCode,401);assert.equal(r.headers['access-control-allow-origin'],'http://127.0.0.1:8999');
  r=await call(bridge,'POST','x'.repeat(100001));assert.equal(r.statusCode,413);
  r=await call(bridge,'POST','{}',{'content-length':'100001'});assert.equal(r.statusCode,413);
  r=await call(bridge,'POST','{}');assert.equal(r.statusCode,401);
  r=await call(bridge,'POST',null);assert.equal(r.statusCode,400);assert.equal(JSON.parse(r.body).error.code,'INVALID_BODY');
  r=await call(bridge,'POST','{broken');assert.equal(JSON.parse(r.body).error.code,'BACKEND_ERROR');
});
test('normal req close is not a cancellation; response close or abort cancels once and detaches listeners',async()=>{
  let resume,signal;const bridge=createHttpBridge(r=>{signal=r.signal;return new Promise(resolve=>resume=()=>resolve(new Response('{}')));});
  let p=pair(),job=bridge(p.req,p.res);p.req.emit('close');assert.equal(signal.aborted,false);resume();await job;assert.equal(p.res.ends,1);assert.equal(signal.aborted,false);
  for(const event of ['aborted','response-close']){
    p=pair();job=bridge(p.req,p.res);if(event==='aborted')p.req.emit('aborted');else {p.res.destroyed=true;p.res.emit('close');}
    assert.equal(signal.aborted,true);resume();await job;assert.equal(p.res.ends,0);assert.equal(p.req.listenerCount('aborted'),0);assert.equal(p.res.listenerCount('close'),0);
  }
});
test('exception responses conceal internals and never report success or auto-retry',async()=>{
  let calls=0;const bridge=createHttpBridge(async()=>{calls++;throw new Error('private-token-secret');});
  const r=await call(bridge,'POST','{}');assert.equal(calls,1);assert.equal(r.statusCode,503);assert.ok(!r.body.includes('private-token-secret'));assert.equal(r.ends,1);
});
test('runtime token provider shares only inflight refresh; rejects wrong/local/emulator environments',async()=>{
  const keys=['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','K_SERVICE','FUNCTIONS_EMULATOR'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys)delete process.env[k];let calls=0,resolve;
    const get=createRuntimeTokenProvider({getAccessToken(){calls++;return new Promise(r=>resolve=r);}},PROJECT);
    await assert.rejects(get(),e=>e.status===503);assert.equal(calls,0);
    process.env.GCLOUD_PROJECT=PROJECT;process.env.K_SERVICE='isolated-test';
    const a=get(),b=get();await Promise.resolve();assert.equal(calls,1);resolve({token:'fake-short-lived'});assert.deepEqual(await Promise.all([a,b]),['fake-short-lived','fake-short-lived']);
    const c=get();await Promise.resolve();assert.equal(calls,2);resolve({token:null});await assert.rejects(c,e=>e.status===503);
    process.env.FUNCTIONS_EMULATOR='true';await assert.rejects(get(),e=>e.status===503);assert.equal(calls,2);
    delete process.env.FUNCTIONS_EMULATOR;process.env.GCLOUD_PROJECT='other';await assert.rejects(get(),e=>e.status===503);
  } finally {for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});
test('Firestore request provider preserves method, body, errors, timing and abort without secret key',async()=>{
  const old=globalThis.fetch;let calls=0,tokenCalls=0,seen;
  globalThis.fetch=async(url,options)=>{calls++;seen={url,options};return new Response(JSON.stringify({documents:[]}));};
  try{
    const request=makeFirestoreRequest({},undefined,async()=>{tokenCalls++;return 'fake-runtime-token';});
    assert.deepEqual(await request('POST','projects/test/databases/(default)/documents:batchGet',{documents:[]}),{documents:[]});
    assert.equal(tokenCalls,1);assert.equal(seen.options.headers.Authorization,'Bearer fake-runtime-token');assert.equal(seen.options.body,'{"documents":[]}');
    const a=new AbortController();a.abort();await assert.rejects(request('POST','test',{}, {signal:a.signal}),e=>e.name==='AbortError');assert.equal(calls,1);assert.equal(tokenCalls,1);
    globalThis.fetch=async()=>new Response(JSON.stringify({error:{status:'ABORTED',message:'conflict'}}),{status:409});
    await assert.rejects(request('POST','test',{}),e=>e.status===409&&e.code==='ABORTED');
  }finally{globalThis.fetch=old;}
});
test('actual API start/reward retry and save CAS are unchanged across the Functions bridge',async()=>{
  const originalFetch=globalThis.fetch,originalNow=Date.now;let now=1800000000000;Date.now=()=>now;
  const uid='functions-isolated-a';const claims={aud:PROJECT,iss:'https://securetoken.google.com/'+PROJECT,sub:uid,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3600};
  const jwt=['unused',Buffer.from(JSON.stringify(claims)).toString('base64url'),'unused'].join('.');
  let authLookups=0;globalThis.fetch=async(url,opts)=>{
    assert.ok(String(url).startsWith('https://identitytoolkit.googleapis.com/'));assert.equal(JSON.parse(opts.body).idToken,jwt);authLookups++;
    return new Response(JSON.stringify({users:[{localId:uid,email:'qa@example.invalid',createdAt:String(now)}]}));
  };
  const data=empty(),stamp=new Date(now).toISOString();const store=new MemoryStore({hd3d_progress:[{user_id:uid,data,updated_at:stamp}]});
  let factories=0;const bridge=createHttpBridge(r=>handleGameApi(r,{}, {createStore(timing,scope,signal){assert.ok(timing.measure);assert.ok(scope);assert.equal(signal.aborted,false);factories++;return store;}}));
  const rpc=async(name,args)=>JSON.parse((await call(bridge,'POST',JSON.stringify({kind:'rpc',name:'hd3d_growth_'+name,args}),{authorization:'Bearer '+jwt})).body);
  try{
    const start=await rpc('start',{p_id:'functions-isolated-run',p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});assert.equal(start.data.ok,true);
    now+=10000;const args={p_token:'functions-isolated-run',p_completed:1,p_win:false,p_finish:true};
    const first=await rpc('progress',args),again=await rpc('progress',args);assert.equal(first.data.xp,10);assert.equal(again.data.already,true);assert.equal(again.data.growth.earned,10);
    const q={kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:uid,updated_at:'outdated'},values:{data:{...data,souls:999},merged:true}};
    const stale=JSON.parse((await call(bridge,'POST',JSON.stringify(q),{authorization:'Bearer '+jwt})).body);assert.deepEqual(stale.data,[]);assert.equal(store.tables.hd3d_progress[0].data.souls,0);
    assert.ok(authLookups>=1);assert.equal(factories,4);
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
test('deployment source contains exact dependency closure and preserves client/DB/gameplay config',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../cloud-functions/game-manifest.json',import.meta.url)));
  assert.equal(Object.keys(manifest).length,59);
  for(const [rel,expected] of Object.entries(manifest)){
    const source=fs.readFileSync(new URL('../'+rel,import.meta.url)),staged=fs.readFileSync(new URL('../cloud-functions/game/'+rel,import.meta.url));
    assert.deepEqual(staged,source,rel);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),expected);
  }
  assert.equal(GAME_API_OPTIONS.region,'asia-northeast3');assert.equal(GAME_API_OPTIONS.minInstances,0);assert.equal(GAME_API_OPTIONS.maxInstances,1);assert.equal(GAME_API_OPTIONS.cors,false);
  const cloud=fs.readFileSync(new URL('../src/config/cloud.js',import.meta.url),'utf8');assert.match(cloud,/storageMode: 'functions'/);assert.match(cloud,/functionsActivation: 'deployment-verified'/);assert(!cloud.includes('chatgpt.site'));
  const cfg=JSON.parse(fs.readFileSync(new URL('../firebase.json',import.meta.url)));assert.deepEqual(Object.keys(cfg),['functions']);assert.equal(cfg.functions[0].runtime,'nodejs22');
  assert.match(fs.readFileSync(new URL('../server/firestore.rules',import.meta.url),'utf8'),/allow read, write: if false/);
});
