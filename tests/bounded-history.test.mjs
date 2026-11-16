import test from 'node:test';
import assert from 'node:assert/strict';
import {FirestoreStore,ROOT,fromDocument} from '../server/firestore.mjs';
import {FirestoreTransport} from './support/firestore-transport.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import * as P from '../src/account/progress.js';
const now=1800000000000,iso=new Date(now).toISOString(),user={id:'history-a',email:'a@example.invalid'};
// REST model includes field-existence, type-aware range and exact cursor behavior.
// No live service, account, credentials or writes outside this memory model.
class HistoryTransport extends FirestoreTransport{
 constructor(tables,options){super(tables,options);this.returned=0;}
 async request(method,path,body){
  const action=path.slice(path.lastIndexOf(':')+1);
  if(!['runQuery','runAggregationQuery'].includes(action))return super.request(method,path,body);
  this.calls.push({action,path,body:structuredClone(body)});
  if(action==='runQuery'&&this.noDungeonIndex&&body.structuredQuery.from[0].collectionId==='hd3d_dungeon_runs'&&body.structuredQuery.where?.compositeFilter)throw Object.assign(Error('index building'),{code:'FAILED_PRECONDITION'});
  if(action==='runAggregationQuery'&&this.noIndex)throw Object.assign(Error('index building'),{code:'FAILED_PRECONDITION'});
  if(action==='runAggregationQuery'&&this.permissionFailure)throw Object.assign(Error('denied'),{code:'PERMISSION_DENIED',status:403});
  const tx=this.txs.get(body.transaction);assert(tx);assert.equal(path,this.root+':'+action);
  const q=body.structuredQuery||body.structuredAggregationQuery.structuredQuery;
  const filters=q.where?.compositeFilter?.filters||(q.where?[q.where]:[]),value=x=>x?.stringValue??x?.referenceValue??(x?.integerValue!==undefined?Number(x.integerValue):undefined);
  let docs=[...tx.docs.values()].filter(d=>d.name.startsWith(this.root+'/'+q.from[0].collectionId+'/')&&filters.every(f=>{const x=d.fields[f.fieldFilter.field.fieldPath],y=f.fieldFilter.value;
   return f.fieldFilter.op==='EQUAL'?JSON.stringify(x)===JSON.stringify(y):typeof value(x)===typeof value(y)&&value(x)>=value(y);
  }));
  const order=q.orderBy||[{field:{fieldPath:'__name__'},direction:'ASCENDING'}];
  const values=d=>order.map(o=>o.field.fieldPath==='__name__'?d.name:value(d.fields[o.field.fieldPath]));
  docs=docs.filter(d=>values(d).every(x=>x!==undefined));
  const compare=(a,b)=>{for(let i=0;i<order.length;i++){if(a[i]===b[i])continue;return (a[i]<b[i]?-1:1)*(order[i].direction==='DESCENDING'?-1:1);}return 0;};
  docs.sort((a,b)=>compare(values(a),values(b)));
  if(q.startAt){const cursor=q.startAt.values.map(value);docs=docs.filter(d=>compare(values(d),cursor)>(q.startAt.before?-1:0));}
  if(q.limit)docs=docs.slice(0,q.limit);
  if(action==='runAggregationQuery')return [{result:{aggregateFields:{total:{integerValue:String(docs.length)}}}}];
  this.returned+=docs.length;for(const d of docs)this.read(tx,d.name);
  return docs.map(document=>({document:structuredClone(document)}));
 }
}
const mail=(i,extra={})=>({id:i,user_id:user.id,created_at:new Date(now+i*1000).toISOString(),claimed:true,reward:{souls:10},...extra});
function fixture(mails=[],more={}){const db=new HistoryTransport({hd3d_users:[{...user,last_sign_in_at:iso}],hd3d_progress:[{user_id:user.id,data:P.empty(),updated_at:iso}],hd3d_mail:mails,...more});const store=new FirestoreStore(db.request);return {db,call:op=>runEconomyOperation(store,user,op,{now}),store};}
const query=(f,archived=false,limit=100)=>f.call({kind:'query',table:'hd3d_mail',action:'select',filters:{user_id:user.id,archived},order:{field:'created_at',ascending:false},limit});
const rpc=(f,name,args={})=>f.call({kind:'rpc',name:'hd3d_'+name,args});
const expected=(mails,archived=false,limit=100)=>mails.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))).filter(m=>!!m.archived_at===archived).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,limit).map(m=>m.id);

test('small inbox stays one query and legacy absent archive flag remains visible',async()=>{
 const mails=[mail(1),mail(2,{archived_at:'old'}),mail(3,{claimed:false})],f=fixture(mails),before=structuredClone(f.db.rows('hd3d_mail'));
 assert.deepEqual((await query(f)).data.map(m=>m.id),[3,1]);assert.equal(f.db.returned,3);assert.equal(f.db.calls.filter(x=>x.action==='runQuery').length,1);assert.equal(f.db.calls.filter(x=>x.action==='runAggregationQuery').length,0);assert.deepEqual(f.db.rows('hd3d_mail'),before);
});
test('large recent inbox bounds document transfer, same output and no mailbox writes',async()=>{
 const mails=Array.from({length:5000},(_,i)=>mail(i+1)),f=fixture(mails);
 assert.deepEqual((await query(f)).data.map(m=>m.id),expected(mails));assert.equal(f.db.returned,256);
 assert.equal(f.db.calls.filter(x=>x.action==='runQuery').length,2);assert.equal(f.db.calls.filter(x=>x.action==='runAggregationQuery').length,2);assert.equal(f.db.counts().commit,0);
});
test('archive filtering fills pages across long hidden runs and timestamp ties without skips',async()=>{
 const mails=Array.from({length:800},(_,i)=>mail(i+1,{created_at:iso,...(i%4!==0?{archived_at:iso}:{})})),f=fixture(mails);
 assert.deepEqual((await query(f)).data.map(m=>m.id),expected(mails));
 const ordered=f.db.calls.filter(x=>x.action==='runQuery'&&x.body.structuredQuery.orderBy);assert(ordered.length>1);assert(ordered.slice(1).every(x=>x.body.structuredQuery.startAt.values.length===2));
 assert.deepEqual((await query(f,true)).data.map(m=>m.id),expected(mails,true));
});
test('missing or nonstring legacy sort fields fall back to complete old semantics',async()=>{
 for(const type of ['missing','number']){const mails=Array.from({length:160},(_,i)=>mail(i+1,{archived_at:iso}));const old=mail(161);if(type==='missing')delete old.created_at;else old.created_at=7;mails.push(old);const f=fixture(mails);
 assert.deepEqual((await query(f)).data.map(m=>m.id),[161]);assert(f.db.calls.some(x=>x.action==='runQuery'&&!x.body.structuredQuery.limit));assert.equal(f.db.counts().commit,0);}
});
test('not-yet-built index falls back, permission failure is not hidden',async()=>{
 const mails=Array.from({length:150},(_,i)=>mail(i+1));const f=fixture(mails);f.db.noIndex=true;assert.deepEqual((await query(f)).data.map(m=>m.id),expected(mails));
 const bad=fixture(mails);bad.db.permissionFailure=true;await assert.rejects(query(bad),{code:'PERMISSION_DENIED'});
});
test('dungeon status scans today only, start abandons old active but preserves all history',async()=>{
 const day=new Date(now+9*3600000).toISOString().slice(0,10),runs=Array.from({length:1000},(_,i)=>({id:i+1,user_id:user.id,day:'2020-01-01',status:i===0?'active':'done',started_at:iso}));
 const f=fixture([],{hd3d_dungeon_runs:runs,hd3d_sequences:[{id:'hd3d_dungeon_runs',value:1000}]});const status=await rpc(f,'dungeon_status');assert.equal(status.data.used,0);assert.equal(f.db.returned,128);
 await rpc(f,'dungeon_start');assert.equal(f.db.rows('hd3d_dungeon_runs').length,1001);assert.equal(f.db.rows('hd3d_dungeon_runs').find(r=>r.id===1).status,'abandoned');
 assert.deepEqual(f.db.rows('hd3d_dungeon_runs').filter(r=>r.id>1&&r.id<=1000),runs.slice(1));
 assert.equal((await rpc(f,'dungeon_status')).data.used,1);const result=await rpc(f,'dungeon_start');assert.equal(result.data.reason,'daily_limit');
 const runQueries=f.db.calls.filter(x=>x.action==='runQuery'&&x.body.structuredQuery.from[0].collectionId==='hd3d_dungeon_runs');assert(runQueries.every(x=>x.body.structuredQuery.limit===128||x.body.structuredQuery.where.compositeFilter.filters.length===2));
 assert(runQueries.some(x=>x.body.structuredQuery.where.compositeFilter?.filters.some(f=>f.fieldFilter.field.fieldPath==='day'&&f.fieldFilter.value.stringValue===day)));
});

test('dungeon index fallback preserves today and active-state semantics',async()=>{
 const day=new Date(now+9*3600000).toISOString().slice(0,10),runs=[{id:1,user_id:user.id,day,status:'done'},{id:2,user_id:user.id,day:'old',status:'active'}];
 const f=fixture([],{hd3d_dungeon_runs:runs});f.db.noDungeonIndex=true;
 assert.equal((await rpc(f,'dungeon_status')).data.used,1);assert.equal((await rpc(f,'dungeon_start')).data.reason,'daily_limit');assert.deepEqual(f.db.rows('hd3d_dungeon_runs'),runs);
});
test('large archive scan keeps an immutable snapshot while new mail arrives',async()=>{
 const mails=Array.from({length:500},(_,i)=>mail(i+1,{created_at:iso,...(i%3?{archived_at:iso}:{})})),f=fixture(mails),original=f.db.request.bind(f.db);let inserted=false;
 f.store.request=async (...args)=>{const result=await original(...args);if(args[2]?.structuredQuery?.orderBy&&!inserted){inserted=true;f.db.seed('hd3d_mail',mail(9999));}return result;};
 assert.deepEqual((await query(f)).data.map(m=>m.id),expected(mails));assert.equal((await query(f)).data[0].id,9999);
});

test('legacy top-level index omission keeps payload mail and dungeon daily-limit/active records',async()=>{
 const mails=Array.from({length:160},(_,i)=>mail(i+1,{archived_at:iso}));mails.push(mail(161));const f=fixture(mails);
 const old=f.db.docs.get(ROOT+'/hd3d_mail/161');delete old.fields.created_at;
 assert.deepEqual((await query(f)).data.map(m=>m.id),[161]);
 const day=new Date(now+9*3600000).toISOString().slice(0,10);
 const runs=Array.from({length:160},(_,i)=>({id:i+1,user_id:user.id,day:i===0?day:'old',status:i===0?'active':'done'}));
 const d=fixture([],{hd3d_dungeon_runs:runs,hd3d_sequences:[{id:'hd3d_dungeon_runs',value:160}]});
 delete d.db.docs.get(ROOT+'/hd3d_dungeon_runs/1').fields.day;
 assert.equal((await rpc(d,'dungeon_status')).data.used,1);assert.equal((await rpc(d,'dungeon_start')).data.reason,'daily_limit');
 const e=fixture([],{hd3d_dungeon_runs:runs.map(r=>({...r,day:'old'})),hd3d_sequences:[{id:'hd3d_dungeon_runs',value:160}]});
 delete e.db.docs.get(ROOT+'/hd3d_dungeon_runs/1').fields.status;
 await rpc(e,'dungeon_start');assert.equal(e.db.rows('hd3d_dungeon_runs').find(r=>r.id===1).status,'abandoned');assert.equal(e.db.rows('hd3d_dungeon_runs').length,161);
});
test('small dungeon today/active lookup shares one complete probe inside start',async()=>{
 const f=fixture([]);assert((await rpc(f,'dungeon_start')).data.ok);
 assert.equal(f.db.calls.filter(x=>x.action==='runQuery'&&x.body.structuredQuery.from[0].collectionId==='hd3d_dungeon_runs').length,1);
 assert.equal(f.db.calls.filter(x=>x.action==='runAggregationQuery').length,0);
});
