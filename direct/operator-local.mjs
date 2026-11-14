// Real HTTP execution against an isolated loopback demo emulator ONLY. No CLI
// config, ADC, service keys, Firebase login, production endpoint or redirects.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {dirname} from 'node:path';
import {directRoot,hash,wireDocument} from './global-migration-plan.mjs';
import {verifyJob,stepJob} from './operator-plan.mjs';
export function localStore(endpoint,{fetcher=fetch}={}){
 if(!/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(endpoint)||+endpoint.split(':').at(-1)>65535)throw Error('Literal loopback demo endpoint required');
 const stats={http:0,commits:0,documentWrites:0};
 const call=async(path,body)=>{stats.http++;const r=await fetcher(endpoint+'/v1/'+directRoot+path,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer owner','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error?.status||'EMULATOR_ERROR'),{status:r.status});return data;};
 const inventory=async()=>{
  const out=[];let calls=0;
  async function walk(parent,depth){if(depth>12||++calls>100000)throw Error('Inventory bounds exceeded');let token;
   do{const cols=await call(parent+':listCollectionIds',{pageSize:100,...(token?{pageToken:token}:{})});for(const col of cols.collectionIds||[]){if(!/^[A-Za-z0-9_-]+$/.test(col))throw Error('Unsupported collection identity');let page;
    do{const q=new URLSearchParams({pageSize:'100',showMissing:'true',...(page?{pageToken:page}:{})});const ds=await call(parent+'/'+col+'?'+q);
     for(const d of ds.documents||[]){if(!d.name.startsWith(directRoot+'/'))throw Error('Cross-project inventory');if(d.updateTime)out.push(d);await walk('/'+d.name.slice(directRoot.length+1),depth+1);}page=ds.nextPageToken;
    }while(page);
   }token=cols.nextPageToken;}while(token);
  }await walk('',0);return out;
 };
 const commit=async writes=>{for(const w of writes){if(!(w.update?.name||w.delete)?.startsWith(directRoot+'/')||!w.currentDocument)throw Error('Unfenced/cross-project write');}stats.commits++;stats.documentWrites+=writes.length;return call(':commit',{writes});};
 return {inventory,commit,stats};
}
export async function runLocalJob(job,store,{execute=false,batchSize=200,journal=async()=>{},maxBatches=10000}={}){
 verifyJob(job);let commits=0;const events=[];
 for(;;){const documents=await store.inventory(),step=stepJob(job,documents,{batchSize});
  const event={jobHash:job.jobHash,phase:step.phase,complete:step.complete,inventoryHash:step.inventoryHash,remaining:step.remaining,commits};events.push(event);await journal({version:1,jobHash:job.jobHash,events});
  if(!execute||step.complete)return {...event,dryRun:!execute,nextWrites:step.writes.length,stats:{...store.stats}};
  if(commits>=maxBatches)throw Error('Rehearsal batch limit reached; safe to resume unchanged job');
  try{await store.commit(step.writes);commits++;}
  catch(e){
   // Never blindly repeat an uncertain commit. Read back its whole result.
   const found=new Map((await store.inventory()).map(d=>[d.name,d]));
   const equal=(a,b)=>a&&b&&hash(wireDocument(a))===hash(wireDocument(b));
   const applied=step.writes.every(w=>w.delete?!found.has(w.delete):equal(found.get(w.update.name),w.update));
   if(!applied){await journal({version:1,jobHash:job.jobHash,events,outcome:'not_confirmed',error:e.message});throw e;}
   commits++;events.push({phase:step.phase,outcome:'commit_confirmed_after_error'});
  }
 }
}
// No production switch exists. Default is read-only dry-run; the explicit
// --execute-local switch only rehearses the reviewed job on the demo emulator.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [endpoint,file,journalPath,mode]=process.argv.slice(2);if(!endpoint||!file||!journalPath||mode&&!['--execute-local','--dry-run'].includes(mode))throw Error('Usage: node operator-local.mjs http://127.0.0.1:PORT job.json journal.json [--execute-local]');
 const job=JSON.parse(await readFile(file,'utf8')),store=localStore(endpoint);
 try{const old=JSON.parse(await readFile(journalPath,'utf8'));if(old.jobHash!==job.jobHash)throw Error('Journal belongs to a different job; preserve it');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(dirname(journalPath),{recursive:true});
 const result=await runLocalJob(job,store,{execute:mode==='--execute-local',journal:j=>writeFile(journalPath,JSON.stringify(j,null,2))});console.log(JSON.stringify(result,null,2));
}
