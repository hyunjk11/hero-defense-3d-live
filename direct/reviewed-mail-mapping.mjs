// Pure offline mapping for a deliberately narrow, reference-complete subset.
// Original direct rows/audits remain byte-identical in the reversal archive.
// No automatic allocation, RNG seed change, mutation of a live store or credentials.
import {fromDocument,toDocument} from '../server/firestore.mjs';
import {decodeFields} from '../src/account/direct-store.js';
import {hash,directRoot} from './global-migration-plan.mjs';
const fail=s=>{throw Object.assign(Error(s),{code:'REVERSE_MAPPING_REVIEW'});};
const key=m=>m.uid+'~'+m.from;
const positive=n=>Number.isSafeInteger(n)&&n>0;
export function validateMailMapping(mapping,direct,target,collisionReport){
 if(!mapping)return [];
 if(mapping.version!==1||mapping.directHash!==hash(direct)||mapping.targetHash!==hash(target)||typeof mapping.reviewedBy!=='string'||!mapping.reviewedBy.trim()||typeof mapping.reason!=='string'||!mapping.reason.trim()||!Array.isArray(mapping.entries)||!mapping.entries.length)fail('Explicit reviewed mapping bound to both frozen exports required');
 const historical=new Set(target.documents.filter(d=>d.name.includes('/hd3d_mail/')).map(d=>{const r=fromDocument(d);return r.user_id+'~'+r.id;}));
 const occupied=new Set(),sources=new Set(),destinations=new Set();let high=0;
 for(const d of target.documents){const t=d.name.split('/').at(-2),r=fromDocument(d);if(t==='hd3d_mail')occupied.add(r.id);if(t==='hd3d_sequences'&&r.id==='hd3d_mail')high=Math.max(high,r.value);}
 for(const d of direct.documents){const p=d.name.slice(directRoot.length+1).split('/');if(p[0]!=='hd3d_live')continue;const r=decodeFields(d.fields).row;if(p[2]==='hd3d_mail')occupied.add(r.id);if(p[2]==='hd3d_sequences'&&r.id==='hd3d_mail')high=Math.max(high,r.value);}
 for(const id of occupied)high=Math.max(high,id);
 for(const m of mapping.entries){
  if(Object.keys(m).sort().join()!=='from,table,to,uid'||m.table!=='hd3d_mail'||!/^[-A-Za-z0-9_]{1,128}$/.test(m.uid)||!positive(m.from)||!positive(m.to)||m.from===m.to)fail('Only explicit new finalized mail IDs are supported');
  if(sources.has(key(m))||destinations.has(m.to))fail('Mapping must be one-to-one; duplicate source/destination');sources.add(key(m));destinations.add(m.to);
  if(occupied.has(m.to)||m.to<=high)fail('Destination occupied or not above complete historical sequence high-water');
  if(historical.has(key(m)))fail('Historical mail identity cannot be remapped');
  if(!collisionReport.collisions.some(c=>c.table===m.table&&c.id===m.from&&c.records.some(r=>r.source==='direct'&&r.uid===m.uid)))fail('Mapping source is not an actual collision');
  const d=direct.documents.find(d=>d.name===directRoot+'/hd3d_live/'+m.uid+'/hd3d_mail/'+m.from),r=d&&decodeFields(d.fields).row;
  if(!r||r.user_id!==m.uid||r.id!==m.from||r.claimed!==true||r.server_applied!==true)fail('Mapped mail must already be fully applied');
  if(r.reward?.items?.length)fail('Item-bearing mail requires an explicit RNG/receipt policy; no seed remap');
  if(r.broadcast_id!=null)fail('Broadcast mail mapping is not supported');
 }
 return structuredClone(mapping.entries);
}
const allowed=(table,path)=>{
 if(table==='hd3d_owned')return path==='source_mail';
 if(table==='hd3d_dungeon_buys')return path==='mail_id';
 if(table==='hd3d_progress')return /^data\.(mailLog|mailRead)\.\d+$/.test(path);
 if(table==='hd3d_growth_runs')return path==='directReward.mail';
 if(table==='hd3d_dungeon_runs')return path==='reward.mail'||path==='boss_reward.mail';
 if(table==='hd3d_spire_runs')return path==='reward.mail';
 if(table==='hd3d_growth_investments')return path==='result.mail';
 return false;
};
// Only schema-known live reference locations may change. Unknown mail-bearing
// fields and opaque receipt identities are blockers, never substring rewrites.
export function mapLegacyAccountMail(documents,uid,entries){
 const selected=entries.filter(m=>m.uid===uid);if(!selected.length)return {documents,changes:[]};
 const changes=[],out=documents.map(d=>{
  const table=d.name.split('/').at(-2),row=fromDocument(d),before=structuredClone(row);
  for(const m of selected){
   const walk=(v,path='',mailContext=false)=>{
    if(!v||typeof v!=='object')return;
    for(const [k,x] of Object.entries(v)){
     const at=path?path+'.'+k:k,mail=mailContext||/mail/i.test(k);
     if((x===m.from||x===String(m.from))&&mail){if(!allowed(table,at))fail('Unsupported mail reference '+table+'.'+at);v[k]=typeof x==='string'?String(m.to):m.to;}
     else if(x&&typeof x==='object')walk(x,at,mail);
     else if(typeof x==='string'&&(x.includes('~mailitem~'+m.from+'~')||x.includes('~mailbudget~'+m.from+'~')||x==='mail:'+m.from))fail('Opaque mail receipt needs separate policy: '+table+'.'+at);
    }
   };
   if(table==='hd3d_growth_investments'&&typeof row.body==='string'){
    let opaque;try{opaque=JSON.parse(row.body);}catch{}
    const embedded=x=>x&&typeof x==='object'&&Object.entries(x).some(([k,v])=>(/mail/i.test(k)&&(v===m.from||v===String(m.from)))||embedded(v));
    if(embedded(opaque))fail('Opaque receipt body mail reference requires separate review');
   }
   walk(row);
   if(table==='hd3d_mail'&&row.id===m.from)row.id=m.to;
  }
  if(hash(row)===hash(before))return d;
  const mapped=toDocument(table,row);changes.push({uid,before:d,after:mapped});return mapped;
 });
 if(new Set(out.map(d=>d.name)).size!==out.length)fail('Mapping creates a duplicate document');
 return {documents:out,changes};
}
export function assertNoGlobalMailMappingReferences(direct,entries){
 for(const d of direct.documents){if(d.name.startsWith(directRoot+'/hd3d_live/'))continue;const v=decodeFields(d.fields);
  for(const m of entries){
   if(v.target!==m.uid&&v.uid!==m.uid&&v.row?.user_id!==m.uid)continue;
   const walk=(x,mail=false)=>{if(!x||typeof x!=='object')return;for(const [k,y] of Object.entries(x)){const mk=mail||/mail/i.test(k);if(mk&&(y===m.from||y===String(m.from)))fail('Global audit/delivery mail mapping needs separate review: '+d.name);if(y&&typeof y==='object')walk(y,mk);}};walk(v);
  }
 }
}
export function restoreMappedLegacy(documents,ledger){
 if(ledger?.version!==1||ledger.outputHash!==hash(documents)||!Array.isArray(ledger.changes)||ledger.ledgerHash!==hash({...ledger,ledgerHash:undefined}))fail('Mapping ledger/output changed');
 const by=new Map(documents.map(d=>[d.name,d]));
 for(const c of ledger.changes){if(hash(by.get(c.after.name))!==hash(c.after))fail('Mapped output drift');by.delete(c.after.name);}
 // A restored pre-mapping view can contain colliding global names. It is an
 // archive for inspection, NOT an importable plan or permission to overwrite.
 const restored=[...by.values(),...ledger.changes.map(c=>c.before)].sort((a,b)=>a.name.localeCompare(b.name)||hash(a).localeCompare(hash(b)));
 if(hash(restored)!==ledger.inputHash)fail('Reverse mapping integrity mismatch');return restored;
}
