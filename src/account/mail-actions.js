// Serial actions deliberately reuse the existing atomic single-mail receipt path.
export const claimableMail = (mail,pending=[]) => {
 const eligible=mail.filter(m=>!m.archived_at&&!m.revoked&&m.reward&&(!m.claimed||pending.includes(m.id)));
 const order=new Map(pending.map((id,i)=>[id,i]));
 return eligible.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));
};
export function createMailBatch(){
 let active=null;
 return function run(mails,{claim,isCurrent=()=>true,onProgress=()=>{},pending=[]}={}){
  if(active)return active;
  const ids=[...new Set(claimableMail(mails,pending).map(m=>m.id))];
  active=(async()=>{const out={ok:true,total:ids.length,received:0,already:0,failed:[],remaining:0,stopped:false};
   for(let i=0;i<ids.length;i++){
    if(!isCurrent()){out.ok=false;out.stopped=true;out.remaining=ids.length-i;break;}
    let r;try{r=await claim(ids[i],{quiet:true});}catch(e){r={ok:false,pending:true,msg:e?.message||'Claim failed'};}
    if(r?.ok){if(r.already)out.already++;else out.received++;}else{out.ok=false;out.failed.push({id:ids[i],pending:!!r?.pending,deferred:!!r?.deferred,msg:r?.msg||''});}
    onProgress({...out});
    // Stop on every failure; leave later rewards untouched until the user retries.
    if(!r?.ok||!isCurrent()){out.ok=false;out.stopped=true;out.remaining=ids.length-i-1;break;}
   }return out;
  })().finally(()=>{active=null;});return active;
 };
}
