import assert from 'node:assert/strict';
const old=new Map([
 ['hd3d_independent_save',JSON.stringify({v:4,souls:777777,st:{'10-6':3}})],
 ['hd3d_independent_uid','old-user'],['hd3d_independent_dirty','1'],
 ['hd3d_independent_pending_old-user',JSON.stringify({data:{v:4,souls:888888}})],
 ['hd3d_independent_growth_v1_old-user','old-growth'],['hd3d_lastRun','old-result'],
 ['hd3d_seenMon','["old"]'],['hd3d_audio','{"sfxOn":false}'],['hd3d_best','99']]);
const memory=new Map(old),seen=[];
globalThis.localStorage={getItem:k=>(seen.push(['get',k]),memory.get(k)||null),setItem:(k,v)=>(seen.push(['set',k]),memory.set(k,v)),removeItem:k=>(seen.push(['remove',k]),memory.delete(k))};
globalThis.addEventListener=()=>{};
globalThis.document={addEventListener(){},visibilityState:'visible'};
const Acc=await import('../src/account/account.js');
assert.equal(Acc.load().souls,0);assert.deepEqual(Acc.load().st,{});
const fresh=Acc.load();fresh.nick='새 시작';Acc.store(fresh,{cloud:false});
assert.equal(Acc.load().nick,'새 시작');assert(memory.has('hd3d_live_save'));
for(const [k,v]of old)assert.equal(memory.get(k),v);
assert(seen.every(([,k])=>k.startsWith('hd3d_live')));
console.log(JSON.stringify({pass:true,oldKeysPreserved:old.size,operations:seen.length,oldKeyReads:0,network:false}));
