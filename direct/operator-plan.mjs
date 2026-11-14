// Reviewed, resumable operator jobs. Pure functions: no credentials or IO.
// They are LOCAL DEMO rehearsal jobs, not permission to change production.
import {planGlobalMigration,globalImportPlan,hash,directRoot,wireDocument,legacyTables} from './global-migration-plan.mjs';
import {planGlobalReverse} from './global-reverse-plan.mjs';
import {planWeeklyAwards} from './weekly-awards-plan.mjs';
import {DEMO_PROJECT,decodeFields} from '../src/account/direct-store.js';
import {ROOT,PROJECT,fromDocument} from '../server/firestore.mjs';
const fail=s=>{throw Error(s);};
const digest=x=>x==null?'missing':hash(x);
const clean=ds=>ds.map(wireDocument).sort((a,b)=>a.name.localeCompare(b.name));
const local=d=>({...wireDocument(d),name:d.name.replace(ROOT+'/',directRoot+'/')});
function fence(x){if(x?.writersStopped!==true||x.pendingClientJournals!==0||!x.exclusiveWriterConfirmed)fail('Exclusive writer and empty client journals must be confirmed by operator');}
function build(kind,source,before,phases,assurance){fence(assurance);const j={version:1,kind,project:DEMO_PROJECT,productionReady:false,source,before:clean(before),phases:phases.map(clean),assurance};return {...j,jobHash:hash(j)};}
export function prepareImport(source,assurance){
 const p=planGlobalMigration(source);globalImportPlan(p,{project:DEMO_PROJECT,database:'(default)',complete:true,writersStopped:true,readTime:source.snapshot.readTime,documents:[]});
 const before=source.documents.map(local);return build('import',source,before,[[...before,...p.data],[...before,...p.data,...p.activations]],assurance);
}
export function prepareReverse(source,assurance){
 const r=planGlobalReverse(source),before=[...source.target.documents.map(local),...source.direct.documents];
 // Preserve the full typed direct archive in the same demo store. Restored
 // legacy data may delete revoked rows, but never the direct recovery evidence.
 return build('reverse',source,before,[[...r.documents.map(local),...source.direct.documents]],assurance);
}
export function prepareWeekly(source,assurance){
 fence(assurance);if(source?.format!==1||source.complete!==true||!Array.isArray(source.documents))fail('Complete private demo inventory required');
 const docs=clean(source.documents);if(new Set(docs.map(d=>d.name)).size!==docs.length)fail('Duplicate private inventory');const rows=[],banned=[],accounts=new Set(),owners=new Set();let activeRuns=0;
 for(const d of docs){if(!d.name.startsWith(directRoot+'/'))fail('Cross-project source');const parts=d.name.slice(directRoot.length+1).split('/');if(parts[0]!=='hd3d_live')continue;
  const [,uid,table,id]=parts,v=decodeFields(d.fields),r=v.row;if(parts.length!==4||v.owner!==uid||v.version!==1)fail('Malformed private source');owners.add(uid);
  if(table==='hd3d_sequences'&&id==='_activation'){if(r.enabled!==false)fail('Disable all direct writers before weekly sealing');accounts.add(uid);}
  if(table==='hd3d_bans')banned.push(uid);
  if(table==='hd3d_spire_weeks'&&r.week===source.week)rows.push({uid,week:r.week,floor:r.best_floor,at:r.best_at,claimed:r.claimed});
  if(table==='hd3d_spire_runs'&&r.status==='active'||table==='hd3d_dungeon_runs'&&r.status==='active'||table==='hd3d_growth_runs'&&(!r.done||r.directReward&&r.hardSaved!==true)||table==='hd3d_growth_investments'&&r.status==='pending')activeRuns++;
 }
 for(const d of docs){if(d.name.includes('/hd3d_growth_investments/')){const r=decodeFields(d.fields).row;if(r.result?.action==='mail_item'){const uid=d.name.slice(directRoot.length+1).split('/')[1],mail=docs.find(x=>x.name===directRoot+'/hd3d_live/'+uid+'/hd3d_mail/'+r.result.mail);if(!mail||!decodeFields(mail.fields).row.claimed)fail('Partially applied mail must finish before sealing');}}}
 if([...owners].some(uid=>!accounts.has(uid)))fail('Missing account activation fence');
 for(const d of docs.filter(d=>d.name.includes('/hd3d_live_broadcast_jobs/'))){const job=decodeFields(d.fields);for(let i=0;i<job.targets.length;i++){const delivery=docs.find(x=>x.name===directRoot+'/hd3d_live_broadcast_deliveries/'+job.actor+'~'+job.request+'~'+i);if(!delivery||decodeFields(delivery.fields).target!==job.targets[i])fail('Incomplete broadcast must finish before sealing');}}
 const s={project:DEMO_PROJECT,complete:true,writersStopped:true,activeRuns,pendingJournals:0,week:source.week,capturedAt:source.capturedAt,rows:rows.sort((a,b)=>a.uid.localeCompare(b.uid)),banned:banned.sort()};
 const p=planWeeklyAwards(s),by=new Map(docs.map(d=>[d.name,d]));
 for(const d of p.grants){if(by.has(d.name)&&hash(by.get(d.name))!==hash(wireDocument(d)))fail('Existing weekly grant conflicts; never reseal or overwrite');by.set(d.name,d);}
 return build('weekly',source,docs,[[...by.values()]],assurance);
}
export function verifyJob(job){
 if(job?.version!==1||job.project!==DEMO_PROJECT||job.productionReady!==false)fail('Unsupported operator job');
 const rebuilt=job.kind==='import'?prepareImport(job.source,job.assurance):job.kind==='reverse'?prepareReverse(job.source,job.assurance):job.kind==='weekly'?prepareWeekly(job.source,job.assurance):fail('Unknown job');
 if(hash(job)!==hash(rebuilt))fail('Operator job/source/hash modified');return rebuilt;
}
export function stepJob(input,documents,{batchSize=200}={}){
 const job=verifyJob(input);if(!Number.isInteger(batchSize)||batchSize<1||batchSize>400)fail('Invalid operator batch size');
 const list=clean(documents);if(new Set(list.map(d=>d.name)).size!==list.length)fail('Duplicate inventory');
 let prior=job.before;const actual=new Map(list.map(d=>[d.name,d])),times=new Map(documents.map(d=>[d.name,d.updateTime]));
 for(let phase=0;phase<job.phases.length;phase++){
  const next=job.phases[phase],before=new Map(prior.map(d=>[d.name,d])),after=new Map(next.map(d=>[d.name,d]));
  if(hash(list)===hash(next)){prior=next;continue;}
  // Later phase values cannot pass as unfinished earlier phase values.
  // If data phase is complete and only activations are partially present,
  // first establish all earlier documents exactly before advancing the phase.
  if(phase+1<job.phases.length&&next.every(d=>digest(actual.get(d.name))===hash(d))&&list.every(d=>after.has(d.name)||job.phases[phase+1].some(x=>x.name===d.name&&hash(x)===hash(d)))){prior=next;continue;}
  for(const [name,d] of actual)if(hash(d)!==digest(before.get(name))&&hash(d)!==digest(after.get(name)))fail('Target drift or unknown document: '+name);
  for(const [name,d] of before)if(!actual.has(name)&&after.has(name))fail('Required original document missing: '+name);
  const writes=[];
  for(const [name,d] of after)if(digest(actual.get(name))!==hash(d))writes.push({update:d,currentDocument:actual.has(name)?{updateTime:times.get(name)||fail('Missing updateTime')}:{exists:false}});
  for(const name of before.keys())if(!after.has(name)&&actual.has(name))writes.push({delete:name,currentDocument:{updateTime:times.get(name)||fail('Missing updateTime')}});
  return {jobHash:job.jobHash,phase,complete:false,remaining:writes.length,writes:writes.slice(0,batchSize),inventoryHash:hash(list)};
 }
 if(hash(list)!==hash(job.phases.at(-1)))fail('Final inventory mismatch');return {jobHash:job.jobHash,complete:true,phase:job.phases.length,remaining:0,writes:[],inventoryHash:hash(list)};
}
