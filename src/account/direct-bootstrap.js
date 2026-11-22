import {assertDirectConfig,DEMO_PROJECT,directDocument,encodeFields,decodeFields} from './direct-store.js';
import {empty} from './progress.js';
import {initialGrowth} from '../data/hero-growth.js';
export function bootstrapDocuments(uid,email,now=Date.now(),project=DEMO_PROJECT) {
  const iso=new Date(now).toISOString(),save=empty();
  const rows=[['hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:iso,updated_at:iso}],
    ['hd3d_growth_wallet',uid,{user_id:uid,...initialGrowth(save)}],
    ['hd3d_sequences','_revision',{id:'_revision',value:0}],
    ['hd3d_sequences','_activation',{id:'_activation',schema:1,enabled:true,spireVersion:1}]];
  for(const item of ['hero_gunner','hero_fighter'])rows.push(['hd3d_sequences','order-pending-'+item,{id:'order-pending-'+item,value:0}]);
  return rows.map(([table,id,row])=>{const d=directDocument(project,uid,table,id,row);d.fields.commitRevision=encodeFields({x:0}).x;return d;});
}
// Fresh live signup: never import local/legacy money or replace an existing live account.
// Every create has an exists:false precondition and Rules require zero templates.
export async function bootstrapDirect(config,{auth,user,fetcher=fetch,now=Date.now()}={}) {
  const {endpoint,root,projectId}=assertDirectConfig(config);
  const current=()=>{if(auth.currentUser!==user)throw Object.assign(new Error('Account session changed'),{code:'ACCOUNT_CHANGED'});};
  current();const token=await user.getIdToken();current();
  const response=await fetcher(`${endpoint}/v1/${root}:commit`,{
    method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({writes:bootstrapDocuments(user.uid,user.email,now,projectId).map(update=>({update,currentDocument:{exists:false}}))})});
  const body=await response.json();
  if(!response.ok)throw Object.assign(new Error(body.error?.message||'Account initialization failed'),{code:body.error?.status,status:response.status});
  current();return {ok:true};
}

// Auth can succeed before an interrupted zero-save initialization. A later
// sign-in first reads the live activation marker; legacy saves are never consulted.
// Unknown commits are not repeated inside this call.
export async function ensureDirectAccount(config,options) {
  const {auth,user,fetcher=fetch}=options;const {endpoint,root,projectId}=assertDirectConfig(config);
  const current=()=>{if(auth.currentUser!==user)throw Object.assign(new Error('Account session changed'),{code:'ACCOUNT_CHANGED'});};
  current();const token=await user.getIdToken();current();
  const r=await fetcher(`${endpoint}/v1/${root}/hd3d_live/${user.uid}/hd3d_sequences/_activation`,{headers:{Authorization:'Bearer '+token}});
  const body=await r.json();current();
  if(r.ok){const row=decodeFields(body.fields).row;if(row?.schema===1&&row.enabled===true)return {ok:true,existing:true};throw Object.assign(new Error('Account migration is unavailable'),{code:'DIRECT_MIGRATION_REQUIRED'});}
  if(r.status!==404)throw Object.assign(new Error(body.error?.message||'Account verification failed'),{code:body.error?.status,status:r.status});
  return bootstrapDirect(config,options);
}
