// Local rehearsal job storage. A process crash leaves the lock for explicit
// operator inspection; it is never silently stolen based on elapsed time.
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {verifyJob} from './operator-plan.mjs';
import {runDueWeeks} from './weekly-runner.mjs';
export function weeklyRepository(directory){
 const path=week=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(week))throw Error('Invalid week key');return join(directory,week+'.json');};
 const load=async week=>{try{return JSON.parse(await readFile(path(week),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const save=async(week,value)=>{verifyJob(value.job);if(value.job.source.week!==week)throw Error('Wrong week');const old=await load(week);if(old&&old.job.jobHash!==value.job.jobHash)throw Error('Weekly job changed; preserve existing recovery evidence');
  await mkdir(directory,{recursive:true});const next=path(week)+'.'+randomUUID()+'.tmp';await writeFile(next,JSON.stringify(value,null,2),{flag:'wx'});await rename(next,path(week));};
 return {load,save};
}
export async function tickLocalWeeks(directory,store,options={}){
 await mkdir(directory,{recursive:true});const lock=join(directory,'weekly.lock'),id=randomUUID();
 try{await writeFile(lock,JSON.stringify({id,createdAt:new Date().toISOString(),purpose:'demo weekly rehearsal'}),{flag:'wx'});}catch(e){if(e.code==='EEXIST')throw Error('Weekly runner locked; inspect previous process outcome before recovery');throw e;}
 try{return await runDueWeeks(store,weeklyRepository(directory),options);}
 finally{const current=JSON.parse(await readFile(lock,'utf8'));if(current.id!==id)throw Error('Weekly lock ownership changed; preserved for review');await unlink(lock);}
}
