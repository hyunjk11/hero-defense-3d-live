import {assertDirectConfig,decodeFields} from './direct-store.js';
import {week} from '../../server/common.mjs';
export function rankTimeKey(value){const m=String(value).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/);if(!m||!Number.isFinite(Date.parse(value))||new Date(Date.parse(value)).toISOString().slice(0,19)!==m[1])throw Error('Invalid ranking timestamp');return m[1]+'.'+(m[2]||'').padEnd(9,'0')+'Z';}
// Only a non-PII projection is readable across accounts. Private saves, email,
// ban reasons and administration rows never enter this collection.
export async function directRank(config,{auth,user,args,fetcher=fetch,now=Date.now()}={}) {
  const {root,endpoint}=assertDirectConfig(config);
  const current=()=>{if(auth.currentUser!==user)throw Object.assign(new Error('Account session changed'),{code:'ACCOUNT_CHANGED'});};
  const kind=args.p_kind??'week',wk=args.p_week??week(now);
  if(!['week','all'].includes(kind)||typeof wk!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(wk))return {data:{ok:false,reason:'bad_kind'},error:null};
  const filters=[{fieldFilter:{field:{fieldPath:'kind'},op:'EQUAL',value:{stringValue:kind}}}];
  if(kind==='week')filters.push({fieldFilter:{field:{fieldPath:'week'},op:'EQUAL',value:{stringValue:wk}}});
  current();const token=await user.getIdToken();current();
  const r=await fetcher(`${endpoint}/v1/${root}:runQuery`,{
    method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({structuredQuery:{from:[{collectionId:'hd3d_live_ranks'}],where:{compositeFilter:{op:'AND',filters}}}})});
  const body=await r.json();if(!r.ok)throw Object.assign(new Error(body.error?.message||'Ranking read failed'),{status:r.status,code:body.error?.status});current();
  const br=await fetcher(`${endpoint}/v1/${root}:runQuery`,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({structuredQuery:{from:[{collectionId:'hd3d_live_rank_blocks'}]}})});
  const blocked=await br.json();current();if(!br.ok)throw Object.assign(Error(blocked.error?.message||'Rank exclusions unavailable'),{status:br.status});
  const decisions=new Map(blocked.filter(x=>x.document).map(x=>{const d=decodeFields(x.document.fields);return [d.uid,d.banned];}));
  const rows=body.filter(x=>x.document).map(x=>decodeFields(x.document.fields)).filter(x=>!(decisions.has(x.uid)?decisions.get(x.uid):x.excluded)&&x.floor>0);
  rows.sort((a,b)=>b.floor-a.floor||rankTimeKey(a.at).localeCompare(rankTimeKey(b.at))||a.uid.localeCompare(b.uid));
  const i=rows.findIndex(x=>x.uid===user.uid);
  return {data:{ok:true,kind,week:kind==='week'?wk:null,top:rows.slice(0,50).map((x,i)=>({rank:i+1,nick:x.nick,floor:x.floor,at:x.at,me:x.uid===user.uid})),me:i<0?null:{rank:i+1,floor:rows[i].floor}},error:null,status:200};
}
