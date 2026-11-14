import assert from 'node:assert/strict';
import {planAccountMigration} from '../direct/migration-plan.mjs';
import {planImportBatches,verifyImportedAccount} from '../direct/cutover-plan.mjs';
import {accountTables} from '../direct/migration.mjs';
import {PROJECT,numericTables,toDocument} from '../server/firestore.mjs';
import {empty} from '../src/account/progress.js';
const uid='offline-cutover',time='2026-11-04T00:00:00.000Z',save=empty();save.unknown={retained:['yes',1]};
const source={format:1,uid,documents:[toDocument('hd3d_progress',{user_id:uid,data:save,merged:true,created_at:time,updated_at:time})],sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,100])),snapshot:{sourceProject:PROJECT,database:'(default)',readTime:time,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(accountTables.map(t=>[t,t==='hd3d_progress'?1:0]))}};
const plan=planAccountMigration(source),snapshot={project:plan.targetProject,uid,database:'(default)',readTime:time,writersStopped:true,complete:true,documents:[]};
const before=structuredClone({plan,snapshot}),p=planImportBatches(plan,snapshot,{batchSize:2});assert.equal(p.batches.flat().length,plan.data.length);assert(p.batches.every(b=>b.length<=2));assert(p.batches.flat().every(w=>w.currentDocument.exists===false));assert.deepEqual({plan,snapshot},before);
snapshot.documents=p.batches[0].map(w=>({...w.update,createTime:time,updateTime:time}));const resumed=planImportBatches(plan,snapshot,{batchSize:2});assert.equal(resumed.existingData,2);assert.equal(resumed.missingData,plan.data.length-2);assert.throws(()=>verifyImportedAccount(plan,snapshot),/count/);
snapshot.documents=[...plan.data];const verify=verifyImportedAccount(plan,snapshot);assert.equal(verify.ok,true);assert.equal(verify.activation.currentDocument.exists,false);snapshot.documents.push(plan.activation);assert.equal(verifyImportedAccount(plan,snapshot,{activated:true}).ok,true);assert.deepEqual(planImportBatches(plan,snapshot).batches,[]);assert.throws(()=>verifyImportedAccount(plan,snapshot),/count/);
const restSnapshot=structuredClone(snapshot);function omitEmpty(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if((k==='fields'&&x&&Object.keys(x).length===0)||(k==='values'&&Array.isArray(x)&&x.length===0))delete v[k];else omitEmpty(x);}}omitEmpty(restSnapshot.documents);assert(verifyImportedAccount(plan,restSnapshot,{activated:true}).ok);
const typeDrift=structuredClone(restSnapshot);const f=typeDrift.documents[0].fields;f.version={stringValue:'1'};assert.throws(()=>verifyImportedAccount(plan,typeDrift,{activated:true}),/mismatch/);
for(const mutate of [s=>s.complete=false,s=>s.writersStopped=false,s=>s.uid='other',s=>s.documents.push(s.documents[0]),s=>s.documents[0].fields.owner.stringValue='other',s=>s.documents[0].name+='/bad',s=>s.documents.splice(0,1)]){const s=structuredClone(snapshot);mutate(s);assert.throws(()=>planImportBatches(plan,s));}
for(const mutate of [p=>p.uid='other',p=>p.data[0].fields.owner.stringValue='other',p=>p.activation.fields.row.mapValue.fields.enabled.booleanValue=false]){const p=structuredClone(plan);mutate(p);assert.throws(()=>planImportBatches(p,snapshot));}
for(const batchSize of [0,401,1.5])assert.throws(()=>planImportBatches(plan,snapshot,{batchSize}));
console.log('PASS source-reconstructed plans, interrupted batch resume, exact verification, activation ordering, drift/foreign data rejection and immutable inputs');
