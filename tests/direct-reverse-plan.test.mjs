import assert from 'node:assert/strict';
import {planReverseMigration} from '../direct/reverse-plan.mjs';
import {planAccountMigration} from '../direct/migration-plan.mjs';
import {accountTables} from '../direct/migration.mjs';
import {PROJECT,numericTables,toDocument,fromDocument} from '../server/firestore.mjs';
import {DEMO_PROJECT,directDocument,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {empty} from '../src/account/progress.js';
const uid='reverse-fixture',time='2026-11-04T00:00:00.000Z';
function fixture(){
 const save=empty();save.keep={legacy:true};
 const original={format:1,uid,documents:[toDocument('hd3d_progress',{user_id:uid,data:save,merged:true,created_at:time,updated_at:time})],sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,100])),snapshot:{sourceProject:PROJECT,database:'(default)',readTime:time,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(accountTables.map(t=>[t,t==='hd3d_progress'?1:0]))}};
 const p=planAccountMigration(original),documents=[...p.data,p.activation];
 const activation=documents.at(-1),env=decodeFields(activation.fields);env.row.enabled=false;activation.fields=encodeFields(env);
 const direct={uid,documents,snapshot:{project:DEMO_PROJECT,database:'(default)',readTime:time,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries([...accountTables,'hd3d_sequences'].map(t=>[t,documents.filter(d=>d.name.split('/').at(-2)===t).length]))}};
 const target={project:PROJECT,database:'(default)',writersStopped:true,readTime:time,numericOccupancyComplete:true,accountDocuments:structuredClone(original.documents),numericOwners:Object.fromEntries([...numericTables].map(t=>[t,{}])),sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,200]))};
 return {original,direct,target};
}
const f=fixture(),before=structuredClone(f),p=planReverseMigration(f);assert.deepEqual(f,before);assert.deepEqual(p,planReverseMigration(f));assert.equal(p.productionReady,false);assert.equal(p.noExternalWrites,true);assert.deepEqual(p.documents.map(fromDocument),f.original.documents.map(fromDocument));console.log('PASS deterministic no-write legacy roundtrip preserves all original fields (JSON property order may differ)');
function newer(f){
 const save=empty();save.keep={legacy:true};save.souls=1234;save.bestWave=55;save.codex={'1':{mage:31}};
 f.direct.documents[0]=directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:time,updated_at:'2026-11-04T01:00:00.000Z'});
 const m={id:101,user_id:uid,title:'new',body:'',reward:{souls:4},claimed:true,claimed_at:time,revoked:false,order_id:null,broadcast_id:null,server_applied:true,created_at:time};
 f.direct.documents.push(directDocument(DEMO_PROJECT,uid,'hd3d_mail',101,m));f.direct.snapshot.tables.hd3d_mail++;
 const seq=f.direct.documents.find(d=>d.name.endsWith('/hd3d_sequences/hd3d_mail')),env=decodeFields(seq.fields);env.row.value=101;seq.fields=encodeFields(env);return f;
}
const n=newer(fixture()),next=planReverseMigration(n);assert.equal(fromDocument(next.documents[0]).data.souls,1234);assert.equal(fromDocument(next.documents[0]).data.bestWave,55);assert.deepEqual(fromDocument(next.documents[0]).data.codex,{'1':{mage:31}});assert.equal(fromDocument(next.documents.find(d=>d.name.endsWith('/hd3d_mail/101'))).server_applied,true);assert.equal(next.sequenceHighWater.hd3d_mail,200);console.log('PASS latest direct save, codex, claimed flag and global high-water retained');
for(const change of [f=>f.direct.snapshot.writersStopped=false,f=>f.direct.snapshot.pendingClientJournals=1,f=>f.target.writersStopped=false,f=>f.target.numericOccupancyComplete=false,f=>delete f.target.sequenceHighWater.hd3d_mail,f=>f.direct.uid='other',f=>f.direct.documents[0].name=f.direct.documents[0].name.replace('/'+uid+'/','/other/'),f=>f.direct.snapshot.tables.hd3d_mail=7,f=>f.target.accountDocuments[0].fields.payload.stringValue+=' ',f=>f.direct.documents.splice(0,1)]){const f=fixture();change(f);assert.throws(()=>planReverseMigration(f));}console.log('PASS live writers, journals, missing counts, target drift and wrong owner rejected');
const clash=newer(fixture());clash.target.numericOwners.hd3d_mail['101']='another-account';assert.throws(()=>planReverseMigration(clash),/collision/);console.log('PASS globally colliding per-account numeric IDs stop reverse plan');
for(const [table,row] of [['hd3d_growth_runs',{id:uid+'~run',user_id:uid,done:false}],['hd3d_growth_investments',{id:uid+'~normal~run',user_id:uid,action:'normal_settle',status:'pending',result:{loot:[]}}],['hd3d_growth_investments',{id:uid+'~challenge~run',user_id:uid,action:'challenge_settle',status:'pending',result:{kind:'challenge',next:1,total:2}}],['hd3d_growth_investments',{id:uid+'~mailitem~5~0',user_id:uid,result:{action:'mail_item',mail:5}}]]){
 const f=fixture();f.direct.documents.push(directDocument(DEMO_PROJECT,uid,table,row.id,row));f.direct.snapshot.tables[table]++;assert.throws(()=>planReverseMigration(f),/Unfinished|Partially/);
}console.log('PASS active run, pending reward and partial item mail prevent reversal');
