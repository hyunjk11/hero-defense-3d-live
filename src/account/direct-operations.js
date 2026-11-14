import {context,denied} from '../../server/common.mjs';
import {grantMailItems,checkMailReward,mailItemsResult} from './direct-mail-items.js';
import {mailCapacity,mailDeferred} from './direct-mail-capacity.js';
// Direct-only transactions, with independent Security Rules validation. These do
// not replace the production Worker or alter its API implementation.
export async function directClaimMail(store,user,args,options) {
  if(!Number.isSafeInteger(args.p_mail_id)||args.p_mail_id<=0||Object.keys(args).some(k=>k!=='p_mail_id'))throw Object.assign(Error('Invalid mail ID'),{code:'INVALID_ARGUMENT'});
  try{
  const deferred=await grantMailItems(store,user,args,options);
  if(deferred)return await store.transaction(async tx=>{
   const c=await context(tx,user,options);c.requirePlayer();const m=await c.get('mail',args.p_mail_id);
   if(!m||m.user_id!==c.uid||m.revoked&&!m.claimed)denied('mail unavailable');
   if(m.claimed)return {data:{ok:true,already:true,id:m.id,reward:null,serverSaved:true,got:await mailItemsResult(c,m)},error:null};
   // This is a confirmed deferred entitlement, not an unknown commit. Existing
   // item receipts stay immutable; a later retry starts at the unpaid suffix.
   return mailDeferred(deferred.limits,await mailItemsResult(c,m));
  });
  return await store.transaction(async tx=>{
    const c=await context(tx,user,options);c.requirePlayer();
    const m=await c.get('mail',args.p_mail_id);
    if(!m||m.user_id!==c.uid||m.revoked&&!m.claimed)denied('mail unavailable');
    if(m.claimed&&!m.server_applied&&m.reward){
      const snapshot=await c.get('progress',c.uid);
      if(!snapshot?.data?.mailLog?.includes(m.id))throw Object.assign(new Error('Legacy claimed mail needs reconciliation before direct migration'),{code:'DIRECT_LEGACY_CLAIM_UNRESOLVED'});
    }
    if(m.claimed)return {data:{ok:true,already:true,id:m.id,reward:null,serverSaved:true,got:await mailItemsResult(c,m)},error:null};
    const rw=m.reward||{};
    checkMailReward(rw);
    const p=await c.get('progress',c.uid);if(!p)denied('missing save');
    const wallet=await c.get('dungeon_wallet',c.uid),capacity=mailCapacity(p.data,rw,(rw.items||[]).length,wallet?.earned||0);
    if(!capacity.ok)return mailDeferred(capacity.limits,await mailItemsResult(c,m));
    p.data.souls+=rw.souls||0;
    for(const k of ['steel','crystal','essence'])if(rw[k])p.data.mat[k]=(p.data.mat[k]||0)+rw[k];
    p.updated_at=new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString();
    await c.put('progress',p);
    if(rw.hero){const item='hero_'+rw.hero;if(!await c.get('owned',c.uid+'~'+item))await c.insert('owned',{user_id:c.uid,item,source_mail:m.id});}
    if(rw.medals>0){const w=await c.wallet();w.medals=Math.min(1000000,w.medals+rw.medals);w.earned+=rw.medals;w.updated_at=c.iso;await c.put('dungeon_wallet',w);}
    await c.put('mail',{...m,claimed:true,claimed_at:c.iso,server_applied:true});
    return {data:{ok:true,already:false,id:m.id,reward:null,serverSaved:true,got:await mailItemsResult(c,m)},error:null};
  });
  }catch(e){if(e.code!=='DIRECT_INVALID_MAIL'&&e.code!=='DIRECT_LEGACY_CLAIM_UNRESOLVED')e.code='DIRECT_MAIL_PENDING';throw e;}
}
