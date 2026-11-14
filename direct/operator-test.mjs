import {assert,fs,host,root,test,rows,rest,client,get} from './emulator-harness.mjs';
import {source} from '../tests/direct-global-migration.test.mjs';
import {prepareImport,prepareReverse,prepareWeekly,stepJob} from './operator-plan.mjs';
import {localStore,runLocalJob} from './operator-local.mjs';
import {directRoot,legacyTables,hash,wireDocument} from './global-migration-plan.mjs';
import {toDocument,fromDocument} from '../server/firestore.mjs';
import {decodeFields,encodeFields} from '../src/account/direct-store.js';
import {week,shiftDay} from '../server/common.mjs';
import {planGlobalMigration} from './global-migration-plan.mjs';
const assurance={writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true},wk=shiftDay(week(Date.now()),-7),at=wk+'T01:00:00.000Z';
const s=source();for(const [i,uid] of ['global-a','global-b'].entries())s.documents.push(toDocument('hd3d_spire_weeks',{user_id:uid,week:wk,best_floor:30+i,best_at:at,claimed:false}));s.snapshot.tables.hd3d_spire_weeks=2;
const job=prepareImport(s,assurance),base=localStore(host),start=await base.inventory();assert.equal(start.length,0,'fresh isolated demo only');await base.commit(job.before.map(update=>({update,currentDocument:{exists:false}})));
await fs.writeFile('../direct-firestore-evidence-22/operator-import-job.json',JSON.stringify(job,null,2));let stats={};
await test('real HTTP dry-run writes nothing; interruption before activation resumes after committed reply loss',async()=>{
 const before=base.stats.commits;const dry=await runLocalJob(job,base);assert(dry.dryRun);assert.equal(base.stats.commits,before);
 await assert.rejects(runLocalJob(job,base,{execute:true,batchSize:3,maxBatches:1}),/batch limit/);assert(!(await base.inventory()).some(d=>d.name.endsWith('/_activation')));
 let lost=false;const store=localStore(host,{fetcher:async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok&&!lost){lost=true;throw Error('response lost');}return r;}});
 const j=[];assert((await runLocalJob(job,store,{execute:true,journal:async x=>j.push(x)})).complete);assert(j.some(x=>x.events.some(e=>e.outcome==='commit_confirmed_after_error')));
 const c=store.stats.commits;assert((await runLocalJob(job,store,{execute:true})).complete);assert.equal(c,store.stats.commits);stats.import={...store.stats};await fs.writeFile('../direct-firestore-evidence-22/operator-import-journal.json',JSON.stringify(j.at(-1),null,2));
});
async function fenceAccounts(){const ds=await base.inventory(),writes=ds.filter(d=>d.name.endsWith('/_activation')).map(d=>{const v=decodeFields(d.fields);v.row.enabled=false;return {update:{name:d.name,fields:encodeFields(v)},currentDocument:{updateTime:d.updateTime}};});await base.commit(writes);}
await test('weekly finalizer derives private frozen ranks, excludes bans, produces immutable grant once and original claim works',async()=>{
 await fenceAccounts();const source={format:1,complete:true,week:wk,capturedAt:new Date().toISOString(),documents:await base.inventory()};const j=prepareWeekly(source,assurance);assert.equal(j.phases[0].length-j.before.length,1);assert((await runLocalJob(j,base,{execute:true})).complete);const c=base.stats.commits;assert((await runLocalJob(j,base,{execute:true})).complete);assert.equal(c,base.stats.commits);
 await fs.writeFile('../direct-firestore-evidence-22/operator-weekly-job.json',JSON.stringify(j,null,2));
 const d=(await base.inventory()).find(d=>d.name.endsWith('/global-a/hd3d_sequences/_activation')),v=decodeFields(d.fields);v.row.enabled=true;await base.commit([{update:{name:d.name,fields:encodeFields(v)},currentDocument:{updateTime:d.updateTime}}]);
 const z=await client('global-a').rpc('spire_claim_week',{p_week:wk});assert(z.ok);assert.equal(z.rank,1);assert.equal(z.souls,900);assert.equal(z.medals,12);await client('global-a').rpc('claim_mail',{p_mail_id:z.mail});assert.equal((await get('global-a','progress')).authority.souls,1000);assert((await client('global-a').rpc('spire_claim_week',{p_week:wk})).already);await fenceAccounts();
});
await test('reverse executor preserves latest save/codex/mail/weekly claim and verifies exact full result; no legacy remote endpoint',async()=>{
 const all=await base.inventory(),documents=all.filter(d=>d.name.slice(directRoot.length+1).split('/')[0].startsWith('hd3d_live')),collections={};for(const d of documents){const col=d.name.slice(directRoot.length+1).split('/').slice(0,-1).join('/');collections[col]=(collections[col]||0)+1;}
 const direct={format:1,documents,snapshot:{project:'demo-hd3d-direct',database:'(default)',complete:true,writersStopped:true,pendingClientJournals:0,readTime:new Date().toISOString(),collections}};
 const j=prepareReverse({forward:planGlobalMigration(s),direct,target:s},assurance);const out=await runLocalJob(j,base,{execute:true,batchSize:3});assert(out.complete);assert(stepJob(j,await base.inventory()).complete);
 const d=(await base.inventory()).find(d=>d.name.endsWith('/hd3d_progress/global-a')&&!d.name.includes('/hd3d_live/')),save=fromDocument(d).data;assert.equal(save.souls,1000);assert.deepEqual(save.codex,{'1':{mage:31}});assert.equal(save.keep.unchanged,'global-a');
 const n=base.stats.commits;assert((await runLocalJob(j,base,{execute:true})).complete);assert.equal(n,base.stats.commits);await fs.writeFile('../direct-firestore-evidence-22/operator-reverse-job.json',JSON.stringify(j,null,2));stats.final={...base.stats};
});
await fs.writeFile('../direct-firestore-evidence-22/operator-results.json',JSON.stringify({scope:'Literal loopback demo; trusted fixture operator, synthetic owner tokens; not production IAM/export/cutover',rows,stats},null,2));if(rows.some(x=>!x.pass))process.exitCode=1;
