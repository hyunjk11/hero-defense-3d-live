// Real-project plans remain offline. Rebuild the reviewed converter for every step.
import {prepareImport,prepareReverse,verifyJob,stepJob} from '../operator-plan.mjs';
import {hash,directRoot,wireDocument,legacyTables,readLegacyExport,planGlobalMigration} from '../global-migration-plan.mjs';
import {ROOT,PROJECT,fromDocument} from '../../server/firestore.mjs';
import {snapshotTimeParts} from './transport.mjs';
const fail=s=>{throw Error(s);};
const clean=ds=>ds.map(wireDocument).sort((a,b)=>a.name.localeCompare(b.name));
export const inventoryHash=ds=>hash(clean(ds));
// Offline inventory files must retain their exporter metadata. Recounting a
// malformed file would conceal omissions; this validates, never repairs it.
export function validateInventory(inventory){
 const s=inventory?.snapshot;
 if(inventory?.format!==1||s?.project!==PROJECT||s.database!=='(default)'||s.complete!==true||!Array.isArray(inventory.documents)||!s.collections||typeof s.collections!=='object'||Array.isArray(s.collections))fail('Complete target inventory with collection counts required');
 const instant=t=>{const p=snapshotTimeParts(t);return BigInt(p.seconds)*1000000000n+BigInt(p.nanos);},readAt=instant(s.readTime),counts=new Map(),seen=new Set();
 const path=(value,odd)=>{if(typeof value!=='string')fail('Invalid inventory path');const parts=value.split('/');if(parts.length%2!==(odd?1:0)||parts.some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f?#\\]/.test(p)))fail('Invalid inventory path');return parts;};
 for(const [c,n] of Object.entries(s.collections)){path(c,true);if(!Number.isSafeInteger(n)||n<0)fail('Invalid inventory collection count');counts.set(c,0);}
 for(const d of inventory.documents){
  if(!d?.name?.startsWith(ROOT+'/')||seen.has(d.name))fail('Duplicate/cross-project inventory document');seen.add(d.name);
  const parts=path(d.name.slice(ROOT.length+1),false),c=parts.slice(0,-1).join('/');
  if(!counts.has(c)||!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields))fail('Inventory document missing collection/fields');
  if(instant(d.updateTime)>readAt)fail('Document updateTime is newer than snapshot readTime');
  counts.set(c,counts.get(c)+1);
 }
 for(const [c,n] of counts)if(s.collections[c]!==n)fail('Inventory collection count mismatch: '+c);
 return inventory;
}
// Only Firestore document names and typed references change. User string values never change.
function field(v,from,to){
 if(Array.isArray(v))return v.map(x=>field(x,from,to));
 if(!v||typeof v!=='object')return v;
 return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='referenceValue'&&typeof x==='string'&&x.startsWith(from+'/')?to+x.slice(from.length):field(x,from,to)]));
}
export function relocate(ds,from,to){return ds.map(d=>{if(!d.name?.startsWith(from+'/'))fail('Unexpected document project');return {...d,name:to+d.name.slice(from.length),fields:field(d.fields,from,to)};});}
function fence(a){if(!a||a.writersStopped!==true||a.pendingClientJournals!==0||a.exclusiveWriterConfirmed!==true||typeof a.fenceId!=='string'||!a.fenceId.trim())fail('Reviewed exclusive-writer fence and zero pending journals required');}
function seal(demo,assurance){fence(assurance);const x={version:1,targetProject:PROJECT,database:'(default)',kind:demo.kind,assurance,demo};return {...x,hash:hash(x)};}
export function prepareTransfer(source,assurance){
 readLegacyExport(source);
 for(const d of source.documents){const t=d.name.split('/').at(-2),r=fromDocument(d);
  if(t==='hd3d_growth_investments'&&r.status==='pending'||t==='hd3d_growth_runs'&&r.directReward&&r.hardSaved!==true)fail('Unfinished reward/journal requires reconciliation');
 }
 return seal(prepareImport(source,assurance),assurance);
}
export function verifyTransfer(job){
 if(job?.version!==1||job.targetProject!==PROJECT||job.database!=='(default)'||!['import','reverse'].includes(job.kind))fail('Unsupported transfer target');
 if(job.kind==='reverse')verifyJob(job.demo);
 const rebuilt=job.kind==='import'?prepareTransfer(job.demo.source,job.assurance):seal(job.demo,job.assurance);
 if(job.kind!==job.demo.kind||hash(job)!==hash(rebuilt)||hash(job.assurance)!==hash(job.demo.assurance))fail('Transfer plan changed');return job;
}
export function legacyExport(inventory,assurance){
 fence(assurance);validateInventory(inventory);const s=inventory?.snapshot;
 if(s?.project!==PROJECT||s.database!=='(default)'||s.complete!==true||!s.collections||!Array.isArray(inventory.documents))fail('Complete real-project inventory required');
 for(const k of Object.keys(s.collections))if(!legacyTables.includes(k))fail('Unknown/non-legacy collection; review before export: '+k);
 const source={format:1,documents:structuredClone(inventory.documents),snapshot:{sourceProject:PROJECT,database:'(default)',complete:true,readTime:s.readTime,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(legacyTables.map(t=>[t,s.collections[t]||0]))}};
 readLegacyExport(source);return source;
}
export function rollbackSource(forwardJob,currentInventory,assurance){
 verifyTransfer(forwardJob);fence(assurance);validateInventory(currentInventory);if(forwardJob.kind!=='import')fail('Original import plan required');
 const s=currentInventory?.snapshot;
 if(s?.project!==PROJECT||s.database!=='(default)'||!s.complete)fail('Complete current inventory required');
 const legacy=[],privateDocs=[];
 for(const d of currentInventory.documents){if(!d.name.startsWith(ROOT+'/'))fail('Cross-project rollback data');const col=d.name.slice(ROOT.length+1).split('/')[0];if(legacyTables.includes(col))legacy.push(d);else if(col.startsWith('hd3d_live'))privateDocs.push(d);else fail('Unknown rollback collection');}
 const target=structuredClone(forwardJob.demo.source);target.documents=legacy;target.snapshot.readTime=s.readTime;
 target.snapshot.tables=Object.fromEntries(legacyTables.map(t=>[t,legacy.filter(d=>d.name.slice(ROOT.length+1).split('/')[0]===t).length]));
 const docs=relocate(privateDocs,ROOT,directRoot),collections=Object.fromEntries(Object.entries(s.collections).filter(([c])=>c.split('/')[0].startsWith('hd3d_live')));
 return {forward:planGlobalMigration(forwardJob.demo.source),target,direct:{format:1,documents:docs,snapshot:{project:'demo-hd3d-direct',database:'(default)',complete:true,readTime:s.readTime,writersStopped:true,pendingClientJournals:0,collections}}};
}
export function prepareRollback(forwardJob,currentInventory,assurance,mappings){const source=rollbackSource(forwardJob,currentInventory,assurance);if(mappings)source.idMapping=mappings;return seal(prepareReverse(source,assurance),assurance);}
export function activationReview(job,review){
 verifyTransfer(job);if(job.kind!=='import')fail('Import required');
 if(!review||review.jobHash!==job.hash||review.dataHash!==inventoryHash(relocate(job.demo.phases[0],directRoot,ROOT))||review.fenceId!==job.assurance.fenceId||!['rulesVerified','authVerified','originApproved','writersStillStopped','pendingJournalsZero'].every(k=>review[k]===true))fail('Activation review is incomplete');
 // These are operator attestations, not proof of Rules/auth/browser state.
 return review;
}
export function transferStep(job,inventory,{stage='data',batchSize=200,review}={}){
 verifyTransfer(job);validateInventory(inventory);const s=inventory?.snapshot;
 if(s?.project!==PROJECT||s.database!=='(default)'||s.complete!==true||!Array.isArray(inventory.documents))fail('Complete target inventory required');
 if(!['data','activate','reverse'].includes(stage)||job.kind==='reverse'&&stage!=='reverse'||job.kind==='import'&&stage==='reverse')fail('Wrong transfer stage');
 const local=relocate(inventory.documents,ROOT,directRoot),activations=job.kind==='import'?job.demo.phases[1].filter(d=>!job.demo.phases[0].some(p=>p.name===d.name)):[];
 if(stage==='activate')activationReview(job,review);
 const actual=new Map(local.map(d=>[d.name,d])),active=activations.filter(d=>actual.has(d.name));
 if(active.length&&active.length!==activations.length)fail('Partial activation detected; stop and review');
 if(active.length&&inventoryHash(local)!==inventoryHash(job.demo.phases[1]))fail('Activated database changed; preserve and review');
 const step=stepJob(job.demo,local,{batchSize:stage==='activate'?400:batchSize});
 if(stage==='activate'&&!step.complete&&step.phase!==1)fail('Data is not fully verified');
 if(stage==='data'&&(step.complete||step.phase===1))return {complete:true,stage,activated:step.complete,writes:[],remaining:0,inventoryHash:inventoryHash(inventory.documents)};
 if(stage==='activate'&&step.remaining>400)fail('More than 400 activations require a separately reviewed global gate');
 const writes=step.writes.map(w=>({...w,...(w.update?{update:relocate([w.update],directRoot,ROOT)[0]}:{delete:ROOT+w.delete.slice(directRoot.length)})}));
 return {...step,stage,writes,inventoryHash:inventoryHash(inventory.documents)};
}
