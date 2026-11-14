// Local demo emulator only. The harness enforces loopback and demo project.
// The migration modules themselves never perform IO; this tests reviewed writes
// with synthetic fixtures, not real exports or an operational migration.
import {assert,rest,user,rows,test,fs,host,root} from './emulator-harness.mjs';
import {source} from '../tests/direct-global-migration.test.mjs';
import {planGlobalMigration,globalImportPlan} from './global-migration-plan.mjs';
import {planGlobalReverse} from './global-reverse-plan.mjs';
import {DEMO_PROJECT,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {fromDocument} from '../server/firestore.mjs';
const input=source(),p=planGlobalMigration(input),expected=[...p.data,...p.activations].map(d=>d.name);
const snapshot={project:DEMO_PROJECT,database:'(default)',complete:true,writersStopped:true,readTime:'2026-11-06T00:00:00Z',documents:[]};
async function readAll(){const out=[];for(let i=0;i<expected.length;i+=100)out.push(...(await rest(':batchGet',{documents:expected.slice(i,i+100)})).flatMap(r=>r.found?[r.found]:[]));return out;}
await test('interrupted reviewed import resumes exactly then all data precede activation',async()=>{
 const initial=await readAll();assert.equal(initial.length,0,'Use a fresh demo emulator; never overwrite existing fixtures');
 let plan=globalImportPlan(p,snapshot,{batchSize:3});await rest(':commit',{writes:plan.batches[0]});snapshot.documents=await readAll();plan=globalImportPlan(p,snapshot);assert.equal(plan.activations.length,0);assert.equal(plan.missing,p.data.length-3);
 for(const writes of plan.batches)await rest(':commit',{writes});snapshot.documents=await readAll();plan=globalImportPlan(p,snapshot);assert(plan.verified);assert.equal(plan.activations.length,2);await rest(':commit',{writes:plan.activations});snapshot.documents=await readAll();assert.equal(globalImportPlan(p,snapshot,{activated:true}).activeAccounts,2);
});
await test('authenticated imported owner reads own save; other private account is denied',async()=>{
 const token=await user('global-a').getIdToken();const d=await rest('/hd3d_live/global-a/hd3d_progress/global-a',null,token,'GET');assert.equal(decodeFields(d.fields).row.authority.souls,100);
 await assert.rejects(rest('/hd3d_live/global-b/hd3d_progress/global-b',null,token,'GET'),e=>e.status===403);
 const n=await rest('/hd3d_live_notices/2',null,token,'GET');assert.equal(decodeFields(n.fields).row.title,'Kept notice');
 await assert.rejects(rest('/hd3d_live_legacy_audit/3',null,token,'GET'),e=>e.status===403);
});
await test('frozen emulator export reverses all latest account and global rows without writes to legacy',async()=>{
 const writes=snapshot.documents.filter(d=>d.name.endsWith('/_activation')).map(d=>{const v=decodeFields(d.fields);v.row.enabled=false;return {update:{name:d.name,fields:encodeFields(v)},currentDocument:{updateTime:d.updateTime}};});await rest(':commit',{writes});
 const ds=await readAll(),counts={};for(const d of ds){const col=d.name.slice(root.length+1).split('/').slice(0,-1).join('/');counts[col]=(counts[col]||0)+1;}
 const direct={format:1,documents:ds,snapshot:{...snapshot,project:DEMO_PROJECT,pendingClientJournals:0,collections:counts}};delete direct.snapshot.documents;
 const r=planGlobalReverse({forward:p,direct,target:input});assert.equal(r.accounts.length,2);assert.equal(r.documents.filter(d=>d.name.includes('/hd3d_progress/')).length,2);assert.equal(fromDocument(r.documents.find(d=>d.name.endsWith('/hd3d_progress/global-a'))).data.souls,100);
 await fs.writeFile('../direct-firestore-evidence-22/global-roundtrip.json',JSON.stringify({scope:'Local demo only; synthetic users; trusted fixture import; no legacy/production writes',sourceHash:p.sourceHash,directDocuments:ds.length,reverseDataHash:r.dataHash,accounts:r.accounts,rows},null,2));
});
await fs.writeFile('../direct-firestore-evidence-22/global-emulator-results.json',JSON.stringify({scope:'Local demo only',rows},null,2));if(rows.some(r=>!r.pass))process.exitCode=1;
