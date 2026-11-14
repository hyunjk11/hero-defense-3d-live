import assert from 'node:assert/strict';
const values=new Map(), session=new Map();
const storage=m=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});
globalThis.localStorage=storage(values); globalThis.sessionStorage=storage(session);
globalThis.addEventListener=()=>{}; globalThis.document={addEventListener(){},visibilityState:'visible'};
globalThis.location={search:'',hostname:'localhost'};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async (k,f)=>f()}},configurable:true});
const Acc=await import('../src/account/account.js'), D=await import('../src/account/dungeon.js');
Acc.playGuest();
assert.equal((await D.dgStatus()).left,1);
const entered=await D.dgStart(); assert.equal(entered.mode,'local');
assert.equal((await D.dgStart()).blocked,true);
assert.equal(D.takeEntry().token,entered.token); assert.equal(D.takeEntry().mode,'practice');
assert.equal((await D.dgFinishLocal(entered.token,3,false)).souls,700);
assert.equal((await D.dgFinishLocal(entered.token,5,true)).souls,700); assert.equal(Acc.load().souls,700);
assert.equal((await D.dgStatus()).left,0);
// No network call touches a real account; check client recovery and identity handling.
let fail=true, calls=0;
Acc.A.user={id:'test-owner'};
Acc.A.sb={rpc:async name=>{
  if(name==='hd3d_dungeon_finish') {calls++;return fail?{error:{message:'temporary unavailable'}}:{data:{ok:true,souls:2000,mail:9,medals:15,total:15,floors:5,win:true}};}
  if(name==='hd3d_dungeon_status')return {data:{ok:true,limit:1,left:0,used:1,medals:15}};
  return {error:{message:'unavailable'}};
}};
assert.equal((await D.dgStart()).blocked,true, 'network errors must not issue reward-bearing entries');
const token='44444444-4444-4444-8444-444444444444';
assert.equal((await D.dgFinish(token,5,true)).ok,false);
const key='hd3d_live_dgfinish_test-owner'; assert.ok(values.get(key));
fail=false; await D.dgStatus(); assert.equal(calls,2); assert.equal(values.has(key),false);
assert.equal(D.DGS.limit,1); assert.equal(D.DGS.medals,15);
assert.equal((await D.dgFinishLocal(entered.token,5,true)).ok,false,'account switch cannot award guest souls');
Acc.A.user=null;
console.log('PASS client one-entry flow, reload protection, partial reward, retry recovery and account isolation');
