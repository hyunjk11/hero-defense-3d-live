import {assert,fs,host,test,rows} from './emulator-harness.mjs';
import {fixture,target,forward,mapping} from '../tests/direct-reviewed-mapping.test.mjs';
import {prepareReverse,stepJob} from './operator-plan.mjs';
import {localStore,runLocalJob} from './operator-local.mjs';
import {hash,wireDocument,directRoot} from './global-migration-plan.mjs';
const direct=fixture(),job=prepareReverse({forward,direct,target,idMapping:mapping(direct)},{writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true}),store=localStore(host);
assert.equal((await store.inventory()).length,0,'fresh demo emulator required');
await store.commit(job.before.map(update=>({update,currentDocument:{exists:false}})));
await test('mapped reverse dry-run is read-only; partial commit then response loss resumes once',async()=>{
 const n=store.stats.commits;assert((await runLocalJob(job,store)).dryRun);assert.equal(store.stats.commits,n);
 const first=stepJob(job,await store.inventory(),{batchSize:2});await store.commit(first.writes);
 let lost=false;const uncertain=localStore(host,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&!lost){lost=true;throw Error('response lost after mapped commit');}return r;}}),journals=[];
 assert((await runLocalJob(job,uncertain,{execute:true,journal:async j=>journals.push(j)})).complete);assert(lost);assert(journals.some(j=>j.events.some(e=>e.outcome==='commit_confirmed_after_error')));
 const final=await store.inventory();assert.equal(hash(final.map(wireDocument).sort((a,b)=>a.name.localeCompare(b.name))),hash(job.phases.at(-1)));
 const count=store.stats.commits;assert((await runLocalJob(job,store,{execute:true})).complete);assert.equal(store.stats.commits,count);
 const archive=final.filter(d=>d.name.startsWith(directRoot+'/hd3d_live/')).map(wireDocument).sort((a,b)=>a.name.localeCompare(b.name));
 assert.equal(hash(archive),hash(direct.documents.filter(d=>d.name.startsWith(directRoot+'/hd3d_live/')).map(wireDocument).sort((a,b)=>a.name.localeCompare(b.name))));
});
await test('changed destination is refused without another write',async()=>{
 const d=(await store.inventory()).find(d=>d.name.endsWith('/hd3d_mail/1001')&&!d.name.includes('/hd3d_live/'));
 await store.commit([{update:{...wireDocument(d),fields:{...d.fields,unknown:{booleanValue:true}}},currentDocument:{updateTime:d.updateTime}}]);const n=store.stats.commits;
 await assert.rejects(runLocalJob(job,store,{execute:true}),/drift/);assert.equal(store.stats.commits,n);
});
await fs.writeFile('../direct-firestore-evidence-22/mapping-demo-job.json',JSON.stringify(job,null,2));
await fs.writeFile('../direct-firestore-evidence-22/mapping-emulator-results.json',JSON.stringify({scope:'Loopback demo fixture only, no production data or mapping decisions',rows,stats:store.stats},null,2));if(rows.some(x=>!x.pass))process.exitCode=1;
