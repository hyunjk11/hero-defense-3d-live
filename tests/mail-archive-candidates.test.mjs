import test from 'node:test';
import assert from 'node:assert/strict';
import {runEconomyOperation} from '../server/economy.mjs';
import {FirestoreStore} from '../server/firestore.mjs';
import {MemoryStore} from '../server/memory-store.mjs';
import {FirestoreTransport,deferred} from './support/firestore-transport.mjs';
const now=Date.parse('2026-11-20T04:00:00Z');
const user={id:'candidate-owner',email:'owner@example.invalid'},other={id:'candidate-other',email:'other@example.invalid'};
const row=(id,props={})=>({id,user_id:user.id,claimed:true,created_at:new Date(now).toISOString(),reward:{souls:10},...props});
const op=(name,args)=>({kind:'rpc',name:'hd3d_'+name,args});
const call=(db,name,args,as=user)=>runEconomyOperation(db,as,op(name,args),{now}).then(r=>r.data);
const candidates=(db,restore,as=user)=>call(db,'mail_archive_candidates',{p_restore:restore},as);

test('full mailbox selection is sorted, owner-scoped, no writes; archive and undo use existing bounded API',async()=>{
 const expected=Array.from({length:241},(_,i)=>i+1);
 const rows=expected.slice().reverse().map(n=>row(n));
 rows.push(row(242,{claimed:false}),row(243,{archived_at:'older'}),row(244,{user_id:other.id}),row('245'),row(0),row(-1));
 const db=new MemoryStore({hd3d_mail:rows}),original=structuredClone(db.tables);
 assert.deepEqual(await candidates(db,false),{ok:true,ids:expected});
 assert.deepEqual(await candidates(db,true),{ok:true,ids:[243]});
 assert.deepEqual(await candidates(db,false,other),{ok:true,ids:[244]});
 assert.deepEqual(db.tables,original);
 const mismatch=await call(db,'mail_archive',{p_ids:[242,244]});
 assert.deepEqual(mismatch.skipped,[242,244]);
 for(let i=0;i<expected.length;i+=97)
  assert.deepEqual((await call(db,'mail_archive',{p_ids:expected.slice(i,i+97)})).ids,expected.slice(i,i+97));
 assert.deepEqual(await candidates(db,false),{ok:true,ids:[]});
 assert.deepEqual(await candidates(db,true),{ok:true,ids:[...expected,243]});
 for(let i=0;i<expected.length;i+=97)await call(db,'mail_archive',{p_ids:expected.slice(i,i+97),p_restore:true});
 assert.deepEqual(db.tables.hd3d_mail,original.hd3d_mail);
});
test('requires bool and rejects attempts to target a different account or use unverified identity',async()=>{
 const db=new MemoryStore({hd3d_mail:[row(1)]});
 for(const args of [{},{p_restore:1},{p_restore:'false'},{p_restore:false,user_id:other.id},[]]){
  await assert.rejects(call(db,'mail_archive_candidates',args),{code:'23514'});
 }
 await assert.rejects(candidates(db,false,null),{code:'42501'});
 db.tables.hd3d_bans=[{user_id:user.id}];
 await assert.rejects(candidates(db,false),{code:'42501'});
 assert.equal(db.tables.hd3d_users,undefined);
});
test('Firestore uses one read-only snapshot, no metadata writes, and a later message is not selected',async()=>{
 const expected=Array.from({length:132},(_,i)=>i+1);
 const db=new FirestoreTransport({hd3d_mail:[...expected.slice().reverse().map(id=>row(id)),row(133,{claimed:false}),row(134,{user_id:other.id}),row(135,{archived_at:'older'})]});
 const store=new FirestoreStore(db.request);
 db.queryGate={enter:deferred(),release:deferred()};
 const pending=candidates(store,false);
 await db.queryGate.enter.promise;
 try{await store.transaction(tx=>tx.put('hd3d_mail',row(136)));}finally{db.queryGate.release.resolve();}
 assert.deepEqual((await pending).ids,expected);
 assert.equal(db.counts().readOnly,1);
 assert.equal(db.counts().commit,1); // Only the explicitly simulated writer.
 assert.equal(db.rows('hd3d_users').length,0);
 assert.deepEqual((await candidates(store,false)).ids,[...expected,136]);
 assert.equal(db.counts().commit,1);
});

test('PC exact cleanup cannot acquire an undo receipt for a row already archived elsewhere',async()=>{
 const db=new MemoryStore({hd3d_mail:[
  {id:1,user_id:user.id,claimed:true,created_at:new Date(now).toISOString(),archived_at:'earlier'},
  {id:2,user_id:user.id,claimed:true,created_at:new Date(now).toISOString()},
 ]});
 const result=await call(db,'mail_archive',{p_ids:[1,2],p_only_new:true});
 assert.deepEqual(result.ids,[2]);assert.deepEqual(result.skipped,[1]);
 assert.equal(db.tables.hd3d_mail.find(x=>x.id===1).archived_at,'earlier');
 assert.deepEqual((await call(db,'mail_archive',{p_ids:[1]})).ids,[1]);
});
