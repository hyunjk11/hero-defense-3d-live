import {denied} from './common.mjs';
import {directGear,gearArgs} from '../src/account/direct-economy.js';
// Only deterministic inventory/town transitions. Draws and battle settlement keep
// their existing dedicated paths. The same per-action receipt IDs work with old
// journals, old clients, retries and a lost batch response.
export const BATCH_ACTIONS=new Set(['open','dismantle','store','take','equip','unequip','research','bar','expand','exchange']);
export async function gearBatch(rawStore,adapt,user,args,options={}) {
 if(!user?.id)denied('not authenticated');
 if(!args||Object.keys(args).some(k=>k!=='commands')||!Array.isArray(args.commands)||!args.commands.length||args.commands.length>200)denied('invalid gear batch','INVALID_ARGUMENT');
 const commands=args.commands,seen=new Set();
 for(const a of commands){gearArgs(a);if(!BATCH_ACTIONS.has(a.p_action)||seen.has(a.p_id))denied('invalid gear batch','INVALID_ARGUMENT');seen.add(a.p_id);}
 const documents=['admins','bans','progress','profiles'].map(t=>['hd3d_'+t,user.id]);
 for(const a of commands)documents.push(['hd3d_growth_investments',user.id+'~gear~'+a.p_id]);
 for(const hero of new Set(commands.filter(a=>['equip','unequip'].includes(a.p_action)).map(a=>a.p_hero)))if(['gunner','fighter'].includes(hero))documents.push(['hd3d_owned',user.id+'~hero_'+hero]);
 try{return await rawStore.transaction(async tx=>{
   const nested=adapt({transaction:fn=>fn(tx)},{rejectBalanceTruncation:true}),results=[];
   for(const command of commands)results.push((await directGear(nested,user,command,options)).data);
   // These rows belong to this committed transaction, including replay of an
// older receipt after another tab changed the save. Never embed stale receipts'
// snapshots or expose another user's profile.
   const progress=await tx.get('hd3d_progress',user.id),profile=await tx.get('hd3d_profiles',user.id);
   return {data:{ok:true,results,snapshot:{progress,profile}},error:null};
  },{documents});
 }catch(e){
  if(e.code==='BALANCE_LIMIT')return {data:{ok:true,results:commands.map(()=>({ok:false,reason:'balance_limit',limits:e.limits,serverSaved:true}))},error:null};
  throw e;
 }
}
