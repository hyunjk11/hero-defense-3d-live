import test from 'node:test';
import assert from 'node:assert/strict';
import { FirestoreStore } from '../server/firestore.mjs';
import * as O from '../server/operations.mjs';
import { MemoryStore } from '../server/memory-store.mjs';
import { handleGameApi } from '../server/http.mjs';
import { FirestoreTransport, deferred, pause } from './support/firestore-transport.mjs';
const now=Date.parse('2026-10-27T14:00:00Z'),iso=new Date(now).toISOString();
const user={id:'read-qa',email:'read@example.invalid',created_at:iso};
const select=(table='progress')=>({kind:'query',table:'hd3d_'+table,action:'select',filters:{}});
const rpc=name=>({kind:'rpc',name:'hd3d_'+name,args:{}});
const run=(s,u,op,options={})=>O.runOperation?O.runOperation(s,u,op,{now,...options}):s.transaction(tx=>O.execute(tx,u,op,{now,...options}));
function fixture({stale=false,empty=false,latency=0,locks=false,extra={}}={}){
 const db=new FirestoreTransport({hd3d_users:empty?[]:[{...user,last_sign_in_at:stale?'2026-10-26T00:00:00Z':iso}],hd3d_progress:[{user_id:user.id,data:{souls:11},merged:true,created_at:iso,updated_at:iso}],...extra},{latency,locks});
 return {db,s:new FirestoreStore(db.request)};
}
test('mature SELECT uses a fresh read-only snapshot with 3 REST calls, no writer or commit',async()=>{
 const {db,s}=fixture();const r=await run(s,user,select());assert.equal(r.data[0].data.souls,11);
 assert.deepEqual(db.counts(),{calls:3,begin:0,batchGet:1,query:1,commit:0,rollback:1,readOnly:1,readWrite:0,writes:0});assert.equal(db.txs.size,0);
});
test('my_status uses only one security batch and rollback',async()=>{
 const {db,s}=fixture();assert.equal((await run(s,user,rpc('my_status'))).data.admin,false);assert.equal(db.counts().calls,2);assert.equal(db.counts().readOnly,1);
});
test('six stale parallel reads coalesce metadata only, retain six independent permission snapshots',async()=>{
 const {db,s}=fixture({stale:true,latency:2});const ops=['progress','profiles','owned','orders','mail'].map(select).concat(rpc('my_status'));
 await Promise.all(ops.map(o=>run(s,user,o)));const n=db.counts();assert.equal(n.readOnly,6);assert.equal(n.readWrite,1);assert.equal(n.commit,1);assert.equal(db.rows('hd3d_users')[0].last_sign_in_at,iso);assert.equal(db.txs.size,0);
});
test('a held read snapshot does not block a concurrent save writer',async()=>{
 const {db,s}=fixture({locks:true});db.queryGate={enter:deferred(),release:deferred()};let settled=false;
 const read=run(s,user,select());await db.queryGate.enter.promise;
 const write=s.transaction(tx=>O.execute(tx,user,{...select(),action:'update',filters:{user_id:user.id,updated_at:iso},values:{data:{souls:12},merged:true},returning:true},{now})).then(x=>{settled=true;return x;});
 try{await pause(20);assert.equal(settled,true,'ordinary SELECT must not retain a lock that blocks a save');}finally{db.queryGate.release.resolve();await Promise.all([read,write]);}
 assert.equal(db.rows('hd3d_progress')[0].data.souls,12);
});
test('role revocation and bans are visible on the next request, while own read access is preserved',async()=>{
 const {db,s}=fixture({extra:{hd3d_admins:[{user_id:user.id,owner:false}],hd3d_mail:[{id:1,user_id:user.id},{id:2,user_id:'other'}]}});
 assert.equal((await run(s,user,select('mail'))).data.length,2);db.remove('hd3d_admins',user.id);
 assert.equal((await run(s,user,rpc('is_admin'))).data,false);assert.equal((await run(s,user,select('mail'))).data.length,1);
 db.seed('hd3d_admins',{user_id:user.id,owner:false});db.seed('hd3d_bans',{user_id:user.id,reason:'QA'});
 const status=(await run(s,user,rpc('my_status'))).data;assert.equal(status.admin,false);assert.equal(status.banned,true);
 await assert.rejects(run(s,user,rpc('growth_status')),{code:'42501'});db.remove('hd3d_bans',user.id);assert.equal((await run(s,user,rpc('is_admin'))).data,true);
});
test('new-user initialization is synchronous, single-flight, and never creates save or wallet data',async()=>{
 const {db,s}=fixture({empty:true,latency:2});await Promise.all(Array.from({length:6},()=>run(s,user,select('profiles'))));
 assert.equal(db.rows('hd3d_users').length,1);assert.equal(db.rows('hd3d_users')[0].email,user.email);assert.equal(db.rows('hd3d_users')[0].created_at,iso);assert.equal(db.counts().commit,1);assert.equal(db.rows('hd3d_growth_wallet').length,0);
});
test('metadata write failure is not a successful read and retry does not duplicate initialization',async()=>{
 const {db,s}=fixture({empty:true});db.failCommit=Object.assign(Error('offline'),{status:503});await assert.rejects(run(s,user,select('profiles')),{status:503});assert.equal(db.rows('hd3d_users').length,0);db.failCommit=null;
 await run(s,user,select('profiles'));assert.equal(db.rows('hd3d_users').length,1);
});
test('denied read never initializes a user or leaks admin data',async()=>{
 const {db,s}=fixture({empty:true});await assert.rejects(run(s,user,select('admin_log')),{code:'42501'});assert.equal(db.rows('hd3d_users').length,0);assert.equal(db.counts().commit,0);
});
test('account identities and separate backend scopes are not merged',async()=>{
 const {db,s}=fixture({empty:true,latency:2});const b={...user,id:'read-b',email:'b@example.invalid'};
 await Promise.all([run(s,user,select('profiles')),run(s,b,select('profiles'))]);assert.deepEqual(db.rows('hd3d_users').map(x=>x.id).sort(),[user.id,b.id].sort());
 const other=fixture({empty:true,latency:2});await Promise.all([run(s,user,select()),run(other.s,user,select())]);assert.equal(other.db.rows('hd3d_users').length,1);
});
test('snapshot retains consistent role/data and subsequent request sees changes',async()=>{
 const {db,s}=fixture({extra:{hd3d_admins:[{user_id:user.id,owner:false}],hd3d_mail:[{id:1,user_id:'other'}]}});db.queryGate={enter:deferred(),release:deferred()};const p=run(s,user,select('mail'));await db.queryGate.enter.promise;
 db.remove('hd3d_admins',user.id);db.seed('hd3d_mail',{id:2,user_id:'other'});db.queryGate.release.resolve();assert.equal((await p).data.length,1);db.queryGate=null;assert.equal((await run(s,user,select('mail'))).data.length,0);
});
test('only explicit pure operations qualify; growth status and all mutation paths stay transactional',()=>{
 assert.equal(typeof O.isReadOperation,'function');
 for(const op of [null,[],{},select('users'),{...select(),action:'update'},rpc('growth_status'),rpc('growth_invest'),rpc('growth_progress'),rpc('dungeon_status'),rpc('spire_status'),rpc('admin_users'),rpc('owner_admins')])assert.equal(O.isReadOperation(op),false);
 for(const op of [select(),select('admin_log'),rpc('my_status'),rpc('is_admin'),rpc('is_owner'),rpc('is_banned')])assert.equal(O.isReadOperation(op),true);
});
test('read-only adapters reject accidental put/remove/insert and incomplete permission snapshots fail closed',async()=>{
 const {db,s}=fixture();for(const mutate of [tx=>tx.put('hd3d_users',user),tx=>tx.remove('hd3d_users',user.id),tx=>tx.insert('hd3d_orders',{user_id:user.id})]){
  await assert.rejects(s.readOnly(mutate,[['hd3d_users',user.id]]),/read-only/);
  await assert.rejects(new MemoryStore().readOnly(mutate),/read-only/);
 }
 db.transformBatch=rows=>rows.filter(r=>!(r.missing||'').includes('/hd3d_bans/'));
 await assert.rejects(run(s,user,select()),/Incomplete read snapshot/);assert.equal(db.txs.size,0);
});
test('coalescing shares only an identical verified identity and logical backend',async()=>{
 const {db}=fixture({stale:true,latency:2});const scope={};const a=new FirestoreStore(db.request,undefined,scope),b=new FirestoreStore(db.request,undefined,scope);
 await Promise.all([run(a,user,select()),run(b,user,select('profiles'))]);assert.equal(db.counts().commit,1);assert.equal(db.counts().readOnly,2);
 const changed={...user,email:'new@example.invalid'};await run(b,changed,select('profiles'));assert.equal(db.rows('hd3d_users')[0].email,changed.email);
});
test('metadata commit then lost response is safely retried without another write',async()=>{
 const {db,s}=fixture({empty:true});db.loseCommitResponse=true;await assert.rejects(run(s,user,select()),{status:503});assert.equal(db.rows('hd3d_users').length,1);
 await Promise.all([run(s,user,select()),run(s,user,select())]);assert.equal(db.counts().commit,1);assert.equal(db.rows('hd3d_users')[0].last_sign_in_at,iso);
});
test('failed metadata flight propagates to all waiters and is removed for retry',async()=>{
 const {db,s}=fixture({empty:true,latency:2});db.failCommit=Object.assign(Error('offline'),{status:503});
 const r=await Promise.allSettled([run(s,user,select()),run(s,user,select())]);assert.ok(r.every(x=>x.status==='rejected'));assert.equal(db.counts().commit,1);
 db.failCommit=null;await run(s,user,select());assert.equal(db.rows('hd3d_users').length,1);assert.equal(db.counts().commit,2);
});
test('metadata threshold and created-at semantics unchanged; no deferred background write',async()=>{
 const {db,s}=fixture();await run(s,user,select(),{now:now+1800000});assert.equal(db.counts().commit,0);
 await run(s,user,select(),{now:now+1800001});assert.equal(db.counts().commit,1);assert.equal(db.rows('hd3d_users')[0].created_at,iso);assert.equal(db.rows('hd3d_users')[0].last_sign_in_at,new Date(now+1800001).toISOString());
});
test('HTTP handler dispatches ordinary reads through the new path without weakening identity validation',async()=>{
 const {db,s}=fixture();const fetchBefore=globalThis.fetch;const seconds=Math.floor(Date.now()/1000);
 const token='fake.'+Buffer.from(JSON.stringify({aud:'hero-defense-3d-independent',iss:'https://securetoken.google.com/hero-defense-3d-independent',sub:user.id,iat:seconds,exp:seconds+300})).toString('base64url')+'.not-a-signature';
 globalThis.fetch=async url=>{assert.ok(String(url).startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup?'));return Response.json({users:[{localId:user.id,email:user.email,createdAt:String(now)}]});};
 // Make the fixture timestamp fresh for the handler's real clock.
 db.seed('hd3d_users',{...user,last_sign_in_at:new Date().toISOString()});
 try{const r=await handleGameApi(new Request('https://game.invalid/api/game',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(select())}),{},{store:s});assert.equal(r.status,200);assert.equal((await r.json()).data[0].data.souls,11);assert.equal(db.counts().readOnly,1);assert.equal(db.counts().calls,3);}finally{globalThis.fetch=fetchBefore;}
});
test('new dispatcher preserves growth migration, CAS, concurrent investments and repeated rewards',async()=>{
 const s=new MemoryStore({hd3d_progress:[{user_id:user.id,data:{souls:77,st:{'1-1':3}},merged:true,updated_at:iso,created_at:iso}]});
 const call=(name,args={},opts={})=>run(s,user,{...rpc(name),args},opts).then(r=>r.data);
 const first=await Promise.all([call('growth_status'),call('growth_status'),run(s,user,select())]);assert.deepEqual(first[0].growth,first[1].growth);assert.equal(s.tables.hd3d_growth_wallet.length,1);assert.equal(s.tables.hd3d_users.length,1);
 const w=s.tables.hd3d_growth_wallet[0];w.balance=100;w.granted=100; // isolated server fixture, never production
 const purchases=await Promise.all([call('growth_invest',{p_id:'invest-read-0001',p_hero:'mage',p_level:2,p_revision:w.rev}),call('growth_invest',{p_id:'invest-read-0002',p_hero:'warrior',p_level:2,p_revision:w.rev}),run(s,user,select())]);
 assert.equal(purchases.filter(x=>x.ok).length,1);assert.equal(s.tables.hd3d_growth_wallet[0].balance,0);assert.equal(s.tables.hd3d_growth_investments.length,1);
 const a={p_id:'run-read-000001',p_mode:'campaign',p_stage:'1-1',p_hero:'mage'};await call('growth_start',a);
 const args={p_token:a.p_id,p_completed:1,p_win:false,p_finish:false};const credits=await Promise.all([call('growth_progress',args,{now:now+10000}),call('growth_progress',args,{now:now+10000}),run(s,user,select())]);assert.equal(credits[0].xp,10);assert.equal(credits[1].xp,10);assert.equal(s.tables.hd3d_growth_wallet[0].balance,10);
 const save={...select(),action:'update',filters:{user_id:user.id,updated_at:iso},values:{data:{souls:78},merged:true},returning:true};const saves=await Promise.all([run(s,user,save),run(s,user,save)]);assert.equal(saves.filter(x=>x.data.length===1).length,1);assert.equal(s.tables.hd3d_progress[0].data.souls,78);assert.equal(s.tables.hd3d_growth_wallet[0].balance,10);
});
test('independent isolate scopes still initialize one durable user under real concurrent version conflicts',async()=>{
 const {db}=fixture({empty:true,latency:2});const stores=Array.from({length:6},()=>new FirestoreStore(db.request,undefined,{}));
 await Promise.all(stores.map(s=>run(s,user,select())));
 assert.equal(db.rows('hd3d_users').length,1);assert.equal(db.rows('hd3d_users')[0].last_sign_in_at,iso);assert.equal(db.rows('hd3d_progress')[0].data.souls,11);assert.equal(db.txs.size,0);
 assert.equal(db.counts().readOnly,6);assert.ok(db.counts().readWrite>1,'this case must not share the in-isolate flight');
});
test('concurrent account reads never share saves or query permissions',async()=>{
 const b={...user,id:'other-account',email:'other@example.invalid'};
 const {db,s}=fixture({extra:{hd3d_progress:[{user_id:user.id,data:{souls:11}},{user_id:b.id,data:{souls:999}}],hd3d_users:[{...user,last_sign_in_at:iso},{...b,last_sign_in_at:iso}]}});
 const [aResult,bResult]=await Promise.all([run(s,user,select()),run(s,b,select())]);assert.deepEqual(aResult.data.map(x=>x.data.souls),[11]);assert.deepEqual(bResult.data.map(x=>x.data.souls),[999]);assert.equal(db.counts().commit,0);
});
