import assert from 'node:assert/strict';
import {planGlobalMigration,globalImportPlan,legacyTables,directRoot} from '../direct/global-migration-plan.mjs';
import {planGlobalReverse} from '../direct/global-reverse-plan.mjs';
import {PROJECT,numericTables,toDocument,fromDocument} from '../server/firestore.mjs';
import {DEMO_PROJECT,decodeFields,encodeFields,directDocument} from '../src/account/direct-store.js';
import {empty} from '../src/account/progress.js';
const date='2026-11-06T00:00:00.000Z';
function source(uids=['global-a','global-b']){
 const docs=[];
 for(const [i,uid] of uids.entries()){
  const save=empty();save.souls=100+i;save.keep={unchanged:uid};save.codex={'1':{mage:31}};
  for(const [t,r] of [['progress',{user_id:uid,data:save,merged:true,created_at:date,updated_at:date}],['users',{id:uid,email:uid+'@example.invalid',created_at:date}],['profiles',{id:uid,nickname:'Hero'+i}],['spire_best',{user_id:uid,best_floor:10+i,best_at:'2026-11-05T09:00:00.123456789+09:00'}]])docs.push(toDocument('hd3d_'+t,r));
 }
 docs.push(toDocument('hd3d_bans',{user_id:uids[1],reason:'private fixture',created_at:date}));
 docs.push(toDocument('hd3d_notices',{id:2,title:'Kept notice',body:'body',active:true,starts_at:null,ends_at:null,created_by:uids[0],created_at:date,updated_at:date}));
 docs.push(toDocument('hd3d_admin_log',{id:3,admin_id:uids[0],target_user:uids[1],action:'ban',detail:{reason:'private fixture'},created_at:date}));
 docs.push(toDocument('hd3d_broadcasts',{id:4,title:'Kept broadcast',body:'prior',reward:null,recipients:2,created_by:uids[0],created_at:date}));
 for(const id of numericTables)docs.push(toDocument('hd3d_sequences',{id,value:100}));
 return {format:1,documents:docs,snapshot:{sourceProject:PROJECT,database:'(default)',complete:true,readTime:date,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(legacyTables.map(t=>[t,docs.filter(d=>d.name.split('/').at(-2)===t).length]))}};
}
function direct(plan){const documents=structuredClone([...plan.data,...plan.activations]);for(const d of documents.filter(d=>d.name.endsWith('/_activation'))){const v=decodeFields(d.fields);v.row.enabled=false;d.fields=encodeFields(v);}return recount({format:1,documents,snapshot:{project:DEMO_PROJECT,database:'(default)',complete:true,readTime:date,writersStopped:true,pendingClientJournals:0}});}
function recount(d){const counts={};for(const x of d.documents){const col=x.name.slice(directRoot.length+1).split('/').slice(0,-1).join('/');counts[col]=(counts[col]||0)+1;}d.snapshot.collections=counts;return d;}
const s=source(),before=structuredClone(s),p=planGlobalMigration(s);assert.deepEqual(s,before);assert.deepEqual(p,planGlobalMigration(s));assert.equal(p.accounts.length,2);assert.equal(p.productionReady,false);assert.equal(p.noExternalWrites,true);
const publicDocs=p.data.filter(d=>['hd3d_live_ranks','hd3d_live_rank_blocks','hd3d_live_accounts'].includes(d.name.split('/').at(-2)));assert(!JSON.stringify(publicDocs).includes('@example'));assert(!JSON.stringify(publicDocs).includes('private fixture'));assert(publicDocs.some(d=>d.fields.at?.stringValue==='2026-11-05T00:00:00.123456789Z'));
console.log('PASS complete global source preserves two saves, private data separation, precise ranking time and broadcast/audit archives');
const target={project:DEMO_PROJECT,database:'(default)',complete:true,writersStopped:true,readTime:date,documents:[]};let imp=globalImportPlan(p,target,{batchSize:3});assert(imp.batches.every(b=>b.length<=3));assert.equal(imp.activations.length,0);
target.documents=imp.batches[0].map(w=>w.update);imp=globalImportPlan(p,target);assert.equal(imp.missing,p.data.length-3);assert.equal(imp.activations.length,0);
assert.throws(()=>globalImportPlan(p,{...target,documents:[...target.documents,p.activations[0]]}),/incomplete/);
target.documents=p.data;imp=globalImportPlan(p,target);assert(imp.verified);assert.equal(imp.activations.length,2);assert(imp.activations.every(w=>w.currentDocument.exists===false));target.documents=[...p.data,...p.activations];assert.equal(globalImportPlan(p,target,{activated:true}).activeAccounts,2);
console.log('PASS global data verification gates every activation, interrupted batch resumes without overwrite');
for(const fn of [s=>s.snapshot.complete=false,s=>s.snapshot.writersStopped=false,s=>s.snapshot.pendingClientJournals=1,s=>s.snapshot.readTime='2026-02-30',s=>s.documents.push(s.documents[0]),s=>s.snapshot.tables.hd3d_mail=1,s=>s.documents.find(d=>d.name.endsWith('/hd3d_sequences/hd3d_notices')).fields.payload.stringValue=JSON.stringify({id:'hd3d_notices',value:0}),s=>s.documents[0].name=s.documents[0].name.replace(PROJECT,'foreign-project')]){const x=source();fn(x);assert.throws(()=>planGlobalMigration(x));}
const missingSave=source();missingSave.documents=missingSave.documents.filter(d=>!d.name.endsWith('/hd3d_progress/global-a'));missingSave.snapshot.tables.hd3d_progress--;assert.throws(()=>planGlobalMigration(missingSave),/authoritative save/);
const corrupt=structuredClone(p);corrupt.data[0].fields={};assert.throws(()=>globalImportPlan(corrupt,target),/modified/);
console.log('PASS missing inventory, invalid dates, wrong project, sequence regression, missing save and edited plan fail closed');
let d=direct(p),r=planGlobalReverse({forward:p,direct:d,target:s});assert.equal(r.accounts.length,2);assert.equal(r.productionReady,false);assert.equal(r.documents.filter(d=>d.name.includes('/hd3d_progress/')).length,2);assert.equal(fromDocument(r.documents.find(x=>x.name.endsWith('/hd3d_progress/global-a'))).data.souls,100);
const saved=empty();saved.souls=778;saved.keep={unchanged:'global-a'};saved.codex={'1':{mage:31}};
let ix=d.documents.findIndex(x=>x.name.endsWith('/global-a/hd3d_progress/global-a'));d.documents[ix]=directDocument(DEMO_PROJECT,'global-a','hd3d_progress','global-a',{user_id:'global-a',data:saved,merged:true,created_at:date,updated_at:date});
const n=d.documents.find(x=>x.name.endsWith('/hd3d_live_notices/2'));const nv=decodeFields(n.fields);nv.row.body='edited';n.fields={...n.fields,...encodeFields(nv)};
r=planGlobalReverse({forward:p,direct:d,target:s});assert.equal(fromDocument(r.documents.find(x=>x.name.endsWith('/hd3d_progress/global-a'))).data.souls,778);assert.equal(fromDocument(r.documents.find(x=>x.name.endsWith('/hd3d_notices/2'))).body,'edited');assert.equal(r.archivedDirectSnapshot.documents.length,d.documents.length);
console.log('PASS global reverse keeps latest saves/codex, changed notices, audit and broadcast history');
const three=planGlobalMigration(source(['global-a','global-b','new-c'])),third=direct(three);d=direct(p);d.documents.push(...third.documents.filter(x=>x.name.includes('/hd3d_live/new-c/')||x.name.endsWith('/hd3d_live_accounts/new-c')||x.name.includes('~new-c')));recount(d);
r=planGlobalReverse({forward:p,direct:d,target:s});assert(r.accounts.find(x=>x.uid==='new-c').newAccount);assert.equal(r.documents.filter(x=>x.name.includes('/hd3d_progress/')).length,3);
console.log('PASS newly registered direct account can reverse into empty legacy namespace without fabricating an old save');
function mail(uid){return directDocument(DEMO_PROJECT,uid,'hd3d_mail',101,{id:101,user_id:uid,title:'new',body:'',reward:{souls:4},claimed:true,claimed_at:date,revoked:false,order_id:null,broadcast_id:null,server_applied:true,created_at:date});}
const clash=direct(p);clash.documents.push(mail('global-a'),mail('global-b'));recount(clash);assert.throws(()=>planGlobalReverse({forward:p,direct:clash,target:s}),/collision/);
console.log('PASS cross-account numeric collision stops reversal; no silent renumbering or data loss');
for(const fn of [d=>d.snapshot.pendingClientJournals=1,d=>d.snapshot.complete=false,d=>d.documents.splice(d.documents.findIndex(x=>x.name.endsWith('/hd3d_live_accounts/global-a')),1),d=>{const a=d.documents.find(x=>x.name.endsWith('/_activation')),v=decodeFields(a.fields);v.row.enabled=true;a.fields=encodeFields(v);},d=>d.documents.push(directDocument(DEMO_PROJECT,'global-a','hd3d_growth_runs','global-a~pending',{id:'global-a~pending',user_id:'global-a',done:true,directReward:{mail:1},hardSaved:false}))]){const x=direct(p);fn(x);recount(x);assert.throws(()=>planGlobalReverse({forward:p,direct:x,target:s}));}
const lost=direct(p);lost.documents=lost.documents.filter(x=>!x.name.endsWith('/hd3d_live_legacy_broadcasts/4'));recount(lost);assert.throws(()=>planGlobalReverse({forward:p,direct:lost,target:s}),/archive/);
const drift=source();const v=fromDocument(drift.documents[0]);v.data.souls++;drift.documents[0]=toDocument('hd3d_progress',v);assert.throws(()=>planGlobalReverse({forward:p,direct:direct(p),target:drift}),/changed/);
console.log('PASS active accounts, pending hard rewards, missing directory/archive and stale legacy targets stop reversal');
export {source};
