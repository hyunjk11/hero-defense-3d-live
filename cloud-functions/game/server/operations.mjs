import { archiveMail, archiveCandidates } from './mail-actions.mjs';
import { levelOf } from '../src/data/hero-growth.js';
import { context, denied, integer, itemReward, text } from './common.mjs';
import { growth } from './growth.mjs';
import { dungeon } from './dungeon.mjs';
import { spire } from './spire.mjs';
import { admin, owner } from './admin.mjs';
export function stripRetired(x) {
  if(x==null)return x;
  if(Array.isArray(x))return x.map(stripRetired).filter(x=>x!==null);
  if(typeof x==='object'){if('uq' in x||x.k==='uq'||String(x.id||'').startsWith('u_'))return null;const o={};for(const [k,v]of Object.entries(x)){if(['uqLog','uqPity','__proto__','constructor','prototype'].includes(k))continue;const p=stripRetired(v);if(p!==null)o[k]=p;}if(Array.isArray(o.items)&&!o.items.length)delete o.items;return o;}
  if(typeof x==='string'){if(x.startsWith('u_'))return null;if(x.startsWith('[')){try{const a=JSON.parse(x);if(Array.isArray(a)&&(a.length===3||String(a[0]||'').startsWith('u_')))return null;}catch{}}}return x;
}
function stripGrowthCache(data){const result={...data};delete result.growth;return result;}
function allowedKeys(obj,keys){if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))denied('invalid fields','23514');}
const advanceStamp=(now,old)=>new Date(Math.max(now,Number.isFinite(Date.parse(old))?Date.parse(old)+1:now)).toISOString();
const readTables=['profiles','progress','orders','mail','owned','notices','bans','admin_log','dungeon_wallet','dungeon_runs','dungeon_buys','spire_best','spire_runs','spire_weeks'];
export async function query(c,q){
  if(typeof q.table!=='string'||!q.table.startsWith('hd3d_'))denied();const table=q.table.slice(5);if(!readTables.includes(table))denied();
  const filters=q.filters||{};allowedKeys(filters,['id','user_id','item','updated_at','status','created_at','archived']);
  if(q.action==='select'){
    if(table==='admin_log')c.requireAdmin();const own=['profiles','progress','bans'].includes(table)||!c.admin&&!['notices','admin_log'].includes(table);
    if('archived' in filters && (table!=='mail'||typeof filters.archived!=='boolean'))denied('invalid archive filter','23514');
    const scoped={...filters};delete scoped.archived;if(own){const field=table==='profiles'?'id':'user_id';if(field in filters&&filters[field]!==c.uid)return {data:q.single?null:[],error:null};scoped[field]=c.uid;}
    const limit=integer(q.limit??200,1,1000);
    let rows=null;
    if(table==='mail'&&q.order?.field==='created_at'&&!q.order.ascending&&c.mailWindow)
      rows=await c.mailWindow(scoped,{limit,archived:filters.archived});
    if(rows===null)rows=await c.list(table,scoped);
    if(table==='mail'&&'archived' in filters)rows=rows.filter(m=>!!m.archived_at===filters.archived);
    if(table==='notices'&&!c.admin)rows=rows.filter(n=>n.active&&(!n.starts_at||Date.parse(n.starts_at)<=c.now)&&(!n.ends_at||Date.parse(n.ends_at)>c.now));
    if(q.order){if(!['created_at','updated_at','id'].includes(q.order.field))denied('invalid sort','23514');const factor=q.order.ascending?1:-1;rows.sort((a,b)=>typeof a[q.order.field]==='number'?factor*(a[q.order.field]-b[q.order.field]):factor*String(a[q.order.field]||'').localeCompare(String(b[q.order.field]||'')));}
    rows=rows.slice(0,integer(q.limit??200,1,1000));return {data:project(rows,q.columns,q.single),error:null};
  }
  c.requirePlayer();const v=q.values;let out=[];
  if(table==='profiles'&&q.action==='upsert'){
    allowedKeys(v,['id','nickname']);if(v.id!==c.uid)denied();if(typeof v.nickname!=='string'||[...v.nickname].length<1||[...v.nickname].length>12)denied('invalid nickname','23514');
    const old=await c.get(table,c.uid),row={id:c.uid,nickname:v.nickname,created_at:old?.created_at||c.iso,updated_at:advanceStamp(c.now,old?.updated_at)};await c.put(table,row);out=[row];
  }else if(table==='progress'&&['insert','update'].includes(q.action)){
    allowedKeys(v,q.action==='insert'?['user_id','data','merged']:['data','merged']);const target=q.action==='insert'?v.user_id:filters.user_id;if(target!==c.uid)denied();
    if(!v.data||typeof v.data!=='object'||Array.isArray(v.data)||new TextEncoder().encode(JSON.stringify(v.data)).length>=65536||typeof v.merged!=='boolean')denied('invalid save','23514');
    const old=await c.get(table,c.uid);if(q.action==='insert'&&old)denied('save already exists','23505');
    if(q.action==='update'&&(!old||typeof filters.updated_at!=='string'||filters.updated_at!==old.updated_at))return {data:[],error:null};
    // A pre-award or old-client save may not erase a committed hard reward.
    if(old?.data?.hardRewardSeq && v.data.hardRewardSeq!==old.data.hardRewardSeq)return {data:[],error:null};
    const gw=await c.get('growth_wallet',c.uid); if(gw) for(const h of Object.keys(v.data.adv||{})) if(!old?.data?.adv?.[h] && !(gw.legacyAdv||[]).includes(h) && levelOf(gw.xp[h])<10) denied('Hero level 10 required; update client before advancement','23514');
    const row={user_id:c.uid,data:stripGrowthCache(stripRetired(v.data)),merged:v.merged,created_at:old?.created_at||c.iso,updated_at:advanceStamp(c.now,old?.updated_at)};await c.put(table,row);out=[row];
  }else if(table==='orders'&&q.action==='insert'){
    allowedKeys(v,['item']);if(!itemReward(v.item))denied('invalid item','23514');
    if(await c.get('owned',c.uid+'~'+v.item)||(await c.list('orders',{user_id:c.uid,item:v.item,status:'pending'})).length)denied('already owned or pending','23505');
    const p=await c.get('profiles',c.uid);out=[await c.insert('orders',{user_id:c.uid,email:c.user.email,nickname:p?.nickname||'용사',item:v.item,status:'pending',decided_at:null,refunded_at:null,note:null,refund_note:null})];
  }else denied();
  return {data:q.returning?project(out,q.columns,q.single):null,error:null};
}
function project(rows,columns,single){if(columns&&columns!=='*'){const cols=columns.split(',').map(x=>x.trim());if(cols.some(x=>!/^[a-z_]+$/.test(x)))denied('invalid projection','23514');rows=rows.map(r=>Object.fromEntries(cols.map(k=>[k,r[k]??null])));}return single?rows[0]||null:rows;}
async function claimMail(c,a){
  c.requirePlayer();const m=await c.get('mail',a.p_mail_id);if(!m||m.user_id!==c.uid)denied('mail not found','P0002');if(m.revoked&&!m.claimed)denied('mail revoked','P0002');if(m.server_applied)return {ok:true,already:true,id:m.id,reward:null,serverSaved:true};if(m.claimed)return {ok:true,already:true,id:m.id,reward:m.reward};
  m.claimed=true;m.claimed_at=c.iso;await c.put('mail',m);
  if(m.reward?.hero){const item='hero_'+m.reward.hero;if(!await c.get('owned',c.uid+'~'+item))await c.insert('owned',{user_id:c.uid,item,source_mail:m.id});}
  if(m.reward?.medals>0){const w=await c.wallet();w.medals=Math.min(1000000,w.medals+m.reward.medals);w.earned+=m.reward.medals;w.updated_at=c.iso;await c.put('dungeon_wallet',w);}
  return {ok:true,already:false,id:m.id,reward:m.reward};
}
// Only side-effect-free reads enter this path. Status RPCs that may initialize
// wallets (growth/dungeon/spire) deliberately remain ordinary write transactions.
const simpleStatus=new Set(['my_status','is_admin','is_owner','is_banned']);
const isArchiveCandidateOp=op=>op?.kind==='rpc'&&typeof op.name==='string'&&op.name.replace(/^hd3d_/,'')==='mail_archive_candidates';
export function isReadOperation(op){
  if(!op||typeof op!=='object'||Array.isArray(op))return false;
  if(isArchiveCandidateOp(op))return true;
  if(op.kind==='query')return op.action==='select'&&typeof op.table==='string'&&op.table.startsWith('hd3d_')&&readTables.includes(op.table.slice(5));
  return op.kind==='rpc'&&typeof op.name==='string'&&simpleStatus.has(op.name.replace(/^hd3d_/,''));
}
const needsUserRecord=(known,user,now)=>!known||known.email!==String(user.email||'').toLowerCase()||now-Date.parse(known.last_sign_in_at||0)>1800000;
async function syncUserRecord(tx,user,now){
  const known=await tx.get('hd3d_users',user.id);
  if(needsUserRecord(known,user,now))await tx.put('hd3d_users',{id:user.id,email:String(user.email||'').toLowerCase(),created_at:known?.created_at||user.created_at||new Date(now).toISOString(),last_sign_in_at:new Date(now).toISOString()});
}
// In-flight metadata only: no permission/result cache and no TTL. Different
// backends or verified identities cannot share this promise. Failures propagate.
const userSyncs=new WeakMap();
function synchronizeUser(store,user,now){
  const scope=store.userSyncScope||store;let pending=userSyncs.get(scope);
  if(!pending){pending=new Map();userSyncs.set(scope,pending);}
  const key=JSON.stringify([user.id,String(user.email||'').toLowerCase()]);
  if(pending.has(key))return pending.get(key);
  const task=Promise.resolve().then(()=>store.transaction(tx=>syncUserRecord(tx,user,now)));
  pending.set(key,task);
  task.then(()=>{if(pending.get(key)===task)pending.delete(key);},()=>{if(pending.get(key)===task)pending.delete(key);});
  return task;
}
export async function runOperation(store,user,operation,options={}){
  if(!user?.id||!isReadOperation(operation)||typeof store.readOnly!=='function')return store.transaction(tx=>execute(tx,user,operation,options));
  const now=options.now??Date.now();
  const snapshot=await store.readOnly(async tx=>{
    const result=await execute(tx,user,operation,{...options,now,syncUserRecord:false});
    if(isArchiveCandidateOp(operation))return {result,needsSync:false};
    const known=await tx.get('hd3d_users',user.id);
    return {result,needsSync:needsUserRecord(known,user,now)};
  },['admins','bans','users'].map(t=>['hd3d_'+t,user.id]));
  // Release the read snapshot before touching metadata. Preserve synchronous
  // user initialization / 30-minute last-seen semantics; never hide a failed sync.
  if(snapshot.needsSync){
    const sync=()=>synchronizeUser(store,user,now);
    if(store.timing)await store.timing.measure('metadata.sync',sync);else await sync();
  }
  return snapshot.result;
}
export async function execute(tx,user,operation,options={}){
  if(!operation||typeof operation!=='object'||Array.isArray(operation))denied('invalid request','23514');
  const c=await context(tx,user,options);
  // Firebase supplies verified identity. Existing UIDs, save timestamps and local keys survive migration.
  if(options.syncUserRecord!==false&&!isArchiveCandidateOp(operation))await syncUserRecord(tx,user,c.now);
  if(operation.kind==='query')return query(c,operation);
  if(operation.kind!=='rpc'||typeof operation.name!=='string')denied();
  const name=operation.name.replace(/^hd3d_/,''),a=operation.args||{};let result;
  if(name==='my_status')result={admin:c.admin,owner:c.owner,banned:!!c.ban,ban_reason:c.ban?.reason||null,banned_at:c.ban?.created_at||null};
  else if(name==='mail_archive_candidates')result=await archiveCandidates(c,a);
  else if(name==='mail_archive')result=await archiveMail(c,a);
  else if(name==='claim_mail')result=await claimMail(c,a);
  else if(name.startsWith('growth_'))result=await growth(c,name.slice(7),a,{hardFirstBonus:options.hardFirstBonus,awakening:options.awakening});
  else if(name.startsWith('dungeon_'))result=await dungeon(c,name.slice(8),a);
  else if(name.startsWith('spire_'))result=await spire(c,name.slice(6),a);
  else if(name.startsWith('admin_'))result=await admin(c,name.slice(6),a);
  else if(name.startsWith('owner_'))result=await owner(c,name.slice(6),a);
  else if(name==='is_admin')result=c.admin;
  else if(name==='is_owner')result=c.owner;
  else if(name==='is_banned')result=!!c.ban;
  else denied('unsupported operation','PGRST202');
  if(result===null||result===undefined)denied('unsupported operation','PGRST202');return {data:result,error:null};
}
