// Pure trusted-export conversion only. No credentials, network, deployment or
// role bootstrap. Existing notice IDs/body/scheduling are preserved exactly.
import {DEMO_PROJECT,encodeFields} from '../src/account/direct-store.js';
export function noticeDocuments(rows,{project=DEMO_PROJECT}={}){
 if(project!==DEMO_PROJECT||!Array.isArray(rows))throw Error('Prototype export only');
 const ids=new Set(),time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 return rows.map(r=>{
  if(!Number.isSafeInteger(r.id)||r.id<=0||ids.has(r.id)||typeof r.title!=='string'||!r.title.trim()||r.title.length>80||
   typeof r.body!=='string'||r.body.length>2000||typeof r.active!=='boolean'||
   typeof r.created_by!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(r.created_by)||!time(r.created_at)||!time(r.updated_at)||
   r.starts_at!=null&&!time(r.starts_at)||r.ends_at!=null&&!time(r.ends_at)||
   r.starts_at!=null&&r.ends_at!=null&&Date.parse(r.ends_at)<=Date.parse(r.starts_at))throw Error('Invalid notice export');
  ids.add(r.id);const row=Object.fromEntries(['id','title','body','active','starts_at','ends_at','created_by','created_at','updated_at'].map(k=>[k,r[k]??null]));
  const fields=encodeFields({row,revision:1,actor:r.created_by,lastRequest:'migration-'+r.id});
  fields.startsAt={timestampValue:r.starts_at||new Date(0).toISOString()};fields.endsAt={timestampValue:r.ends_at||'9999-12-31T23:59:59.000Z'};
  fields.createdAt={timestampValue:r.created_at};fields.updatedAt={timestampValue:r.updated_at};
  return {name:`projects/${project}/databases/(default)/documents/hd3d_live_notices/${r.id}`,fields};
 });
}
