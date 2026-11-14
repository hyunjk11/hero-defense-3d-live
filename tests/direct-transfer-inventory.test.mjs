import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROOT,numericTables} from '../server/firestore.mjs';
import {hash,directRoot,legacyTables} from '../direct/global-migration-plan.mjs';
import {encodeFields,decodeFields} from '../src/account/direct-store.js';
import {validateInventory,legacyExport,prepareTransfer,transferStep,rollbackSource,prepareRollback,relocate,inventoryHash} from '../direct/transfer/plan.mjs';
import {executeTransfer} from '../direct/transfer/execute.mjs';
import {firestoreStore} from '../direct/transfer/transport.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/direct-transfer-inventory.json',import.meta.url),'utf8'));
const assurance={writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true,fenceId:'offline-file-fixture'};
const source=legacyExport(fixture,assurance),job=prepareTransfer(source,assurance),at=fixture.snapshot.readTime;
const cases=[];async function test(name,fn){await fn();cases.push(name);console.log('PASS inventory '+name);}
const copy=x=>structuredClone(x);
function snap(docs){const documents=copy(docs).map(d=>({...d,updateTime:at})),collections={};for(const d of documents){const c=d.name.slice(ROOT.length+1).split('/').slice(0,-1).join('/');collections[c]=(collections[c]||0)+1;}return {format:1,documents,snapshot:{...fixture.snapshot,collections}};}
await test('production-shaped file preserves all tables including zero counts and sequences',()=>{
 assert.equal(source.documents.length,20);assert.equal(Object.keys(source.snapshot.tables).length,legacyTables.length);
 assert(source.snapshot.tables.hd3d_mail===0);assert(source.documents.filter(d=>d.name.includes('/hd3d_sequences/')).length===numericTables.size);
 assert.equal(job.demo.source.documents.length,20);assert.equal(job.demo.phases[1].filter(d=>d.name.endsWith('/_activation')).length,2);
 const explicit=copy(fixture);explicit.snapshot.collections.hd3d_mail=0;assert.deepEqual(legacyExport(explicit,assurance),source);
});
await test('inspect rejects missing/count-mismatched collection manifest without writes',async()=>{
 for(const mutate of [x=>delete x.snapshot.collections,x=>x.snapshot.collections=[],x=>x.snapshot.collections.hd3d_progress=999,x=>delete x.snapshot.collections.hd3d_progress,x=>x.snapshot.collections.hd3d_mail=-1]){
  const x=copy(fixture);mutate(x);let writes=0;
  await assert.rejects(executeTransfer(job,{inventory:async()=>x,commit:async()=>{writes++;}},{execute:true,journal:async()=>{}}));assert.equal(writes,0);
 }
});
await test('invalid snapshot date precision and document timestamps rejected',()=>{
 for(const value of ['invalid','2026-02-30T00:00:00Z','2026-11-11T10:00:00.123456001Z']){const x=copy(fixture);x.snapshot.readTime=value;assert.throws(()=>transferStep(job,x));}
 for(const value of [undefined,'invalid','2026-11-11T10:00:00.123457Z']){const x=copy(fixture);x.documents[0].updateTime=value;assert.throws(()=>transferStep(job,x));}
});
await test('duplicate foreign malformed and absent document metadata rejected',()=>{
 for(const mutate of [x=>x.documents.push(x.documents[0]),x=>x.documents[0].name=x.documents[0].name.replace('/hero-defense-3d-independent/','/foreign/'),x=>delete x.documents[0].fields,x=>x.snapshot.collections['bad//path']=0,x=>x.snapshot.collections['collection/document']=0]){const x=copy(fixture);mutate(x);assert.throws(()=>validateInventory(x));}
});
await test('missing empty-table sequence and unknown empty legacy collection rejected',()=>{
 const x=copy(fixture);x.documents=x.documents.filter(d=>!d.name.endsWith('/hd3d_sequences/hd3d_mail'));x.snapshot.collections.hd3d_sequences--;assert.throws(()=>prepareTransfer(legacyExport(x,assurance),assurance),/sequence/);
 const y=copy(fixture);y.snapshot.collections.unknown=0;assert.throws(()=>legacyExport(y,assurance),/Unknown/);
});
await test('reverse validates input counts before recounting and keeps zero direct counts',()=>{
 const x=snap(relocate(job.demo.phases[1],directRoot,ROOT));
 for(const d of x.documents.filter(d=>d.name.endsWith('/_activation'))){const v=decodeFields(d.fields);v.row.enabled=false;d.fields=encodeFields(v);}
 const bad=copy(x);bad.snapshot.collections['hd3d_live/global-a/hd3d_progress']=999;assert.throws(()=>rollbackSource(job,bad,assurance),/count mismatch/);
 x.snapshot.collections.hd3d_live=0;x.snapshot.collections['hd3d_live/global-a/hd3d_mail']=0;
 const reverse=rollbackSource(job,x,assurance);assert.equal(reverse.direct.snapshot.collections.hd3d_live,0);assert.equal(reverse.direct.snapshot.collections['hd3d_live/global-a/hd3d_mail'],0);assert.equal(prepareRollback(job,x,assurance).kind,'reverse');
});
await test('writer fence and browser journal attestation remain mandatory',()=>{
 for(const delta of [{writersStopped:false},{exclusiveWriterConfirmed:false},{pendingClientJournals:1},{fenceId:''}])assert.throws(()=>prepareTransfer(source,{...assurance,...delta}));
});
await test('corrupt full readback after observed commit is stopped before next batch',async()=>{
 let state=copy(fixture),writes=0;const events=[];
 const store={inventory:async()=>copy(state),commit:async ws=>{writes++;state=snap([...state.documents,...ws.map(w=>w.update)]);state.snapshot.collections.hd3d_progress=999;}};
 await assert.rejects(executeTransfer(job,store,{execute:true,batchSize:50,journal:async e=>events.push(e)}),/count mismatch/);
 assert.equal(writes,1);assert.equal(events.filter(e=>e.type==='confirmed').length,0);
});
await test('activation cannot use corrupt manifest despite matching data hash and review',()=>{
 const x=snap(relocate(job.demo.phases[0],directRoot,ROOT)),review={jobHash:job.hash,dataHash:inventoryHash(x.documents),fenceId:assurance.fenceId,rulesVerified:true,authVerified:true,originApproved:true,writersStillStopped:true,pendingJournalsZero:true};
 x.snapshot.collections.hd3d_progress=999;assert.throws(()=>transferStep(job,x,{stage:'activate',review}),/count mismatch/);
});
await test('expired pinned readTime stops HTTP export without latest-read fallback',async()=>{
 const requests=[],reply=x=>({ok:true,json:async()=>x});
 const store=firestoreStore({token:async()=>'synthetic',fetcher:async(url,o)=>{requests.push({url,body:o.body&&JSON.parse(o.body)});if(url.endsWith(':batchGet'))return reply([{missing:ROOT+'/hd3d_sequences/hd3d_mail',readTime:at}]);if(url.endsWith(':listCollectionIds'))return reply({collectionIds:['hd3d_progress']});assert.equal(new URL(url).searchParams.get('readTime'),at);return {ok:false,status:400};}});
 await assert.rejects(store.inventory(),/HTTP 400/);assert.equal(requests.length,3);assert.equal(store.stats.commits,0);
});
await test('page duplication and snapshot HTTP budget stop incomplete export',async()=>{
 for(const duplicate of [false,true]){const store=firestoreStore({maxCalls:duplicate?100:1,token:async()=>'synthetic',fetcher:async url=>({ok:true,json:async()=>url.endsWith(':batchGet')?[{readTime:at}]:{collectionIds:[],nextPageToken:'repeat'}})});await assert.rejects(store.inventory(),duplicate?/Pagination cycle/:/budget/);}
});
await test('archival offline source is not silently refreshed or rounded',()=>{
 const before=hash(fixture);validateInventory(fixture);assert.equal(hash(fixture),before);assert.equal(legacyExport(fixture,assurance).snapshot.readTime,at);
 // Online apply always obtains a new pinned inventory. Old backups remain valid
 // archives; their age never authorizes writes or replaces current CAS/readback.
});
console.log(JSON.stringify({suite:'direct-transfer-inventory',passed:cases.length,fixtureHash:hash(fixture),tests:cases}));
