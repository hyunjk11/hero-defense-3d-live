import test from 'node:test';
import assert from 'node:assert/strict';
import {FirestoreStore} from '../server/firestore.mjs';
import {runOperation} from '../server/operations.mjs';
import {FirestoreTransport} from './support/firestore-transport.mjs';
const now=Date.parse('2026-10-27T20:00:00Z'),iso=new Date(now).toISOString(),user={id:'write-qa',email:'fake@example.invalid',created_at:iso};
const rpc=(name,args={})=>({kind:'rpc',name:'hd3d_growth_'+name,args});
const save=value=>({kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:iso},values:{data:{souls:value},merged:true},returning:true});
function fixture(){const db=new FirestoreTransport({hd3d_users:[{...user,last_sign_in_at:iso}],hd3d_progress:[{user_id:user.id,data:{souls:11},merged:true,updated_at:iso}]},{latency:1});const call=(op,time=now)=>runOperation(new FirestoreStore(db.request),user,op,{now:time}).then(r=>r.data);return {db,call};}
test('two independent devices with the same CAS never overwrite each other silently',async()=>{
 const {db,call}=fixture();const results=await Promise.all([call(save(12)),call(save(13))]);assert.equal(results.filter(r=>r.length===1).length,1);assert.equal(results.filter(r=>r.length===0).length,1);assert.ok([12,13].includes(db.rows('hd3d_progress')[0].data.souls));assert.equal(db.txs.size,0);
});
test('lost save response remains ambiguous; old CAS replay fails and cloud read reveals the acknowledged snapshot',async()=>{
 const {db,call}=fixture();db.loseCommitResponse=true;await assert.rejects(call(save(12)),{status:503});assert.equal(db.counts().commit,1);
 assert.deepEqual(await call(save(12)),[]);assert.equal(db.counts().commit,1);assert.equal(db.rows('hd3d_progress')[0].data.souls,12);
});
test('concurrent XP recovery after lost response grants one checkpoint, preserving independent progress',async()=>{
 const {db,call}=fixture();await call(rpc('status'));const id='qa-write-run-0001';await call(rpc('start',{p_id:id,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'}));
 const checkpoint=rpc('progress',{p_token:id,p_completed:1,p_win:false,p_finish:false});db.loseCommitResponse=true;
 await assert.rejects(call(checkpoint,now+10000),{status:503});const before=db.rows('hd3d_growth_wallet')[0].balance;
 const replies=await Promise.all([call(checkpoint,now+10000),call(checkpoint,now+10000),call(save(12),now+10000)]);
 assert.equal(replies[0].xp,10);assert.equal(replies[1].xp,10);assert.equal(db.rows('hd3d_growth_wallet')[0].balance,before);assert.equal(db.rows('hd3d_progress')[0].data.souls,12);assert.equal(db.txs.size,0);
});
test('two devices compete for a single level purchase; lost-response receipt replay never charges again',async()=>{
 const {db,call}=fixture();await call(rpc('status'));const wallet=db.rows('hd3d_growth_wallet')[0];wallet.balance=100;wallet.granted=100;db.seed('hd3d_growth_wallet',wallet); // offline fixture only
 const a=rpc('invest',{p_id:'qa-write-invest-a',p_hero:'mage',p_level:2,p_revision:wallet.rev}),b=rpc('invest',{p_id:'qa-write-invest-b',p_hero:'warrior',p_level:2,p_revision:wallet.rev});
 const r=await Promise.all([call(a),call(b)]);assert.equal(r.filter(x=>x.ok).length,1);assert.equal(db.rows('hd3d_growth_wallet')[0].balance,0);assert.equal(db.rows('hd3d_growth_investments').length,1);
 const winning=r[0].ok?a:b;assert.equal((await call(winning)).ok,true);assert.equal(db.rows('hd3d_growth_wallet')[0].balance,0);assert.equal(db.rows('hd3d_growth_investments').length,1);
});
