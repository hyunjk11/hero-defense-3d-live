import assert from 'node:assert/strict';
import {source} from './direct-global-migration.test.mjs';
import {planGlobalMigration} from '../direct/global-migration-plan.mjs';
import {decodeFields,encodeFields,directDocument} from '../src/account/direct-store.js';
import {runDueWeeks} from '../direct/weekly-runner.mjs';
const p=planGlobalMigration(source()),fence={writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true};
let docs=structuredClone([...p.data,...p.activations]).map(d=>({...d,updateTime:'t0'}));
for(const d of docs.filter(d=>d.name.endsWith('/_activation'))){const v=decodeFields(d.fields);v.row.enabled=false;d.fields=encodeFields(v);}
// Synthetic fixture has two eligible recipients for interrupted-batch coverage.
docs=docs.filter(d=>!d.name.includes('/hd3d_bans/'));
for(const [uid,floor] of [['global-a',30],['global-b',25]])docs.push({...directDocument('demo-hd3d-direct',uid,'hd3d_spire_weeks',uid+'~2026-11-02',{user_id:uid,week:'2026-11-02',best_floor:floor,best_at:'2026-11-03T00:00:00Z',claimed:false}),updateTime:'t0'});
let commits=0,lose=true;const store={stats:{},inventory:async()=>structuredClone(docs),commit:async writes=>{commits++;for(const w of writes){assert.equal(docs.some(d=>d.name===w.update.name),false);docs.push({...w.update,updateTime:'t'+commits});}if(lose){lose=false;throw Error('response lost');}}};
const jobs=new Map(),repository={load:async k=>structuredClone(jobs.get(k)),save:async(k,v)=>{jobs.set(k,structuredClone(v));}};
const now=Date.parse('2026-11-10T00:00:00Z');
assert.equal((await runDueWeeks(store,repository,{now:Date.parse('2026-11-04T00:00:00Z'),assurance:fence})).results.length,0);
assert((await runDueWeeks(store,repository,{now,assurance:fence})).results[0].dryRun);assert.equal(commits,0);assert.equal(jobs.size,0);
await assert.rejects(runDueWeeks(store,repository,{now,assurance:fence,execute:true,batchSize:1,maxBatches:1}),/batch limit/);assert.equal(commits,1);assert.equal(jobs.get('2026-11-02').complete,false);
assert((await runDueWeeks(store,repository,{now,assurance:fence,execute:true})).results[0].complete);assert.equal(commits,2);
assert((await runDueWeeks(store,repository,{now:now+86400000,assurance:fence,execute:true})).results[0].already);assert.equal(commits,2);
const grant=docs.find(d=>d.name.includes('~spaward~'));docs=docs.filter(d=>d!==grant);await assert.rejects(runDueWeeks(store,repository,{now,assurance:fence,execute:true}),/missing or changed/);docs.push(grant);
const saved=jobs.get('2026-11-02');saved.job.source.week='2026-10-26';await assert.rejects(runDueWeeks(store,repository,{now,assurance:fence,execute:true}),/modified|conflicts|closed-week/);
console.log('PASS weekly tick: open week, dry-run, interrupted + uncertain commit, resume, duplicate ticks, missing grant and tampered repository (in-memory only)');
