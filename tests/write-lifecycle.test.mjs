import test from 'node:test';
import assert from 'node:assert/strict';
import {FirestoreStore} from '../server/firestore.mjs';
import {FirestoreTransport, deferred, pause} from './support/firestore-transport.mjs';
const save=async tx=>{await tx.get('hd3d_progress','qa');await tx.put('hd3d_progress',{user_id:'qa',data:{souls:2}});return 2;};
function fixture(wrap=r=>r){const db=new FirestoreTransport({hd3d_progress:[{user_id:'qa',data:{souls:1}}]});const ac=new AbortController();return {db,ac,s:new FirestoreStore(wrap(db.request,ac),undefined,null,{signal:ac.signal})};}
test('already cancelled request never opens a transaction',async()=>{
 const {db,ac,s}=fixture();ac.abort();await assert.rejects(s.transaction(save),{name:'AbortError'});assert.equal(db.calls.length,0);
});
test('cancellation during begin still receives its token and rolls it back once without executing',async()=>{
 const {db,ac,s}=fixture((r,a)=>async(m,p,b,opts)=>{const result=await r(m,p,b);if(p.endsWith(':beginTransaction')){assert.equal(opts?.signal,undefined);a.abort();}return result;});
 await assert.rejects(s.transaction(save),{name:'AbortError'});assert.deepEqual(db.calls.map(c=>c.action),['beginTransaction','rollback']);assert.equal(db.txs.size,0);
});
test('cancellation before commit cannot publish buffered writes',async()=>{
 const {db,ac,s}=fixture();await assert.rejects(s.transaction(async tx=>{await save(tx);ac.abort();}),{name:'AbortError'});
 assert.equal(db.counts().commit,0);assert.equal(db.counts().rollback,1);assert.equal(db.rows('hd3d_progress')[0].data.souls,1);
});
test('malformed begin cannot fall through to a nontransactional commit',async()=>{
 let writes=0;const s=new FirestoreStore(async(_m,p)=>p.endsWith(':beginTransaction')?{}:(writes++,{}));
 await assert.rejects(s.transaction(tx=>tx.put('hd3d_progress',{user_id:'qa'})),/token missing/);assert.equal(writes,0);
});
test('failed read-only cleanup is attempted once and never reported as success',async()=>{
 const {db,s}=fixture();db.failRollback=true;await assert.rejects(s.readOnly(()=>7,[['hd3d_progress','qa']]),/rollback failed/);assert.equal(db.counts().rollback,1);
});
test('abort during commit does not cancel an ambiguous commit or replay it',async()=>{
 const entered=deferred(),release=deferred();
 const {db,ac,s}=fixture(r=>async(m,p,b,opts)=>{if(p.endsWith(':commit')){assert.equal(opts?.signal,undefined);entered.resolve();await release.promise;}return r(m,p,b);});
 const result=s.transaction(save);await entered.promise;ac.abort();release.resolve();assert.equal(await result,2);assert.equal(db.counts().commit,1);assert.equal(db.counts().rollback,0);assert.equal(db.rows('hd3d_progress')[0].data.souls,2);
});
test('commit response loss/503 stays uncertain, never automatically executes the transaction twice',async()=>{
 const {db,s}=fixture();db.loseCommitResponse=true;let executed=0;await assert.rejects(s.transaction(tx=>{executed++;return save(tx);}),{status:503});
 assert.equal(executed,1);assert.equal(db.counts().commit,1);assert.equal(db.rows('hd3d_progress')[0].data.souls,2);
});
test('ABORTED after cancellation rolls back and never begins the retry',async()=>{
 const {db,ac,s}=fixture();await assert.rejects(s.transaction(async tx=>{await save(tx);ac.abort();throw Object.assign(Error('conflict'),{code:'ABORTED',status:409});}));
 assert.equal(db.counts().begin,1);assert.equal(db.counts().rollback,1);
});
test('cancelled read is interruptible; cleanup uses a fresh, uncancelled request',async()=>{
 const started=deferred();const {db,ac,s}=fixture(r=>async(m,p,b,opts)=>{
  if(p.endsWith(':batchGet')){started.resolve();return new Promise((resolve,reject)=>{if(!opts?.signal)return resolve(r(m,p,b));opts.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true});});}
  if(p.endsWith(':rollback'))assert.equal(opts?.signal,undefined);return r(m,p,b);
 });
 const p=s.transaction(save);await started.promise;ac.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(db.counts().rollback,1);assert.equal(db.txs.size,0);
});
test('ordinary transaction errors clean up before a subsequent same-document writer',async()=>{
 const db=new FirestoreTransport({hd3d_progress:[{user_id:'qa',data:{souls:1}}]},{locks:true});const s=new FirestoreStore(db.request);
 await assert.rejects(s.transaction(async tx=>{await tx.get('hd3d_progress','qa');throw Error('application failed');}));
 assert.equal(db.txs.size,0);assert.equal(await s.transaction(save),2);assert.equal(db.counts().commit,1);
});
test('cancelled read-only snapshot still ends using its returned token',async()=>{
 const {db,ac,s}=fixture((r,a)=>async(m,p,b)=>{const x=await r(m,p,b);if(b.newTransaction)a.abort();return x;});
 await assert.rejects(s.readOnly(()=>1,[['hd3d_progress','qa']]),{name:'AbortError'});assert.equal(db.counts().rollback,1);assert.equal(db.counts().commit,0);assert.equal(db.txs.size,0);
});
test('one failed parallel read cancels and settles its sibling before rollback',async()=>{
 let siblingClosed=false,reads=0;const {db,s}=fixture(r=>async(m,p,b,opts)=>{
  if(p.endsWith(':batchGet')){if(++reads===1)throw Object.assign(Error('unavailable'),{status:503});return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>{siblingClosed=true;reject(new DOMException('cancelled','AbortError'));},{once:true}));}
  if(p.endsWith(':rollback'))assert.equal(siblingClosed,true);return r(m,p,b);
 });
 await assert.rejects(s.transaction(tx=>Promise.all([tx.get('hd3d_progress','qa'),tx.get('hd3d_users','qa')])),{status:503});assert.equal(db.counts().rollback,1);assert.equal(db.counts().commit,0);
});
test('cleanup failure preserves the original uncertain commit error without retry or success',async()=>{
 const {db,s}=fixture();db.failCommit=Object.assign(Error('unknown commit'),{status:503});db.failRollback=true;
 await assert.rejects(s.transaction(save),e=>e.status===503&&e.message==='unknown commit');assert.equal(db.counts().begin,1);assert.equal(db.counts().commit,1);assert.equal(db.counts().rollback,1);
});
