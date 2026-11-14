import assert from 'node:assert/strict';
import {source} from './direct-global-migration.test.mjs';
import {prepareImport,prepareWeekly,prepareReverse,stepJob,verifyJob} from '../direct/operator-plan.mjs';
import {planGlobalMigration,directRoot} from '../direct/global-migration-plan.mjs';
import {encodeFields,decodeFields,directDocument} from '../src/account/direct-store.js';
import {fromDocument} from '../server/firestore.mjs';
import {localStore,runLocalJob} from '../direct/operator-local.mjs';
const assurance={writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true};
const j=prepareImport(source(),assurance);let docs=structuredClone(j.before).map(d=>({...d,updateTime:'t0'})),calls=0;
const store={stats:{},inventory:async()=>structuredClone(docs),commit:async writes=>{calls++;for(const w of writes){if(w.delete)docs=docs.filter(d=>d.name!==w.delete);else{const old=docs.find(d=>d.name===w.update.name);assert(w.currentDocument.exists===false?!old:old?.updateTime===w.currentDocument.updateTime);docs=docs.filter(d=>d.name!==w.update.name);docs.push({...w.update,updateTime:'t'+calls});}}}};
assert.equal((await runLocalJob(j,store)).dryRun,true);assert.equal(calls,0);
await assert.rejects(runLocalJob(j,store,{execute:true,batchSize:3,maxBatches:1}),/batch limit/);assert.equal(calls,1);assert(!docs.some(d=>d.name.endsWith('/_activation')));
const commit=store.commit;let lose=true;store.commit=async w=>{await commit(w);if(lose){lose=false;throw Error('lost response');}};
assert((await runLocalJob(j,store,{execute:true})).complete);const count=calls;assert((await runLocalJob(j,store,{execute:true})).complete);assert.equal(count,calls);
const edited=structuredClone(j);edited.phases[0][0].fields={};assert.throws(()=>verifyJob(edited),/modified/);
const unknown=[...docs,{name:j.before[0].name+'-unknown',fields:{}}];assert.throws(()=>stepJob(j,unknown),/drift/);
const missing=docs.filter(d=>d.name!==j.before[0].name);assert.throws(()=>stepJob(j,missing),/missing|drift/);
const enabledEarly=structuredClone(j.before).concat(j.phases[1].filter(d=>d.name.endsWith('/_activation')));assert.throws(()=>stepJob(j,enabledEarly),/drift/);
for(const endpoint of ['https://firestore.googleapis.com','http://localhost:9608','http://127.0.0.1:9608/path','http://127.0.0.1:9608@host','http://127.0.0.1:99999'])assert.throws(()=>localStore(endpoint));
assert.throws(()=>prepareImport(source(),{...assurance,exclusiveWriterConfirmed:false}),/Exclusive/);
console.log('PASS operator dry-run, phase gate, interrupted resume, unknown response readback, idempotence, drift/hash/endpoint/fence denial (in-memory)');
const p=planGlobalMigration(source()),privateDocs=structuredClone([...p.data,...p.activations]);
for(const d of privateDocs.filter(d=>d.name.endsWith('/_activation'))){const v=decodeFields(d.fields);v.row.enabled=false;d.fields=encodeFields(v);}
const wk='2026-11-02',capture='2026-11-10T00:00:00Z',weekRow=directDocument('demo-hd3d-direct','global-a','hd3d_spire_weeks','global-a~'+wk,{user_id:'global-a',week:wk,best_floor:30,best_at:'2026-11-03T00:00:00Z',claimed:false});privateDocs.push(weekRow);
const ws={format:1,complete:true,week:wk,capturedAt:capture,documents:privateDocs};const w=prepareWeekly(ws,assurance);assert.equal(w.phases[0].length,w.before.length+1);
for(const mutate of [x=>x.documents.push(x.documents[0]),x=>{const d=x.documents.find(d=>d.name.endsWith('/_activation')),v=decodeFields(d.fields);v.row.enabled=true;d.fields=encodeFields(v);},x=>x.documents.push(directDocument('demo-hd3d-direct','global-a','hd3d_growth_runs','global-a~unfinished',{user_id:'global-a',done:true,directReward:{mail:101},hardSaved:false})),x=>x.documents.push(directDocument('demo-hd3d-direct','global-a','hd3d_growth_investments','global-a~pending',{status:'pending'})),x=>x.documents.push(directDocument('demo-hd3d-direct','global-a','hd3d_growth_investments','global-a~partial',{result:{action:'mail_item',mail:102}}))]){const x=structuredClone(ws);mutate(x);assert.throws(()=>prepareWeekly(x,assurance));}
const audit={actor:'global-a',request:'request-123',target:'global-b',mail:101,action:'admin_send_mail',signature:'{}',email:'global-b@example.invalid',row:{title:'kept'},at:capture};
for(const [col,id,data] of [['hd3d_live_mail_audit','global-b~101',audit],['hd3d_live_admin_requests','global-a~request-123',{actor:'global-a',request:'request-123',mail:101}],['hd3d_live_mail_specs','global-a~request-123~0',{items:[{k:'gear',s:'armor',g:0}]}]])privateDocs.push({name:directRoot+'/'+col+'/'+id,fields:encodeFields(data)});
const counts={};for(const d of privateDocs){const col=d.name.slice(directRoot.length+1).split('/').slice(0,-1).join('/');counts[col]=(counts[col]||0)+1;}
const rev=prepareReverse({forward:p,target:source(),direct:{format:1,documents:privateDocs,snapshot:{project:'demo-hd3d-direct',database:'(default)',readTime:capture,writersStopped:true,pendingClientJournals:0,complete:true,collections:counts}}},assurance);
assert(rev.phases[0].some(d=>d.name.includes('/hd3d_admin_log/')&&fromDocument(d).action==='mail_send'));assert(rev.phases[0].some(d=>d.name.endsWith('/hd3d_live_mail_specs/global-a~request-123~0')));
console.log('PASS frozen private weekly source requires all activation fences/no partial rewards; reverse keeps new admin audit and recovery drafts');
