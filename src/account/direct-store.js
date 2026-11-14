import {batchSnapshotReads} from './direct-snapshot-batch.js';
import {createOrderTransport} from './direct-orders.js';
import {createBroadcastTransport} from './direct-broadcast.js';
import {createAdminActionTransport,isAdminAction} from './direct-admin-actions.js';
import {directChallenge} from './direct-challenge.js';
import {createAdminMailTransport,isAdminMailOperation} from './direct-admin-mail.js';
// Explicit direct adapter. Rules arbitrate every request; rollout is separately gated.
// No service credentials, Admin SDK, or Worker is used by this transport.
import { FirestoreTransaction, ROOT } from '../../server/firestore.mjs';
import {createAdminReadTransport,isAdminReadOperation} from './direct-admin-read.js';
import {directSpireStatus} from './direct-spire.js';
import {directSpireStart} from './direct-spire-start.js';
import {directSpireWeek} from './direct-spire-week.js';
import {createModerationTransport,isModerationOperation} from './direct-moderation.js';
import {directRank} from './direct-ranking.js';
import {appendRankWrites} from './direct-rank-write.js';
import {createNoticeTransport,isNoticeOperation} from './direct-notices.js';
import {packGearItem,unpackGearItem,packSubs,unpackSubs,preserveGear,packTypedItem} from './direct-gear.js';
import {directHard} from './direct-hard.js';
import {directNormal} from './direct-normal.js';
import {directGear} from './direct-economy.js';
import {reconcileDirectSave} from './direct-save-view.js';
import {directDungeonBuy} from './direct-dungeon-shop.js';
import {directClaimMail} from './direct-operations.js';
import { runOperation } from '../../server/operations.mjs';
import {authorityOf,authoritativeSave,trainingIntent} from './direct-authority.js';
import {resolveDirectConfig} from './direct-config.js';
export {DEMO_PROJECT} from './direct-config.js';
export const DIRECT_VERSION = 1;
const copy = x => x == null ? x : JSON.parse(JSON.stringify(x));
const err = (code, message) => Object.assign(new Error(message), {code});
const encode = x => {
  if(x === null)return {nullValue:null};
  if(typeof x === 'boolean')return {booleanValue:x};
  if(typeof x === 'number'){if(!Number.isFinite(x))throw err('INVALID_DATA','Non-finite data');return Number.isInteger(x)?{integerValue:String(x)}:{doubleValue:x};}
  if(typeof x === 'string')return {stringValue:x};
  if(Array.isArray(x))return {arrayValue:{values:x.map(v=>{if(Array.isArray(v))throw err('INVALID_DATA','Nested arrays require migration');return encode(v);})}};
  if(x&&typeof x==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]))}};
  throw err('INVALID_DATA','Unsupported Firestore value');
};
const decode = v => {
  if('nullValue'in v)return null;if('booleanValue'in v)return v.booleanValue;
  if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
  if('stringValue'in v)return v.stringValue;if('timestampValue'in v)return v.timestampValue;
  if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);
  if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));
  throw err('INVALID_DATA','Unsupported Firestore field');
};
// Save blobs can contain nested packed arrays. Keep that pre-existing format
// byte-for-byte, labelled untrusted, separate from access/authority documents.
export function packRow(table,row) {
  row=copy(row);
  if(table==='hd3d_growth_investments'&&row?.id?.includes('~gear~')&&row.result?.opened)row.result.opened=row.result.opened.map(x=>({...x,it:packGearItem(x.it)}));
  if(table==='hd3d_growth_investments'&&row?.id?.includes('~gear~')){if(row.result?.it)row.result.it=row.result.action==='craft'?packTypedItem(row.result.it):packGearItem(row.result.it);if(row.result?.sub)row.result.sub=packSubs(row.result.sub);}
  if(table==='hd3d_growth_investments'&&['normal_settle','hard_settle'].includes(row?.action))row.result.loot=row.result.loot.map(x=>x.it?({...x,it:packTypedItem(x.it)}):x);
  if(table==='hd3d_progress'&&row.data!==undefined){row.cosmetic=Object.fromEntries(Object.entries(row.data).filter(([k])=>['hero','settings','nick'].includes(k)));row.authority=authorityOf(row.data);row.saveJson=JSON.stringify(row.data);delete row.data;}
  return row;
}
export function unpackRow(table,row) {
  row=copy(row);
  if(table==='hd3d_growth_investments'&&row?.id?.includes('~gear~')&&row.result?.opened)row.result.opened=row.result.opened.map(x=>({...x,it:unpackGearItem(x.it)}));
  if(table==='hd3d_growth_investments'&&row?.id?.includes('~gear~')){if(row.result?.it)row.result.it=unpackGearItem(row.result.it);if(row.result?.sub)row.result.sub=unpackSubs(row.result.sub);}
  if(table==='hd3d_growth_investments'&&['normal_settle','hard_settle'].includes(row?.action))row.result.loot=row.result.loot.map(x=>x.it?({...x,it:unpackGearItem(x.it)}):x);
  if(table==='hd3d_progress'&&typeof row?.saveJson==='string'){row.data=authoritativeSave(row.cosmetic||{},row.authority);delete row.saveJson;delete row.authority;delete row.cosmetic;}
  return row;
}
export const encodeFields = obj => Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,encode(v)]));
export const decodeFields = fields => Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,decode(v)]));
export function directDocument(project,uid,table,id,row) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!/^hd3d_[a-z_]+$/.test(table)||String(id).includes('/'))throw err('INVALID_DATA','Invalid scoped path');
  const doc={name:`projects/${project}/databases/(default)/documents/hd3d_live/${uid}/${table}/${id}`,fields:encodeFields({owner:uid,version:DIRECT_VERSION,row:packRow(table,row)})};
  if(['hd3d_growth_runs','hd3d_dungeon_runs','hd3d_spire_runs'].includes(table))doc.fields.issuedAt={timestampValue:row.started_at};
  if(table==='hd3d_dungeon_runs')doc.fields.closedAt=row.status==='done'&&row.finished_at?{timestampValue:row.finished_at}:{nullValue:null};
  if(table==='hd3d_spire_runs')doc.fields.pingAt=row.last_ping_at?{timestampValue:row.last_ping_at}:{nullValue:null};
  if(['hd3d_spire_best','hd3d_spire_weeks'].includes(table)&&row.best_at!=null){
   if(!Number.isFinite(Date.parse(row.best_at)))throw err('INVALID_DATA','Invalid trusted ranking timestamp');
   // Firestore timestamps truncate below microseconds. Keep a precise legacy
   // string when truncation would change its value; existing Rules preserve it
   // until a genuinely improved score writes REQUEST_TIME. Do not round ties.
   const fraction=String(row.best_at).match(/\.(\d{1,9})(?:Z|[+-]\d{2}:\d{2})$/)?.[1]||'';
   if(!/[1-9]/.test(fraction.slice(6)))doc.fields.row.mapValue.fields.best_at={timestampValue:row.best_at};
  }
  return doc;
}
export function assertDirectConfig(config) { return resolveDirectConfig(config); }
export function createDirectTransport(config,{auth,fetcher=fetch,clock=Date.now,random=Math.random,uuid=()=>crypto.randomUUID(),storage=globalThis.localStorage}={}) {
  const {endpoint,root,projectId}=assertDirectConfig(config);
  const adminRead=createAdminReadTransport(config,{auth,fetcher,clock});
  const notices=createNoticeTransport(config,{auth,fetcher,storage,uuid});
  const moderation=createModerationTransport(config,{auth,fetcher,storage,uuid});
  const adminMail=createAdminMailTransport(config,{auth,fetcher,storage,uuid});
  const adminAction=createAdminActionTransport(config,{auth,fetcher,storage,uuid,clock});
  const broadcast=createBroadcastTransport(config,{auth,fetcher,storage,uuid});
  const order=createOrderTransport(config,{auth,fetcher,storage,uuid});
  return async function transport(operation,user) {
    const current=()=>{if(auth.currentUser!==user)throw err('ACCOUNT_CHANGED','Account session changed');};
    const name=operation.name?.replace(/^hd3d_/,'');
    if(operation.kind==='query'&&operation.table==='hd3d_orders'&&operation.action==='insert')return order(operation,user);
    // Legacy programmatic callers retain one ID for this invocation and all
    // internal CAS retries. The UI supplies its durable pre-request ID.
    if(name==='spire_start'&&!operation.args?.p_id)operation={...operation,args:{...operation.args,p_id:uuid()}};
    if(isAdminReadOperation(operation))return adminRead(operation,user);
    if(isNoticeOperation(operation))return notices(operation,user);
    if(isModerationOperation(operation))return moderation(operation,user);
    if(isAdminMailOperation(operation))return adminMail(operation,user);
    if(isAdminAction(operation))return adminAction(operation,user);
    if(operation.name==='hd3d_admin_broadcast')return broadcast(operation,user);
    if(name==='spire_rank')return directRank(config,{auth,user,args:operation.args||{},fetcher,now:clock()});
    // Unimplemented privileged and economic paths fail closed.
    if(name?.startsWith('admin_')||name?.startsWith('owner_')||(name?.startsWith('spire_')&&!['spire_status','spire_start','spire_ping','spire_finish','spire_claim_week'].includes(name))||(name?.startsWith('dungeon_')&&!['dungeon_status','dungeon_start','dungeon_ping','dungeon_finish','dungeon_buy','dungeon_boss_drop'].includes(name)))throw err('DIRECT_UNSUPPORTED','Trusted administration/ranking/mail/dungeon operation is not migrated');
    current();const idToken=await user.getIdToken();current();let revision,snapshotVersion;
    const envelopes=new Map();
    const prefix=`${root}/hd3d_live/${user.uid}/`;
    const mapName=name=>name.startsWith(ROOT+'/')?prefix+name.slice(ROOT.length+1):name;
    const unmapName=name=>name.startsWith(prefix)?ROOT+'/'+name.slice(prefix.length):name;
    const request=batchSnapshotReads(async(method,path,body,{signal}={})=>{
      if(!path.endsWith(':rollback'))current();body=copy(body);
      if(body.documents)body.documents=body.documents.map(mapName);
      if(body.structuredQuery){
        const where=body.structuredQuery.where;
         // Legacy transaction helpers only expose indexed logical filters. Map
         // this direct-only pending query to its typed single-field index, so
         // reconnect does not scan every historical run.
         if(body.structuredQuery.from?.[0]?.collectionId==='hd3d_growth_runs'&&where?.fieldFilter?.field.fieldPath==='status'&&where.fieldFilter.value.stringValue==='direct-hard-pending'){where.fieldFilter.field.fieldPath='hardSaved';where.fieldFilter.value={booleanValue:false};}
        const fix=f=>{if(f.fieldFilter)f.fieldFilter.field.fieldPath='row.'+f.fieldFilter.field.fieldPath;else for(const child of f.compositeFilter?.filters||[])fix(child);};
        if(where)fix(where);
      }
      if(body.writes)body.writes=body.writes.map(w=>{
        if(w.delete)throw err('DIRECT_UNSUPPORTED','Client row deletion is prohibited');
        const suffix=w.update.name.slice(ROOT.length+1),[table,...parts]=suffix.split('/');
        const row=JSON.parse(w.update.fields.payload.stringValue);
        const previous=envelopes.get(prefix+suffix);
        if(table==='hd3d_progress'&&previous&&!name&&operation.kind==='query'&&operation.action==='update'){const old=decodeFields(previous).row;row.data=reconcileDirectSave(authoritativeSave(old.cosmetic||{},old.authority),row.data);}
        const doc=directDocument(projectId,user.uid,table,parts.join('/'),row);
        doc.fields.commitRevision=encode(revision);
        const before=envelopes.get(doc.name);
        if(table==='hd3d_progress'&&before){const next=decodeFields(doc.fields),old=decodeFields(before);next.row.authority.gear=preserveGear(next.row.authority.gear,old.row.authority.gear);
          if(name==='gear_action'&&operation.args?.p_action==='reroll_apply'){
            const it=next.row.authority.gear.inv.find(it=>it.id===operation.args.p_item);
            if(it&&!it.spec)it.rolledSub=packSubs(row.data.inv.find(it=>it.id===operation.args.p_item).sub);
          }doc.fields=encodeFields(next);}
        const newRun=['hd3d_growth_runs','hd3d_dungeon_runs','hd3d_spire_runs'].includes(table)&&!before;
        if(['hd3d_growth_runs','hd3d_dungeon_runs','hd3d_spire_runs'].includes(table)&&before)doc.fields.issuedAt=before.issuedAt;
        const score=['hd3d_spire_best','hd3d_spire_weeks'].includes(table),improved=score&&row.best_floor>(before?decodeFields(before).row.best_floor:0);
         if(score&&before&&!improved)doc.fields.row.mapValue.fields.best_at=before.row.mapValue.fields.best_at;
         const ping=table==='hd3d_spire_runs'&&before&&row.last_ping_at!==decodeFields(before).row.last_ping_at;
        if(table==='hd3d_spire_runs'&&before)doc.fields.pingAt=before.pingAt;
        const dgDone=table==='hd3d_dungeon_runs'&&before&&row.status==='done'&&decodeFields(before).row.status==='active';
        if(table==='hd3d_dungeon_runs'&&before&&!dgDone)doc.fields.closedAt=before.closedAt||{nullValue:null};
        if(dgDone){delete doc.fields.closedAt;}
        return {update:doc,...((newRun||ping||improved||dgDone)?{updateTransforms:[...(newRun?[{fieldPath:'issuedAt',setToServerValue:'REQUEST_TIME'}]:[]),...(ping?[{fieldPath:'pingAt',setToServerValue:'REQUEST_TIME'}]:[]),...(improved?[{fieldPath:'row.best_at',setToServerValue:'REQUEST_TIME'}]:[]),...(dgDone?[{fieldPath:'closedAt',setToServerValue:'REQUEST_TIME'}]:[])]}:{}),...(table==='hd3d_sequences'&&parts[0]==='_revision'?{currentDocument:{updateTime:snapshotVersion}}:{})};
      });
      if(body.writes?.some(w=>w.update?.name===prefix+'hd3d_users/'+user.uid))body.writes.push({update:{name:root+'/hd3d_live_accounts/'+user.uid,fields:encodeFields({uid:user.uid})}});
      if(body.writes&&['spire_ping','spire_finish'].includes(name))body.writes=appendRankWrites(body.writes,{root,uid:user.uid,revision,profile:envelopes.get(prefix+'hd3d_profiles/'+user.uid)});
       const target=path.endsWith(':runQuery')?`${root}/hd3d_live/${user.uid}:runQuery`:path.replace(ROOT,root);
      const res=await fetcher(`${endpoint}/v1/${target}`,{method,headers:{'content-type':'application/json',Authorization:'Bearer '+idToken},body:JSON.stringify(body),signal});
      const value=await res.json();
      if(!res.ok)throw Object.assign(err(value.error?.status||'FIRESTORE_ERROR',value.error?.message||'Firestore request failed'),{status:res.status});
      // A commit that finished after logout is still committed. Do not replay it;
      // its UI result is discarded by the outer session check, receipts reconcile.
      const convert=doc=>{
        const data=decodeFields(doc.fields),table=doc.name.slice(prefix.length).split('/')[0];
        envelopes.set(doc.name,doc.fields);
        if(doc.name===prefix+'hd3d_sequences/_revision')snapshotVersion=doc.updateTime;
        return {...doc,name:unmapName(doc.name),fields:{payload:{stringValue:JSON.stringify(unpackRow(table,data.row))}}};
      };
      if(Array.isArray(value))return value.map(x=>({...x,...(x.found?{found:convert(x.found)}:{}),...(x.document?{document:convert(x.document)}:{}),...(x.missing?{missing:unmapName(x.missing)}:{})}));
      return value;
    });
    // Every transaction shares an own-account revision fence, including reads.
    // Changes to bans/entitlements are read freshly by execute in this snapshot.
    const store={transaction:async fn=>{
      for(let attempt=0;attempt<5;attempt++){
        current();let token,tx;
        try{
          // Optimistic account CAS: a consistent read-only snapshot holds no
          // write locks while a browser waits. The revision precondition is
          // checked atomically with ALL document writes by Firestore itself.
          token=(await request('POST',ROOT+':beginTransaction',{options:{readOnly:{}}})).transaction;
          if(!token)throw err('SNAPSHOT_MISSING','Read snapshot token missing');
          tx=new FirestoreTransaction(request,token,false);
          const [control,meta]=await Promise.all([tx.get('hd3d_sequences','_activation'),tx.get('hd3d_sequences','_revision')]);
          if(!control?.enabled||control.schema!==1)throw err('MIGRATION_REQUIRED','A verified typed account snapshot is required');
          if(name==='spire_start'&&control.spireVersion!==1)throw err('MIGRATION_REQUIRED','Trusted tower day-counter migration required');
          if(!meta||!snapshotVersion)throw err('MIGRATION_REQUIRED','Account revision missing');
          revision=meta.value+1;
          const result=await fn(tx);
          if(tx.writes.size){
            const args=operation.args||{},proof={op:name||'save',request:args.p_id||(name==='claim_mail'?String(args.p_mail_id):''),token:args.p_token||'',hero:args.p_hero||'',level:args.p_level||args.p_floors||0,stat:''};
            if(name==='gear_action'){proof.op='gear_'+args.p_action;proof.token=args.p_item||'';proof.slot=args.p_slot||'';proof.pay=args.p_pay||'';
              const before=decodeFields(envelopes.get(prefix+'hd3d_progress/'+user.uid)).row.authority.gear;
              const list=args.p_action==='open'?before.chests:args.p_action==='take'?before.stor:before.inv;
              proof.pos=Math.max(0,list.findIndex(x=>x.id===proof.token));
              if(args.p_action==='codex'){const [ch,row]=proof.token.split(':');proof.level=Number(ch);proof.choice=row;}
               if(args.p_action==='run_return'){proof.level=args.p_wave;proof.kills=args.p_kills;}
              if(args.p_action==='craft'){proof.level=args.p_ch||0;proof.choice=args.p_recipe;}
              if(args.p_action==='reroll_apply')proof.source=args.p_source;
               if(args.p_action==='research'){proof.branch=args.p_type;proof.choice=args.p_stat;}
               if(args.p_action==='exchange')proof.level=args.p_count;
               if(args.p_action==='advance')proof.branch=args.p_branch;
            }
            if(name==='normal_settle'){proof.level=args.p_wave;proof.kills=args.p_kills;proof.choice=String(args.p_stars||0);}
            if(name==='normal_settle'){
              const preflight=[...tx.writes.values()].find(w=>w.update?.name.includes('/hd3d_growth_investments/')&&['normal_drop','normal_manifest'].includes(JSON.parse(w.update.fields.payload.stringValue).result?.action));
              if(preflight){const r=JSON.parse(preflight.update.fields.payload.stringValue);proof.op=r.result.action;proof.source=r.result.ref;if(r.result.action==='normal_drop')proof.pos=r.result.index;}
            }
            if(name==='normal_loot'||name==='challenge_loot'||name==='hard_loot')proof.pos=args.p_index;
             if(name==='challenge_settle'){proof.level=args.p_wave;proof.kills=args.p_kills;const preflight=[...tx.writes.values()].find(w=>w.update?.name.includes('/hd3d_growth_investments/')&&JSON.parse(w.update.fields.payload.stringValue).result?.action==='challenge_drop');if(preflight){const v=JSON.parse(preflight.update.fields.payload.stringValue);proof.op='challenge_drop';proof.pos=v.result.index;proof.choice=v.result.drop.id;proof.source=v.body;}}
            if(name==='claim_mail'){const item=[...tx.writes.values()].find(w=>w.update?.name.includes('/hd3d_growth_investments/')&&JSON.parse(w.update.fields.payload.stringValue).result?.action==='mail_item');if(item){proof.op='mail_item';proof.pos=JSON.parse(item.update.fields.payload.stringValue).result.index;}}
            if(name==='growth_progress'){proof.choice=String(operation.args?.p_stars||0);proof.source=operation.args?.p_finish?'finish':'';}
            if(name==='growth_build')Object.assign(proof,{branch:args.p_branch,preset:args.p_preset,tier:args.p_tier,choice:args.p_choice||''});
            if(name==='dungeon_buy')proof.token=args.p_item;
            if(name?.startsWith('dungeon_')){
              const runs=[...tx.writes.values()].filter(w=>w.update?.name.startsWith(ROOT+'/hd3d_dungeon_runs/'));
              const rw=name==='dungeon_start'?runs.find(w=>JSON.parse(w.update.fields.payload.stringValue).status==='active'):runs[0];
              if(rw){const run=JSON.parse(rw.update.fields.payload.stringValue);proof.request=String(run.id);proof.token=run.token;
                if(name==='dungeon_start')await tx.put('hd3d_sequences',{id:'dungeon-'+Math.floor(clock()/86400000+9/24),value:run.id});
              }
            }
            if(name?.startsWith('spire_')){
              if(name==='spire_start')proof.source=args.p_id;
               if(name==='spire_claim_week'){const claim=[...tx.writes.values()].find(w=>w.update?.name.includes('/hd3d_growth_investments/')&&JSON.parse(w.update.fields.payload.stringValue).result?.action==='spire_claim_week');if(claim)proof.source=JSON.parse(claim.update.fields.payload.stringValue).result.week;}
              const runs=[...tx.writes.values()].filter(w=>w.update?.name.startsWith(ROOT+'/hd3d_spire_runs/'));
              const rw=name==='spire_start'?runs.find(w=>JSON.parse(w.update.fields.payload.stringValue).status==='active'):runs[0];
              if(rw){const run=JSON.parse(rw.update.fields.payload.stringValue);proof.request=String(run.id);proof.token=run.token;proof.level=args.p_floor??args.p_top??args.p_from??0;
                if(name==='spire_start'){const id='spire-'+Math.floor(clock()/86400000+9/24),old=await tx.get('hd3d_sequences',id);await tx.put('hd3d_sequences',{id,value:(old?.value||0)+1});}
              }
            }
            const write=tx.writes.get(ROOT+'/hd3d_progress/'+user.uid);
            if(proof.op==='save'&&write?.update){
              const old=envelopes.get(prefix+'hd3d_progress/'+user.uid);
              const next=JSON.parse(write.update.fields.payload.stringValue);
              if(old){const row=decodeFields(old).row,raw=authoritativeSave(row.cosmetic||{},row.authority);const reconciled=reconcileDirectSave(raw,next.data);
                // Typed grants can have a richer wire representation than their
                // decoded legacy item. Compare both sides in that same view;
                // preserveGear and Rules still retain the original stored item.
                Object.assign(proof,trainingIntent(authorityOf(raw),authorityOf(reconciled))||{});}
            }
            if(['spire_ping','spire_finish'].includes(name))await tx.get('hd3d_profiles',user.uid);
             await tx.put('hd3d_sequences',{id:'_revision',value:revision,proof});
            await tx.close();current();
            await request('POST',ROOT+':commit',{writes:[...tx.writes.values()]});
          }
          return result;
        }catch(e){
          // Only an explicit atomic precondition/ABORTED rejection proves no
          // commit. Lost responses/503/timeout are returned for journal recovery.
          if(attempt<4&&['ABORTED','FAILED_PRECONDITION'].includes(e.code))continue;
          if(attempt<4&&e.code==='PERMISSION_DENIED'){
            // Rules may reject the stale revision fence before Firestore reports
            // updateTime failure. A 403 proves this atomic write did NOT commit;
            // retry only after an own fresh revision proves actual contention.
            const before=snapshotVersion;
            await request('POST',ROOT+':batchGet',{documents:[ROOT+'/hd3d_sequences/_revision']});
            if(snapshotVersion!==before)continue;
          }
          throw e;
        }finally{
          await tx?.close();
          if(token)await request('POST',ROOT+':rollback',{transaction:token}).catch(()=>{});
        }
      }
    }};
    const result=['growth_progress','hard_finalize','hard_mail','hard_settle','hard_loot'].includes(name)
       ? await directHard(store,{id:user.uid,email:user.email||''},name,operation.args||{},{now:clock(),random,uuid})
       : name==='spire_claim_week'
       ? await directSpireWeek(store,{id:user.uid,email:user.email||''},operation.args||{},{now:clock(),random,uuid})
       : name==='spire_start'
      ? await directSpireStart(store,{id:user.uid,email:user.email||''},operation.args||{},{now:clock(),random,uuid})
      : name==='spire_status'
      ? await directSpireStatus(store,{id:user.uid,email:user.email||''},{now:clock()},a=>directRank(config,{auth,user,args:a,fetcher,now:clock()}))
      : name?.startsWith('challenge_')
      ? await directChallenge(store,{id:user.uid,email:user.email||''},name,operation.args||{},{now:clock(),random,uuid})
      : name?.startsWith('normal_')
      ? await directNormal(store,{id:user.uid,email:user.email||''},name,operation.args||{},{now:clock(),random,uuid})
      : name==='gear_action'
      ? await directGear(store,{id:user.uid,email:user.email||''},operation.args||{},{now:clock(),random,uuid})
      : name==='dungeon_buy'
      ? await directDungeonBuy(store,{id:user.uid,email:user.email||''},operation.args||{},{now:clock(),random,uuid})
      : name==='claim_mail'
      ? await directClaimMail(store,{id:user.uid,email:user.email||''},operation.args||{},{now:clock(),random,uuid})
      : await runOperation(store,{id:user.uid,email:user.email||''},operation,{now:clock(),random,uuid});
    current();
    if(name==='growth_progress'&&result.data?.directLoot){
      const args={p_token:operation.args.p_token};
      let paid=await transport({kind:'rpc',name:'hd3d_hard_settle',args},user);
      const deferred=()=>({...result,data:{...result.data,ok:false,reason:'capacity',deferred:true},status:200});
      if(paid.data?.deferred)return deferred();
      while(paid.data.next<paid.data.total){
        const before=paid.data.next;
        paid=await transport({kind:'rpc',name:'hd3d_hard_loot',args:{...args,p_index:before}},user);
        if(paid.data?.deferred)return deferred();
        if(paid.data.next<=before)throw err('DIRECT_REWARD_PENDING','Hard reward cursor did not advance');
      }
      return transport({kind:'rpc',name:'hd3d_hard_finalize',args},user);
    }
    if(name==='growth_progress'&&result.data?.directPending){
      await transport({kind:'rpc',name:'hd3d_hard_mail',args:{p_token:operation.args.p_token}},user);
      const paid=await transport({kind:'rpc',name:'hd3d_claim_mail',args:{p_mail_id:result.data.directPending}},user);
      if(!paid.data?.ok)throw err('DIRECT_MAIL_PENDING','Hard reward entitlement is pending');
      return transport({kind:'rpc',name:'hd3d_hard_finalize',args:{p_token:operation.args.p_token}},user);
    }
    return {...result,status:200};
  };
}
