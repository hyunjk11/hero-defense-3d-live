// Offline preflight only. Numeric IDs participate in item RNG and receipts;
// therefore there is deliberately no automatic renumber/merge/delete option.
import {numericTables,fromDocument} from '../server/firestore.mjs';
import {decodeFields} from '../src/account/direct-store.js';
import {createHash} from 'node:crypto';
import {stable} from '../src/account/direct-authority.js';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
export function reverseCollisionReport(directDocuments,legacyDocuments){
 const ids=new Map(),scoped=[];
 const add=(table,id,uid,name,source)=>{const key=table+'/'+id;if(!ids.has(key))ids.set(key,[]);ids.get(key).push({uid,name,source});};
 for(const d of legacyDocuments){const t=d.name.split('/').at(-2);if(numericTables.has(t)&&t!=='hd3d_sequences'){const r=fromDocument(d);add(t,r.id,r.user_id??r.id,d.name,'legacy');}}
 for(const d of directDocuments){const parts=d.name.split('/'),i=parts.indexOf('hd3d_live');if(i<0||parts.length!==i+4)continue;const [,uid,table,id]=parts.slice(i);const r=decodeFields(d.fields).row;scoped.push({uid,name:d.name,row:r});if(numericTables.has(table))add(table,r.id,uid,d.name,'direct');}
 const collisions=[];
 for(const [key,records] of ids){const owners=[...new Set(records.map(x=>x.uid))];if(owners.length<2||!records.some(x=>x.source==='direct'))continue;const j=key.lastIndexOf('/'),table=key.slice(0,j),id=Number(key.slice(j+1));
  const refs=[],keys=table==='hd3d_mail'?new Set(['mail','mail_id','source_mail']):table==='hd3d_orders'?new Set(['order','order_id']):new Set(['run','run_id']);
  const walk=(v,path,doc,depth=0)=>{if(depth>32)throw Error('Reference inventory nesting limit');if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){const p=path+'.'+k;if(keys.has(k)&&(x===id||x===String(id)))refs.push({document:doc.name,field:p,uid:doc.uid});if(x&&typeof x==='object')walk(x,p,doc,depth+1);}};
  for(const d of scoped)if(owners.includes(d.uid))walk(d.row,'row',d);
  collisions.push({table,id,owners:owners.sort(),records:records.sort((a,b)=>a.name.localeCompare(b.name)),references:refs,requires:'Reviewed reference-complete mapping; mail IDs also affect deterministic item generation'});
 }
 collisions.sort((a,b)=>a.table.localeCompare(b.table)||a.id-b.id);
 return {version:1,status:collisions.length?'blocked':'no-collision',noExternalWrites:true,plannedWrites:0,automaticMapping:false,referenceCoverage:'Diagnostic known fields only, not permission or a complete mapping plan',directHash:hash(directDocuments),legacyHash:hash(legacyDocuments),collisions};
}
export function assertReverseCollisionFree(direct,legacy){const report=reverseCollisionReport(direct,legacy);if(report.collisions.length)throw Object.assign(Error('Global numeric ID collision requires reviewed remapping: '+report.collisions.map(x=>x.table+'/'+x.id).join(', ')),{code:'REVERSE_ID_COLLISION',report});return report;}
