// Read-only prototype adapter. Existing server presentation functions are reused;
// Firestore Rules recheck a trusted current role on every private read. No Admin
// SDK, credentials, mutation or long-lived permissions cache is used here.
import {assertDirectConfig,decodeFields,unpackRow} from './direct-store.js';
import {admin,owner} from '../../server/admin.mjs';
import {day,week} from '../../server/common.mjs';
const names=new Set(['admin_users','admin_user','admin_orders','admin_log_list','admin_broadcast_count','admin_spire_card','admin_spire','owner_admins']);
export const isAdminReadOperation=op=>names.has(op.name?.replace(/^hd3d_/,''));
const tables=new Set(['users','profiles','progress','bans','admins','owned','orders','mail','dungeon_wallet','dungeon_runs','spire_best','spire_weeks','spire_runs']);
const fail=code=>Object.assign(Error(code),{code});
const uidOK=s=>typeof s==='string'&&/^[-A-Za-z0-9_]{1,128}$/.test(s);
export function createAdminReadTransport(config,{auth,fetcher=fetch,clock=Date.now}={}){
 const {root,endpoint}=assertDirectConfig(config);
 return async(op,user)=>{
  const name=op.name?.replace(/^hd3d_/,''),args=op.args||{};if(!names.has(name))throw fail('DIRECT_UNSUPPORTED');
  if(['admin_user','admin_spire_card'].includes(name)&&!uidOK(args.p_user))throw fail('INVALID_ARGUMENT');
  const current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};current();const token=await user.getIdToken();current();
  const call=async(path,body)=>{current();const res=await fetcher(`${endpoint}/v1/${root}${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const v=await res.json();current();if(!res.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR'),{status:res.status});return v;};
  const getDoc=async(path)=>{try{return await call('/'+path);}catch(e){if(e.status===404)return null;throw e;}};
  const role=async()=>{const d=await getDoc(`hd3d_live/${user.uid}/hd3d_admins/${user.uid}`);if(!d)throw fail('PERMISSION_DENIED');
   // A private index read exercises the full Rules role/activation/ban/email
   // check even when the caller's own role document is ordinarily readable.
   await call(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_live_accounts'}],limit:1}});return decodeFields(d.fields).row;};
  const initialRole=await role();if(name==='owner_admins'&&!initialRole.owner)throw fail('PERMISSION_DENIED');
  const cache=new Map(),memo=(k,fn)=>{if(!cache.has(k))cache.set(k,fn());return cache.get(k);};
  const scan=(parent,collection)=>memo(parent+'/'+collection,async()=>{
   const rows=[];let after;
   for(;;){const query={from:[{collectionId:collection}],orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:100,...(after?{startAt:{values:[{referenceValue:after}],before:false}}:{})};
    const list=(await call(parent+':runQuery',{structuredQuery:query})).filter(x=>x.document).map(x=>x.document);rows.push(...list);
    if(list.length<100)return rows;const last=list.at(-1).name;if(after===last)throw fail('INVALID_CURSOR');after=last;
   }
  });
  const ids=()=>memo('uids',async()=>{const ds=await scan('','hd3d_live_accounts');return ds.map(d=>decodeFields(d.fields).uid).filter(uidOK);});
  const get=async(t,id)=>{if(!tables.has(t)||typeof id!=='string'||id.includes('/'))throw fail('DIRECT_UNSUPPORTED');
   const uid=id.split('~')[0];if(!uidOK(uid))throw fail('INVALID_ARGUMENT');return memo('get:'+t+':'+id,async()=>{const d=await getDoc(`hd3d_live/${uid}/hd3d_${t}/${id}`);return d?unpackRow('hd3d_'+t,decodeFields(d.fields).row):null;});};
  const audits=()=>memo('audits',async()=>{
   const sets=await Promise.all(['hd3d_live_legacy_audit','hd3d_live_notice_audit','hd3d_live_moderation','hd3d_live_mail_audit','hd3d_live_admin_actions'].map(c=>scan('',c)));
   return sets.flatMap((ds,i)=>ds.map(d=>{const x=decodeFields(d.fields);return i===4?{id:'action:'+d.name.split('/').at(-1),admin_id:x.actor,admin_email:null,target_user:x.target,target_email:null,action:x.logAction,detail:x.detail,created_at:x.at}:i===0?x.row:{id:(i===1?'notice:':i===2?'moderation:':'mail:')+d.name.split('/').at(-1),admin_id:x.actor,admin_email:null,target_user:x.target||null,target_email:null,action:x.action==='admin_send_mail'?'mail_send':x.action.replace(/^admin_/,''),detail:i===1?{notice:x.notice,title:x.row?.title,active:x.row?.active}:i===2?{reason:x.reason}:{mail:x.mail,title:x.row.title,reward:x.row.reward},created_at:x.at};}));
  });
  const list=async(t,filters={})=>{
   if(t==='admin_log')return (await audits()).filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v));
   if(!tables.has(t))throw fail('DIRECT_UNSUPPORTED');const targets=filters.user_id?[filters.user_id]:filters.id&&['profiles','users'].includes(t)?[filters.id]:await ids();const rows=[];
   for(const uid of targets){if(!uidOK(uid))throw fail('INVALID_ARGUMENT');for(const d of await scan('/hd3d_live/'+uid,'hd3d_'+t))rows.push(unpackRow('hd3d_'+t,decodeFields(d.fields).row));}
   return rows.filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v));
  };
  const now=clock(),iso=new Date(now).toISOString(),c={uid:user.uid,user:{id:user.uid,email:user.email},now,iso,day:day(now),week:week(now),get,list,
   requireAdmin:()=>{},requireOwner:()=>{if(!initialRole.owner)throw fail('PERMISSION_DENIED');},
   wallet:async(uid)=>await get('dungeon_wallet',uid)||{user_id:uid,medals:0,earned:0,spent:0,titles:[],uniques:[],uq_pity:0,updated_at:iso}};
  let data;
  if(name==='admin_log_list'){
   const all=(await list('admin_log',args.p_action?{action:String(args.p_action).slice(0,40)}:{})).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id).localeCompare(String(a.id)));
   const offset=Math.max(0,Math.min(1000000,Math.floor(Number(args.p_offset)||0))),limit=Math.max(1,Math.min(100,Math.floor(Number(args.p_limit)||50)));data={ok:true,total:all.length,offset,limit,rows:all.slice(offset,offset+limit)};
  }else data=name==='owner_admins'?await owner(c,'admins',args):await admin(c,name.slice(6),args);
  const finalRole=await role();if(name==='owner_admins'&&!finalRole.owner)throw fail('PERMISSION_DENIED');current();return {data,error:null,status:200};
 };
}
