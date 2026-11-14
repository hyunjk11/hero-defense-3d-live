import {orderSupportDocuments} from './order-migration.mjs';
// Offline export -> review plans only. No network, SDK, credentials or writes.
// Completeness and exclusive writer claims must be established by the exporter,
// not by this file or a player-provided checksum. Demo target remains enforced.
import {createHash} from 'node:crypto';
import {collectionNames,numericTables,PROJECT,ROOT,fromDocument,rowId} from '../server/firestore.mjs';
import {DEMO_PROJECT,encodeFields,decodeFields} from '../src/account/direct-store.js';
import {accountTables} from './migration.mjs';
import {planAccountMigration} from './migration-plan.mjs';
import {rankingDocuments,rankingBlockDocuments} from './ranking-migration.mjs';
import {normalizeLegacyTimestamp as time} from './legacy-timestamp.mjs';
import {stable} from '../src/account/direct-authority.js';
import * as catalog from './catalog.mjs';
export const legacyTables=[...collectionNames,'hd3d_sequences'];
export const directRoot=`projects/${DEMO_PROJECT}/databases/(default)/documents`;
export const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
const fail=s=>{throw Error(s);};
const uidOK=s=>typeof s==='string'&&/^[-A-Za-z0-9_]{1,128}$/.test(s);
const exactKeys=(a,b)=>Object.keys(a||{}).sort().join()===b.slice().sort().join();
export function readLegacyExport(bundle){
 const s=bundle?.snapshot;
 if(bundle?.format!==1||!Array.isArray(bundle.documents)||s?.sourceProject!==PROJECT||s.database!=='(default)'||s.complete!==true||s.writersStopped!==true||s.pendingClientJournals!==0||!exactKeys(s.tables,legacyTables))fail('Complete frozen global legacy export required');
 time(s.readTime);const rows=new Map(legacyTables.map(t=>[t,[]])),seen=new Set(),high={};
 for(const d of bundle.documents){
  if(!d.name?.startsWith(ROOT+'/'))fail('Unexpected legacy project');
  const [table,id,...tail]=d.name.slice(ROOT.length+1).split('/');
  if(tail.length||!rows.has(table)||seen.has(d.name))fail('Unknown or duplicate legacy identity');
  const row=fromDocument(d);if(!row||rowId(table,row)!==id)fail('Malformed legacy identity');
  seen.add(d.name);rows.get(table).push({document:d,row});
 }
 for(const [t,list] of rows)if(!Number.isSafeInteger(s.tables[t])||s.tables[t]!==list.length)fail('Global export count mismatch: '+t);
 for(const t of numericTables){
  const seq=rows.get('hd3d_sequences').find(x=>x.row.id===t)?.row.value;
  if(!Number.isSafeInteger(seq)||seq<0)fail('Missing trusted sequence: '+t);
  for(const {row:r} of rows.get(t))if(!Number.isSafeInteger(r.id)||r.id<=0||r.id>seq)fail('Sequence behind existing row: '+t);
  high[t]=seq;
 }
 return {rows,high};
}
function noticeDocument(r){
 const keys=['id','title','body','active','starts_at','ends_at','created_by','created_at','updated_at'];
 if(!exactKeys(r,keys)||!Number.isSafeInteger(r.id)||r.id<=0||typeof r.title!=='string'||!r.title.length||r.title.length>80||typeof r.body!=='string'||r.body.length>2000||typeof r.active!=='boolean'||!uidOK(r.created_by))fail('Unsupported legacy notice schema; preserve and review');
 const start=r.starts_at==null?'1970-01-01T00:00:00.000Z':time(r.starts_at),end=r.ends_at==null?'9999-12-31T23:59:59.000Z':time(r.ends_at);
 if(Date.parse(end)<=Date.parse(start))fail('Invalid notice schedule');
 return {name:directRoot+'/hd3d_live_notices/'+r.id,fields:{...encodeFields({row:r,revision:1,actor:r.created_by,lastRequest:'trusted-import'}),startsAt:{timestampValue:start},endsAt:{timestampValue:end},createdAt:{timestampValue:time(r.created_at)},updatedAt:{timestampValue:time(r.updated_at)}}};
}
export function globalProjections(accountRows){
 const users=[...accountRows.keys()].sort(),ranks=[],banned=[];
 const directory=users.map(uid=>({name:directRoot+'/hd3d_live_accounts/'+uid,fields:encodeFields({uid})}));
 for(const uid of users){const rows=accountRows.get(uid),ban=rows.some(x=>x.table==='hd3d_bans'),nick=rows.find(x=>x.table==='hd3d_profiles')?.row.nickname||'용사';if(ban)banned.push(uid);
  for(const {table,row:r} of rows)if(['hd3d_spire_best','hd3d_spire_weeks'].includes(table)&&r.best_floor>0)ranks.push({uid,kind:table==='hd3d_spire_best'?'all':'week',week:r.week,nick,floor:r.best_floor,at:r.best_at,excluded:ban});
 }
 return [...directory,...rankingDocuments(ranks),...rankingBlockDocuments(banned)];
}
export function planGlobalMigration(source){
 const {rows,high}=readLegacyExport(source),groups=new Map();
 for(const table of accountTables)for(const x of rows.get(table)){
  const uid=x.row.user_id??x.row.id;if(!uidOK(uid))fail('Invalid owner: '+table);
  if(!groups.has(uid))groups.set(uid,[]);groups.get(uid).push({...x,table});
 }
 const accounts=[];
 for(const uid of [...groups.keys()].sort()){
  const list=groups.get(uid),documents=list.map(x=>x.document);
  // Incomplete/profile-only legacy accounts need explicit bootstrap review;
  // never fabricate a missing authoritative save during a migration.
  accounts.push(planAccountMigration({format:1,uid,documents,sequenceHighWater:high,snapshot:{...source.snapshot,tables:Object.fromEntries(accountTables.map(t=>[t,list.filter(x=>x.table===t).length]))}}));
 }
 const orderSupport=orderSupportDocuments([...groups].map(([uid,rs])=>({uid,orders:rs.filter(x=>x.table==='hd3d_orders').map(x=>x.row)})),high.hd3d_orders);
 const global=[...orderSupport,...globalProjections(groups),...rows.get('hd3d_notices').map(x=>noticeDocument(x.row)),
  ...rows.get('hd3d_admin_log').map(({row})=>{time(row.created_at);return {name:directRoot+'/hd3d_live_legacy_audit/'+row.id,fields:encodeFields({row})};}),
  // Preserve broadcast history and references; no new broadcast mutation is
  // enabled by this offline archive. Default-deny Rules protect this archive.
  ...rows.get('hd3d_broadcasts').map(({row})=>({name:directRoot+'/hd3d_live_legacy_broadcasts/'+row.id,fields:encodeFields({row})})),
  ...Object.values(catalog).flatMap(fn=>fn())];
 const data=[...accounts.flatMap(p=>p.data),...global].sort((a,b)=>a.name.localeCompare(b.name));
 if(new Set(data.map(d=>d.name)).size!==data.length)fail('Duplicate converted document');
 const activations=accounts.map(p=>p.activation);
 return {version:1,productionReady:false,noExternalWrites:true,targetProject:DEMO_PROJECT,sourceHash:hash(source),dataHash:hash(data),activationHash:hash(activations),sourceBackup:structuredClone(source),accounts:accounts.map(p=>({uid:p.uid,sourceHash:p.sourceHash,saveHash:p.saveHash,sourceCounts:p.sourceCounts})),data,activations,
  required:['Complete trusted export including empty collection counts and global sequences','Reconcile all runs and journals; stop both writers','Import/verify every account and all global records before ANY activation','Keep the complete legacy export for rollback'],
  limits:['No live export/import or deployment','Profile-only/missing-save legacy accounts require review','Broadcast history retained; unsupported administrator mutations are not enabled','Client RNG fairness and combat attestation remain weaker than trusted server execution']};
}
function wire(v){if(Array.isArray(v))return v.map(wire);if(!v||typeof v!=='object')return v;if(Object.keys(v).length===1&&v.timestampValue){const n=time(v.timestampValue),m=n.match(/^(.*?)(?:\.(\d+))?Z$/);return {timestampValue:m[1]+'.'+(m[2]||'').padEnd(9,'0')+'Z'};}if(Object.keys(v).length===1&&v.arrayValue)return {arrayValue:{values:(v.arrayValue.values||[]).map(wire)}};if(Object.keys(v).length===1&&v.mapValue)return {mapValue:{fields:wire(v.mapValue.fields||{})}};return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,wire(x)]));}
export const wireDocument=d=>({name:d.name,fields:wire(d.fields)});
const value=wireDocument;
export function globalImportPlan(input,target,{activated=false,batchSize=400}={}){
 const plan=planGlobalMigration(input?.sourceBackup);
 if(input.sourceHash!==plan.sourceHash||hash(input.data)!==plan.dataHash||hash(input.activations)!==plan.activationHash)fail('Global plan modified after source verification');
 if(target?.project!==DEMO_PROJECT||target.database!=='(default)'||target.complete!==true||target.writersStopped!==true||!Array.isArray(target.documents))fail('Complete frozen demo target required');time(target.readTime);
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>400)fail('Invalid batch size');
 const expected=new Map([...plan.data,...plan.activations].map(d=>[d.name,value(d)])),actual=new Map();
 for(const d of target.documents){if(actual.has(d.name)||!expected.has(d.name)||hash(value(d))!==hash(expected.get(d.name)))fail('Target drift or unknown document; do not overwrite');actual.set(d.name,d);}
 const active=plan.activations.filter(d=>actual.has(d.name)),missing=plan.data.filter(d=>!actual.has(d.name));
 if(active.length&&missing.length)fail('Global data incomplete while an account is active');
 if(activated&&(missing.length||active.length!==plan.activations.length))fail('Activation verification incomplete');
 const batches=[];for(let i=0;i<missing.length;i+=batchSize)batches.push(missing.slice(i,i+batchSize).map(update=>({update,currentDocument:{exists:false}})));
 return {version:1,productionReady:false,noExternalWrites:true,sourceHash:plan.sourceHash,targetHash:hash(target),missing:missing.length,batches,verified:missing.length===0,
  // No activation writes are returned while any data remains unverified.
  activations:missing.length?[]:plan.activations.filter(d=>!actual.has(d.name)).map(update=>({update,currentDocument:{exists:false}})),activeAccounts:active.length};
}
