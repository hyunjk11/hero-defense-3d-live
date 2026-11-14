// A local, explicit tick for a trusted operator process. No service scheduler,
// production endpoint or authentication bootstrap exists in this prototype.
// A timer alone cannot establish the exclusive writer fence required below.
import {prepareWeekly,verifyJob} from './operator-plan.mjs';
import {runLocalJob} from './operator-local.mjs';
import {hash,wireDocument,directRoot} from './global-migration-plan.mjs';
import {decodeFields} from '../src/account/direct-store.js';
export async function runDueWeeks(store,repository,{now=Date.now(),assurance,execute=false,batchSize=200,maxBatches=10000}={}){
 if(!Number.isFinite(now)||!repository?.load||!repository?.save)throw Error('Clock and durable local job repository required');
 const documents=await store.inventory(),closed=new Set();
 for(const d of documents){if(!d.name.startsWith(directRoot+'/'))throw Error('Cross-project inventory');if(d.name.includes('/hd3d_spire_weeks/')){const r=decodeFields(d.fields).row;const ms=Date.parse(r.week+'T00:00:00Z');if(Number.isFinite(ms)&&now>=ms+7*86400000-32400000)closed.add(r.week);}}
 const results=[];
 for(const week of [...closed].sort()){
  let saved=await repository.load(week),job;
  if(saved){job=verifyJob(saved.job);if(job.kind!=='weekly'||job.source.week!==week)throw Error('Weekly repository identity mismatch');}
  else{job=prepareWeekly({format:1,complete:true,week,capturedAt:new Date(now).toISOString(),documents:await store.inventory()},assurance);saved={job,complete:false};if(execute)await repository.save(week,saved);}
  if(saved.complete){
   // Completed jobs never reseal changing ranks/bans. Verify their immutable
   // grants have survived before skipping; a deleted grant requires review.
   const actual=new Map((await store.inventory()).map(d=>[d.name,wireDocument(d)]));
   const before=new Set(job.before.map(d=>d.name));for(const d of job.phases[0].filter(d=>!before.has(d.name)))if(!actual.has(d.name)||hash(actual.get(d.name))!==hash(d))throw Error('Completed weekly entitlement missing or changed');
   results.push({week,already:true,jobHash:job.jobHash});continue;
  }
  const result=await runLocalJob(job,store,{execute,batchSize,maxBatches,journal:async journal=>{if(execute)await repository.save(week,{job,complete:false,journal});}});
  if(execute&&result.complete)await repository.save(week,{job,complete:true,result});results.push({week,...result});
 }
 return {productionReady:false,automaticServiceEnabled:false,execute,results};
}
