import {open,readFile,unlink} from 'node:fs/promises';
import {hash,wireDocument} from '../global-migration-plan.mjs';
import {transferStep,verifyTransfer} from './plan.mjs';
const fail=s=>{throw Error(s);};
export async function durableJournal(path,jobHash,stage){
 const lockPath=path+'.lock',lock=await open(lockPath,'wx',0o600);
 await lock.writeFile(JSON.stringify({pid:process.pid,jobHash,stage,startedAt:new Date().toISOString()}));await lock.sync();
 let handle,previous=[];
 try{
 try{handle=await open(path,'wx',0o600);}catch(e){if(e.code!=='EEXIST')throw e;const text=await readFile(path,'utf8');if(!text.endsWith('\n'))fail('Truncated journal; preserve and review');try{previous=text.trim().split('\n').map(JSON.parse);}catch{fail('Invalid journal');}for(let i=0;i<previous.length;i++){const {digest,...event}=previous[i];if(event.jobHash!==jobHash||event.stage!==stage||event.seq!==i||event.previous!==(previous[i-1]?.digest||null)||digest!==hash(event))fail('Journal changed or belongs to another job/stage');}handle=await open(path,'a',0o600);}
 let seq=previous.length,last=previous.at(-1)?.digest||null;
 return {append:async data=>{const event={...data,jobHash,stage,seq:seq++,previous:last};last=hash(event);await handle.writeFile(JSON.stringify({...event,digest:last})+'\n');await handle.sync();},close:async()=>{await handle.close();await lock.close();await unlink(lockPath);}};
 }catch(e){await handle?.close();await lock.close();await unlink(lockPath);throw e;}
}
export async function executeTransfer(job,store,{stage='data',execute=false,batchSize=200,review,maxBatches=10000,journal,observe=async()=>{}}={}){
 verifyTransfer(job);if(execute&&typeof journal!=='function')fail('Durable intent journal required');
 let commits=0,snapshots=0;
 async function inventory(reason){const start=performance.now(),http=store.stats?.http||0;const snapshot=await store.inventory();snapshots++;await observe({type:'inventory',reason,index:snapshots,milliseconds:performance.now()-start,http:(store.stats?.http||0)-http,documents:snapshot.documents.length,collections:Object.keys(snapshot.snapshot.collections||{}).length});return snapshot;}
 // Reuse the complete post-commit verification as the next batch's preflight.
 // No document/collection scope is skipped. A new invocation always reads afresh.
 let snapshot=await inventory('initial'),step=transferStep(job,snapshot,{stage,batchSize,review});
 for(;;){
  if(!execute||step.complete)return {jobHash:job.hash,stage,complete:step.complete,dryRun:!execute,commits,snapshots,remaining:step.remaining,nextWrites:step.writes.length,inventoryHash:step.inventoryHash,stats:{...store.stats}};
  if(commits>=maxBatches)fail('Batch limit reached; preserve journal and resume same job');
  const intent={type:'intent',inventoryHash:step.inventoryHash,writesHash:hash(step.writes),writes:step.writes.length};
  await journal(intent); // fail before any write if evidence cannot be persisted
  let responseLost=false;
  try{await store.commit(step.writes);}catch{responseLost=true;}
  // Always verify a whole atomic commit, even when the HTTP response was success.
  let after;
  try{after=await inventory('commit-readback');}catch{await journal({...intent,type:'uncertain',reason:'readback_unavailable'});fail('Commit outcome uncertain; inspect before retry');}
  const actual=new Map(after.documents.map(d=>[d.name,d])),before=new Map(snapshot.documents.map(d=>[d.name,d]));
  const eq=(a,b)=>!a&&!b||Boolean(a&&b&&hash(wireDocument(a))===hash(wireDocument(b)));
  const applied=step.writes.every(w=>w.delete?!actual.has(w.delete):eq(actual.get(w.update.name),w.update));
  const untouched=step.writes.every(w=>eq(actual.get(w.update?.name||w.delete),before.get(w.update?.name||w.delete)));
  if(!applied){await journal({...intent,type:'stopped',outcome:untouched?'not_observed':'mixed_or_drift'});fail(untouched?'Write not observed; no automatic retry':'Mixed write outcome or concurrent drift; stop');}
  // Reject unrelated concurrent writes before proceeding to another batch/activation.
  const next=transferStep(job,after,{stage,batchSize,review});commits++;
  await journal({...intent,type:'confirmed',responseLost});
  snapshot=after;step=next;
 }
}
