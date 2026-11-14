import assert from 'node:assert/strict';
import {source} from './direct-global-migration.test.mjs';
import {planGlobalMigration,hash,directRoot} from '../direct/global-migration-plan.mjs';
import {planGlobalReverse} from '../direct/global-reverse-plan.mjs';
import {restoreMappedLegacy} from '../direct/reviewed-mail-mapping.mjs';
import {prepareReverse,stepJob} from '../direct/operator-plan.mjs';
import {DEMO_PROJECT,directDocument,encodeFields,decodeFields} from '../src/account/direct-store.js';
import {fromDocument} from '../server/firestore.mjs';
const target=source(),forward=planGlobalMigration(target),date='2026-11-09T00:00:00Z';
function fixture(){
 const documents=structuredClone([...forward.data,...forward.activations]);
 for(const d of documents.filter(x=>x.name.endsWith('/_activation'))){const v=decodeFields(d.fields);v.row.enabled=false;d.fields=encodeFields(v);}
 for(const uid of ['global-a','global-b'])documents.push(directDocument(DEMO_PROJECT,uid,'hd3d_mail',101,{id:101,user_id:uid,title:'settled',body:'',reward:{souls:4},claimed:true,server_applied:true,claimed_at:date,created_at:date,revoked:false,order_id:null,broadcast_id:null}));
 documents.push(directDocument(DEMO_PROJECT,'global-b','hd3d_owned','global-b~hero_fighter',{user_id:'global-b',item:'hero_fighter',source_mail:101}));
 documents.push(directDocument(DEMO_PROJECT,'global-b','hd3d_dungeon_buys',102,{id:102,user_id:'global-b',item:'fixture',mail_id:101,created_at:date}));
 documents.push(directDocument(DEMO_PROJECT,'global-b','hd3d_growth_investments','global-b~fixture',{id:'global-b~fixture',user_id:'global-b',result:{action:'dungeon_buy',mail:101},at:date}));
 return recount({format:1,documents,snapshot:{project:DEMO_PROJECT,database:'(default)',complete:true,readTime:date,writersStopped:true,pendingClientJournals:0}});
}
function recount(d){d.snapshot.collections={};for(const x of d.documents){const col=x.name.slice(directRoot.length+1).split('/').slice(0,-1).join('/');d.snapshot.collections[col]=(d.snapshot.collections[col]||0)+1;}return d;}
function mapping(d){return {version:1,directHash:hash(d),targetHash:hash(target),reviewedBy:'fixture-operator',reason:'Explicit fixture collision decision',entries:[{uid:'global-b',table:'hd3d_mail',from:101,to:1001}]};}
const d=fixture(),m=mapping(d),before=hash(d),r=planGlobalReverse({forward,direct:d,target,idMapping:m});
assert.equal(hash(d),before);assert.deepEqual(r.archivedDirectSnapshot,d);
const get=(t,id)=>fromDocument(r.documents.find(x=>x.name.endsWith('/'+t+'/'+id)));
assert.equal(get('hd3d_mail',101).user_id,'global-a');assert.equal(get('hd3d_mail',1001).user_id,'global-b');
assert.equal(get('hd3d_owned','global-b~hero_fighter').source_mail,1001);assert.equal(get('hd3d_dungeon_buys',102).mail_id,1001);assert.equal(get('hd3d_growth_investments','global-b~fixture').result.mail,1001);
assert.equal(r.sequenceHighWater.hd3d_mail,1001);assert.equal(get('hd3d_progress','global-b').data.souls,101);
assert.equal(restoreMappedLegacy(r.documents,r.mappingLedger).filter(x=>x.name.endsWith('/hd3d_mail/101')).length,2);
let rejected=0;
for(const mutate of [m=>m.directHash='stale',m=>m.targetHash='stale',m=>m.reviewedBy='',m=>m.entries[0].from=99,m=>m.entries[0].table='hd3d_orders',m=>m.entries[0].to=101,m=>m.entries[0].to=100,m=>m.entries[0].to=1.5,m=>m.entries[0].uid='global-c',m=>m.entries.push({...m.entries[0]}),m=>m.entries.push({...m.entries[0],uid:'global-a'})]){const x=structuredClone(m);mutate(x);assert.throws(()=>planGlobalReverse({forward,direct:d,target,idMapping:x}));rejected++;}
for(const change of [
 r=>r.claimed=false,r=>r.server_applied=false,r=>r.reward.items=[{k:'gear',s:'armor',g:3,c:1}],r=>r.broadcast_id=5,
]){const x=fixture(),doc=x.documents.find(x=>x.name.endsWith('/global-b/hd3d_mail/101')),v=decodeFields(doc.fields);change(v.row);doc.fields=encodeFields(v);assert.throws(()=>planGlobalReverse({forward,direct:x,target,idMapping:mapping(x)}));rejected++;}
for(const extra of [{unknownMail:101},{body:JSON.stringify({mail:101})},{id:'global-b~mailitem~101~0',result:{mail:101}},{result:{customMail:101}}]){const x=fixture();x.documents.push(directDocument(DEMO_PROJECT,'global-b','hd3d_growth_investments',extra.id||'global-b~unknown',{id:extra.id||'global-b~unknown',user_id:'global-b',...extra}));recount(x);assert.throws(()=>planGlobalReverse({forward,direct:x,target,idMapping:mapping(x)}),/reference|receipt/);rejected++;}
const leftover=fixture();for(const uid of ['global-a','global-b'])leftover.documents.push(directDocument(DEMO_PROJECT,uid,'hd3d_dungeon_buys',200,{id:200,user_id:uid}));recount(leftover);assert.throws(()=>planGlobalReverse({forward,direct:leftover,target,idMapping:mapping(leftover)}),/collision/);rejected++;
const changed=structuredClone(r.documents);changed[0].fields.extra={stringValue:'changed'};assert.throws(()=>restoreMappedLegacy(changed,r.mappingLedger),/changed/);rejected++;
const ledger=structuredClone(r.mappingLedger);ledger.changes[0].before.fields={};assert.throws(()=>restoreMappedLegacy(r.documents,ledger),/changed/);rejected++;
const job=prepareReverse({forward,direct:d,target,idMapping:m},{writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true});
const live=new Map(job.before.map(x=>[x.name,{...x,updateTime:date}]));let batches=0;
for(;;){const step=stepJob(job,[...live.values()],{batchSize:2});if(step.complete)break;
 // Resume after applied-but-lost response from persisted, unchanged job.
 for(const w of step.writes){if(w.delete)live.delete(w.delete);else live.set(w.update.name,{...w.update,updateTime:date});}batches++;
 assert(batches<1000);stepJob(JSON.parse(JSON.stringify(job)),[...live.values()],{batchSize:2});
}
assert(stepJob(job,[...live.values()]).complete);assert(live.has(directRoot+'/hd3d_mail/1001'));
assert.equal(hash([...live.values()].filter(x=>x.name.startsWith(directRoot+'/hd3d_live/')).map(({updateTime,...x})=>x).sort((a,b)=>a.name.localeCompare(b.name))),hash(d.documents.filter(x=>x.name.startsWith(directRoot+'/hd3d_live/')).sort((a,b)=>a.name.localeCompare(b.name))));
const drift=[...live.values()];drift[0]=structuredClone(drift[0]);drift[0].fields.corrupt={stringValue:'x'};assert.throws(()=>stepJob(job,drift),/drift/);
console.log(JSON.stringify({pass:true,negativeBoundaries:rejected,changedDocuments:r.mappingLedger.changes.length,resumableBatches:batches,scope:'Explicit finalized non-item mail mapping; original direct archive and all live supported references preserved. Item mail and other tables fail closed.'}));

export {fixture,target,forward,mapping};
