// Entry IDs, unlike run tokens, exist before the first network request. Reusing
// one reconciles an uncertain commit without consuming another daily entry.
import {context,denied} from '../../server/common.mjs';
import {spire} from '../../server/spire.mjs';
export async function directSpireStart(store,user,args,options){
 if(!args||Object.keys(args).some(k=>!['p_id','p_from','p_growth'].includes(k))||!/^[-A-Za-z0-9_]{8,64}$/.test(args.p_id||'')||!Number.isInteger(args.p_from)||![0,1].includes(args.p_growth??0))throw Object.assign(Error('Invalid tower entry'),{code:'INVALID_ARGUMENT'});
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  const id=c.uid+'~spstart~'+args.p_id,old=await c.get('growth_investments',id);
  if(old){
   const z=old.result;if(z.from!==args.p_from||z.growth!==(args.p_growth===1))denied('Tower entry ID reused with different options');
   const runs=await c.list('spire_runs',{user_id:c.uid}),run=runs.find(r=>r.token===z.token),used=runs.filter(r=>r.day===c.day).length;
   if(!run)denied('Tower entry receipt has no run');
   if(run.status!=='active')return {data:{ok:false,reason:'used',already:true},error:null};
   if(c.now-Date.parse(run.started_at)>10800000)return {data:{ok:false,reason:'expired',already:true},error:null};
   return {data:{...z,used,left:Math.max(0,30-used),already:true},error:null};
  }
  const result=await spire(c,'start',args);
  if(!result.ok)return {data:result,error:null};
  const r={...result,action:'spire_start',request:args.p_id,growth:args.p_growth===1};
  await c.put('growth_investments',{id,user_id:c.uid,body:JSON.stringify({from:args.p_from,growth:r.growth}),at:c.iso,result:r});
  return {data:r,error:null};
 });
}
