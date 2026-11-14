import assert from 'node:assert/strict';
const mem=new Map();let failWrite=false;
globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){}};
globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>{if(failWrite)throw Error('full');mem.set(k,v);},removeItem:k=>mem.delete(k)};
const Acc=await import('../src/account/account.js');
const {startDirectEntry,consumeDirectEntry,directEntryEnabled,pendingDirectEntry}=await import('../src/account/direct-spire-entry.js');
const {CLOUD}=await import('../src/config/cloud.js');
const key=u=>CLOUD.storagePrefix+'_spire_entry_'+u;
let calls=0,saved=null,history=[],mode='ok';const token=crypto.randomUUID();
const rpc=async(name,a)=>{calls++;history.push(a);if(mode==='throw')throw Error('lost');if(mode==='denied')return {error:{status:403}};if(mode==='malformed')return {data:{ok:true,token:'wrong'}};if(mode==='used')return {data:{ok:false,reason:'used'}};return {data:{ok:true,request:a.p_id,from:a.p_from,token,best:10,growth:!!a.p_growth}};};
Acc.A.user={id:'entry-a'};Acc.A.sb={atomicGear:true};assert(directEntryEnabled());
const save=o=>saved=o;
failWrite=true;assert((await startDirectEntry(rpc,1,1,save)).blocked);assert.equal(calls,0);failWrite=false;
mode='throw';assert((await startDirectEntry(rpc,1,1,save)).pending);const original=JSON.parse(mem.get(key('entry-a')));assert(original.request);assert.deepEqual(pendingDirectEntry(),{from:1});assert.equal(saved,null);
mode='denied';assert((await startDirectEntry(rpc,6,0,save)).blocked);assert.deepEqual(JSON.parse(mem.get(key('entry-a'))),original);
mode='malformed';assert((await startDirectEntry(rpc,6,0,save)).blocked);assert.equal(saved,null);
mode='ok';assert((await startDirectEntry(rpc,6,0,()=>{throw Error('session unavailable');})).pending);assert.equal(JSON.parse(mem.get(key('entry-a'))).token,token);
assert((await startDirectEntry(rpc,6,0,save)).data.ok);assert.equal(saved.from,1);assert.equal(saved.request,original.request);assert(history.every(x=>x.p_id===original.request&&x.p_from===1&&x.p_growth===1));
failWrite=true;assert.throws(()=>consumeDirectEntry(saved));assert(mem.has(key('entry-a')));failWrite=false;
consumeDirectEntry(saved);assert(!mem.has(key('entry-a')));assert.throws(()=>consumeDirectEntry(saved));
// Account switch during the reply may not attach A's token to B.
let release;const waiting=startDirectEntry(async(n,a)=>{await new Promise(r=>release=r);return {data:{ok:true,request:a.p_id,from:a.p_from,token}};},1,1,save);
await Promise.resolve();const before=saved;Acc.A.user={id:'entry-b'};release();assert((await waiting).blocked);assert.equal(saved,before);assert(mem.has(key('entry-a')));assert(!mem.has(key('entry-b')));assert.equal(pendingDirectEntry(),null);
mode='ok';assert((await startDirectEntry(rpc,1,1,save)).data.ok);assert.equal(saved.u,'entry-b');consumeDirectEntry(saved);
Acc.A.user={id:'entry-a'};mode='used';assert.equal((await startDirectEntry(rpc,1,1,save)).data.reason,'used');assert(!mem.has(key('entry-a')));
mem.set(key('entry-a'),'{bad');const n=calls;assert((await startDirectEntry(rpc,1,1,save)).blocked);assert.equal(calls,n);assert.equal(pendingDirectEntry(),null);mem.delete(key('entry-a'));
// Rapid clicks share the same durable intent; only one outstanding RPC.
let done;const slow=startDirectEntry(async(n,a)=>{await new Promise(r=>done=r);return {data:{ok:true,request:a.p_id,from:a.p_from,token}};},1,1,save);await Promise.resolve();assert((await startDirectEntry(rpc,1,1,save)).blocked);done();assert((await slow).data.ok);consumeDirectEntry(saved);
console.log('PASS 14 entry journal boundaries: durable before request, unknown/denied/malformed reply, session write failure, same options, consume failure, account isolation, terminal/corrupt state and rapid clicks');
