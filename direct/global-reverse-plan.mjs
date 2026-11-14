// Pure offline global reversal. Never resolves numeric collisions by dropping or
// silently renumbering rows: mail seeds and historical references depend on IDs.
import {week} from '../server/common.mjs';
import {assertReverseCollisionFree,reverseCollisionReport} from './reverse-collisions.mjs';
import {validateMailMapping,mapLegacyAccountMail,assertNoGlobalMailMappingReferences} from './reviewed-mail-mapping.mjs';
import {planGlobalMigration,readLegacyExport,hash,directRoot,wireDocument} from './global-migration-plan.mjs';
import {planReverseMigration} from './reverse-plan.mjs';
import {accountTables} from './migration.mjs';
import {PROJECT,numericTables,toDocument,fromDocument} from '../server/firestore.mjs';
import {DEMO_PROJECT,decodeFields} from '../src/account/direct-store.js';
import {normalizeLegacyTimestamp as time} from './legacy-timestamp.mjs';
const fail=s=>{throw Error(s);};
const globals=new Set(['hd3d_live_spire_resets','hd3d_live_order_counter','hd3d_live_order_requests','hd3d_live_accounts','hd3d_live_ranks','hd3d_live_rank_blocks','hd3d_live_notices','hd3d_live_legacy_audit','hd3d_live_legacy_broadcasts','hd3d_live_notice_audit','hd3d_live_moderation','hd3d_live_mail_audit','hd3d_live_broadcast_jobs','hd3d_live_broadcast_control','hd3d_live_broadcast_deliveries','hd3d_live_admin_actions','hd3d_live_admin_requests','hd3d_live_mail_specs','hd3d_live_catalog']);
const content=wireDocument;
export function planGlobalReverse({forward,direct,target,idMapping}){
 const original=planGlobalMigration(forward?.sourceBackup);
 if(forward.sourceHash!==original.sourceHash||hash(forward.data)!==original.dataHash||hash(forward.activations)!==original.activationHash)fail('Forward plan drift');
 const legacy=readLegacyExport(target),source=readLegacyExport(original.sourceBackup);
 const old=new Map(original.sourceBackup.documents.map(d=>[d.name,content(d)]));
 if(target.documents.length!==old.size||target.documents.some(d=>hash(content(d))!==hash(old.get(d.name))))fail('Legacy target changed since cutover');
 const s=direct?.snapshot;
 if(direct?.format!==1||!Array.isArray(direct.documents)||s?.project!==DEMO_PROJECT||s.database!=='(default)'||s.complete!==true||s.writersStopped!==true||s.pendingClientJournals!==0||!s.collections)fail('Complete frozen direct snapshot required');time(s.readTime);
 const seen=new Map(),groups=new Map(),global=new Map(),counts={};
 for(const d of direct.documents){
  if(!d.name?.startsWith(directRoot+'/')||seen.has(d.name))fail('Duplicate/cross-project direct row');seen.set(d.name,d);
  const path=d.name.slice(directRoot.length+1).split('/'),col=path.slice(0,-1).join('/');counts[col]=(counts[col]||0)+1;
  if(path[0]==='hd3d_live'){
   const [,uid,table,id]=path;if(path.length!==4||!/^[-A-Za-z0-9_]{1,128}$/.test(uid)||![...accountTables,'hd3d_sequences'].includes(table)||!id)fail('Unsupported direct account collection');
   if(!groups.has(uid))groups.set(uid,[]);groups.get(uid).push(d);
  }else{if(path.length!==2||!globals.has(path[0]))fail('Unsupported direct global collection');if(!global.has(path[0]))global.set(path[0],[]);global.get(path[0]).push(d);}
 }
 for(const [col,n] of Object.entries(counts))if(s.collections[col]!==n)fail('Direct collection count mismatch');
 for(const [col,n] of Object.entries(s.collections))if(!Number.isSafeInteger(n)||n<0||(counts[col]||0)!==n)fail('Direct collection inventory mismatch');
 const sourceUids=original.accounts.map(p=>p.uid);if(sourceUids.some(uid=>!groups.has(uid)))fail('Historical account missing');
 const directory=(global.get('hd3d_live_accounts')||[]).map(d=>decodeFields(d.fields).uid).sort();
 if(directory.join()!==[...groups.keys()].sort().join())fail('Account directory incomplete');
 // Original immutable archives and trusted catalog cannot disappear/change.
 for(const d of original.data.filter(d=>['hd3d_live_legacy_audit','hd3d_live_legacy_broadcasts','hd3d_live_catalog'].includes(d.name.split('/').at(-2))))if(hash(content(seen.get(d.name)||{}))!==hash(content(d)))fail('Trusted archive/catalog changed');
 const collisions=reverseCollisionReport(direct.documents,target.documents);
 const mappings=validateMailMapping(idMapping,direct,target,collisions),mappingChanges=[];
 assertNoGlobalMailMappingReferences(direct,mappings);
 const mappedNames=new Set(mappings.map(m=>directRoot+'/hd3d_live/'+m.uid+'/hd3d_mail/'+m.from));
 const collisionPreflight=assertReverseCollisionFree(direct.documents.filter(d=>!mappedNames.has(d.name)),target.documents);
 const reviewedRemovals=resetRemovals(groups,global);
 const numericOwners=Object.fromEntries([...numericTables].map(t=>[t,Object.fromEntries(legacy.rows.get(t).map(({row:r})=>[r.id,r.user_id??r.id]))]));
 const high={...legacy.high},documents=[],accounts=[];
 validateOrderInventory(groups,global,source.high.hd3d_orders,high);
 for(const uid of [...groups.keys()].sort()){
  const input=original.sourceBackup.documents.filter(d=>accountTables.includes(d.name.split('/').at(-2))&&(fromDocument(d).user_id??fromDocument(d).id)===uid),ds=groups.get(uid);
  const backup={format:1,uid,documents:input,sequenceHighWater:source.high,snapshot:{...original.sourceBackup.snapshot,tables:Object.fromEntries(accountTables.map(t=>[t,input.filter(d=>d.name.split('/').at(-2)===t).length]))}};
  const p=planReverseMigration({original:backup,reviewedRemovals:reviewedRemovals.filter(x=>x.target===uid),newAccount:!sourceUids.includes(uid),direct:{uid,documents:ds,snapshot:{...s,tables:Object.fromEntries([...accountTables,'hd3d_sequences'].map(t=>[t,ds.filter(d=>d.name.split('/').at(-2)===t).length]))}},target:{project:PROJECT,database:'(default)',writersStopped:true,readTime:target.snapshot.readTime,numericOccupancyComplete:true,accountDocuments:input,numericOwners:{...numericOwners,hd3d_mail:Object.fromEntries(Object.entries(numericOwners.hd3d_mail).filter(([id])=>!mappings.some(m=>m.uid===uid&&String(m.from)===id)))},sequenceHighWater:legacy.high}});
  const mapped=mapLegacyAccountMail(p.documents,uid,mappings);mappingChanges.push(...mapped.changes);
  documents.push(...mapped.documents);accounts.push({uid,dataHash:hash(mapped.documents),newAccount:!sourceUids.includes(uid)});
  for(const m of mappings.filter(m=>m.uid===uid))high.hd3d_mail=Math.max(high.hd3d_mail,m.to);
  for(const t of numericTables)high[t]=Math.max(high[t],p.sequenceHighWater[t]);
 }
 // Detect cross-account collisions even when neither ID occupied legacy data.
 const ids=new Set();for(const d of documents){if(ids.has(d.name))fail('Cross-account numeric ID collision requires reviewed remapping: '+d.name.split('/').slice(-2).join('/'));ids.add(d.name);}
 const append=(table,row)=>{const d=toDocument(table,row);if(ids.has(d.name))fail('Global ID collision');ids.add(d.name);documents.push(d);if(numericTables.has(table)){if(!Number.isSafeInteger(row.id)||row.id<=0)fail('Invalid global numeric ID');high[table]=Math.max(high[table],row.id);}};
 for(const d of global.get('hd3d_live_notices')||[])append('hd3d_notices',decodeFields(d.fields).row);
 for(const d of global.get('hd3d_live_legacy_audit')||[])append('hd3d_admin_log',decodeFields(d.fields).row);
 for(const d of global.get('hd3d_live_legacy_broadcasts')||[])append('hd3d_broadcasts',decodeFields(d.fields).row);
 for(const d of global.get('hd3d_live_broadcast_jobs')||[]){const r=decodeFields(d.fields);time(r.at);const deliveries=global.get('hd3d_live_broadcast_deliveries')||[];for(let i=0;i<r.targets.length;i++){const found=deliveries.find(x=>x.name.endsWith('/'+r.actor+'~'+r.request+'~'+i));if(!found)fail('Incomplete broadcast must resume before reversal');const delivery=decodeFields(found.fields),m=seen.get(directRoot+'/hd3d_live/'+r.targets[i]+'/hd3d_mail/'+delivery.mail),row=m?decodeFields(m.fields).row:null;if(delivery.job!==r.actor+'~'+r.request||delivery.actor!==r.actor||delivery.index!==i||delivery.target!==r.targets[i]||!row||row.user_id!==r.targets[i]||row.broadcast_id!==r.bid||row.title!==r.title||row.body!==r.body||hash(row.reward)!==hash(r.reward))fail('Broadcast receipt/mail integrity mismatch');}append('hd3d_broadcasts',{id:r.bid,title:r.title,body:r.body,reward:r.reward,recipients:r.targets.length,created_by:r.actor,created_at:r.at});}
 for(const d of [...global.get('hd3d_live_notice_audit')||[],...global.get('hd3d_live_moderation')||[],...global.get('hd3d_live_mail_audit')||[],...global.get('hd3d_live_admin_actions')||[]].sort((a,b)=>a.name.localeCompare(b.name))){
  const r=decodeFields(d.fields);if(typeof r.actor!=='string'||typeof r.action!=='string')fail('Malformed direct audit');time(r.at);
  const id=++high.hd3d_admin_log;if(!Number.isSafeInteger(id))fail('Audit sequence overflow');
  append('hd3d_admin_log',{id,admin_id:r.actor,admin_email:null,target_user:r.target||null,target_email:null,action:r.logAction|| (r.action==='admin_send_mail'?'mail_send':r.action.replace(/^admin_/,'')),detail:{directSource:d.name.slice(directRoot.length+1),record:r},created_at:r.at});
 }
 for(const t of numericTables)append('hd3d_sequences',{id:t,value:high[t]});
 // Preserve any nonnumeric legacy sequence metadata as well.
 for(const {row} of source.rows.get('hd3d_sequences'))if(!numericTables.has(row.id))append('hd3d_sequences',row);
 documents.sort((a,b)=>a.name.localeCompare(b.name));
 const bundle={format:1,documents,snapshot:{...target.snapshot,readTime:s.readTime,tables:Object.fromEntries([...legacy.rows.keys()].map(t=>[t,documents.filter(d=>d.name.split('/').at(-2)===t).length]))}};
 // Rebuild the forward representation from the latest state to validate all
 // account saves, notices and rank timestamps without using public rank data.
 const roundtrip=planGlobalMigration(bundle);
 const historicalNotices=source.rows.get('hd3d_notices').map(x=>x.row.id);if(historicalNotices.some(id=>!documents.some(d=>d.name.endsWith('/hd3d_notices/'+id))))fail('Historical notice missing');
 let mappingLedger=null;
 if(mappings.length){
  const changedNames=new Set(mappingChanges.map(c=>c.after.name));
  const input=[...documents.filter(d=>!changedNames.has(d.name)),...mappingChanges.map(c=>c.before)].sort((a,b)=>a.name.localeCompare(b.name)||hash(a).localeCompare(hash(b)));
  mappingLedger={version:1,scope:'Finalized currency/hero mail only; original direct archive is unchanged',mapping:structuredClone(idMapping),changes:mappingChanges,inputHash:hash(input),outputHash:hash(documents)};
  mappingLedger.ledgerHash=hash(mappingLedger);
 }
 return {version:1,productionReady:false,noExternalWrites:true,mappingLedger,sourceHash:original.sourceHash,directHash:hash(direct),targetHash:hash(target),dataHash:hash(documents),documents,accounts,collisionPreflight,sequenceHighWater:high,roundtripSaveHashes:roundtrip.accounts.map(a=>({uid:a.uid,saveHash:a.saveHash})),
  archivedDirectSnapshot:structuredClone(direct),
  required:['All direct activations disabled and all rewards/journals finalized','Exclusive writer fence and exact target recheck immediately before approved writes','Verify all reconstructed saves and global sequences before switching client','Retain the full direct snapshot including typed receipts and public projections'],
  limits:['No live writes or automatic ID remapping','Public ranks are derived; private best/week rows are authoritative','Direct serverless RNG/attestation limitations do not disappear on reversal']};
}

// Counter and guards originate from the complete trusted import, never from a
// browser's partial query. Receipt identities remain immutable after decisions.
function validateOrderInventory(groups,global,originalHigh,high){
 const counters=global.get('hd3d_live_order_counter')||[];
 if(counters.length!==1||!counters[0].name.endsWith('/main'))fail('Order allocator missing/ambiguous');
 const counter=decodeFields(counters[0].fields);if(Object.keys(counter).join()!=='value'||!Number.isSafeInteger(counter.value)||counter.value<originalHigh)fail('Order allocator regressed');
 const orders=new Map();
 for(const [uid,docs] of groups){
  const scoped=new Map(docs.map(d=>[d.name.split('/').slice(-2).join('/'),decodeFields(d.fields).row]));
  for(const d of docs.filter(d=>d.name.includes('/hd3d_orders/'))){const r=decodeFields(d.fields).row;if(r.id>counter.value)fail('Order exceeds global allocator');orders.set(uid+'~'+r.id,r);}
  for(const item of ['hero_gunner','hero_mechanic','hero_fighter']){
   const g=scoped.get('hd3d_sequences/order-pending-'+item),pending=[...orders].filter(([k,r])=>k.startsWith(uid+'~')&&r.item===item&&r.status==='pending').map(x=>x[1]);
   if(!g||!Number.isSafeInteger(g.value)||g.value<0||pending.length>1||(pending.length&&g.value!==pending[0].id))fail('Pending-order guard mismatch');
   if(g.value){const r=scoped.get('hd3d_orders/'+g.value);if(!r||r.item!==item||r.user_id!==uid)fail('Pending-order guard target missing');}
  }
 }
 for(const d of global.get('hd3d_live_order_requests')||[]){
  const x=decodeFields(d.fields),r=orders.get(x.uid+'~'+x.order);
  if(!r||d.name.split('/').at(-1)!==x.uid+'~'+x.request||!/^[-A-Za-z0-9_]{8,64}$/.test(x.request)||x.item!==r.item||x.row.status!=='pending'||x.row.decided_at!==null||x.row.refunded_at!==null||x.row.note!==null||x.row.refund_note!==null)fail('Order receipt identity mismatch');
  for(const key of ['id','user_id','email','nickname','item','created_at'])if(hash(x.row[key])!==hash(r[key]))fail('Order receipt/source mismatch');
  time(x.at);time(x.row.created_at);
 }
 high.hd3d_orders=Math.max(high.hd3d_orders,counter.value);
}

function resetRemovals(groups,global){
 const actions=global.get('hd3d_live_admin_actions')||[],removals=[];
 for(const d of actions){const a=decodeFields(d.fields);if(a.action!=='admin_spire_reset')continue;
  if(!groups.has(a.target)||a.week!==week(Date.parse(time(a.at)))||!a.result?.ok||!a.reason||d.name.split('/').at(-1)!==a.actor+'~'+a.request)fail('Invalid reset audit');
  removals.push({key:'hd3d_spire_weeks/'+a.target+'~'+a.week,target:a.target,action:a.action,audit:d.name});
 }
 for(const d of global.get('hd3d_live_spire_resets')||[]){const r=decodeFields(d.fields),a=actions.find(x=>x.name.endsWith('/'+r.actor+'~'+r.request));
  if(!a||d.name.split('/').at(-1)!==r.uid)fail('Reset marker audit missing');const v=decodeFields(a.fields);
  if(v.action!=='admin_spire_reset'||v.target!==r.uid||v.week!==r.week||v.revision!==r.revision||time(v.at)!==time(r.at))fail('Reset marker audit mismatch');
 }
 return removals;
}
