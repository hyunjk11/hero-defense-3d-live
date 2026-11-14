import {rankTimeKey} from '../src/account/direct-ranking.js';
import {normalizeLegacyTimestamp} from './legacy-timestamp.mjs';
import {DEMO_PROJECT,encodeFields} from '../src/account/direct-store.js';
// Offline projection from a trusted export. Do not use private user documents as
// the ranking query collection. No reads, credentials or deployment occur here.
export function rankingDocuments(rows,{project=DEMO_PROJECT}={}) {
  if(project!==DEMO_PROJECT)throw new Error('Prototype only');
  const seen=new Set();
  return rows.map(r=>{
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(r.uid)||!['all','week'].includes(r.kind)||
      !Number.isSafeInteger(r.floor)||r.floor<0||r.floor>100000||
      typeof r.nick!=='string'||r.nick.length>12||
      (r.kind==='week'&&!/^\d{4}-\d{2}-\d{2}$/.test(r.week)))throw new Error('Invalid ranking export');
    const at=normalizeLegacyTimestamp(r.at);rankTimeKey(at);
    if(r.kind==='week')normalizeLegacyTimestamp(r.week);
    const id=r.kind+'~'+(r.kind==='week'?r.week:'all')+'~'+r.uid;if(seen.has(id))throw Error('Duplicate ranking export');seen.add(id);
    const clean={uid:r.uid,kind:r.kind,week:r.kind==='week'?r.week:null,nick:r.nick,floor:r.floor,at,excluded:!!r.excluded};
    const fraction=at.match(/\.(\d+)Z$/)?.[1]||'';
    // Imported sub-microsecond ties remain exact strings. Live improved scores
    // replace this with a Rules-verified timestamp; non-improvements retain it.
    return {name:`projects/${project}/databases/(default)/documents/hd3d_live_ranks/${id}`,fields:{...encodeFields({...clean,revision:0}),at:/[1-9]/.test(fraction.slice(6))?{stringValue:at}:{timestampValue:at}}};
  });
}

// Must be built from the same complete, frozen ban export as all score views.
export function rankingBlockDocuments(uids,{project=DEMO_PROJECT}={}){
 if(project!==DEMO_PROJECT)throw Error('Prototype only');const seen=new Set();
 return uids.map(uid=>{if(!/^[-A-Za-z0-9_]{1,128}$/.test(uid)||seen.has(uid))throw Error('Invalid ban export');seen.add(uid);
 return {name:`projects/${project}/databases/(default)/documents/hd3d_live_rank_blocks/${uid}`,fields:{...encodeFields({uid,banned:true,revision:0,lastRequest:'trusted-import'}),updatedAt:{timestampValue:'1970-01-01T00:00:00.000Z'}}};});
}
