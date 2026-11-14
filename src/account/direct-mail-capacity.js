const CAP=1000000000;
const steel=[2,4,8,12,20],crystal=[0,0,1,3,8];
// No reward is truncated. Check the still-unpaid suffix, including automatic
// dismantling at the existing 200-chest limit. Repeat inside every transaction:
// another device may change capacity between the bounded item transactions.
export function mailCapacity(save,reward,position=0,earned=0){
 const rw=reward||{},items=rw.items||[],remaining=items.slice(position),room=Math.max(0,200-(save.chests?.length||0));
 const auto=remaining.slice(room),extra={souls:rw.souls||0,steel:rw.steel||0,crystal:rw.crystal||0,essence:rw.essence||0};
 for(const x of auto){extra.steel+=steel[x.g];extra.crystal+=crystal[x.g];}
 const limits=[];
 for(const k of Object.keys(extra)){const n=k==='souls'?save.souls||0:save.mat?.[k]||0;if(!Number.isSafeInteger(n+extra[k])||n+extra[k]>CAP)limits.push(k);}
 if(earned+(rw.medals||0)>CAP)limits.push('medals');
 return {ok:limits.length===0,limits};
}
export function mailDeferred(limits,got=[]){return {data:{ok:false,reason:'balance_limit',deferred:true,serverSaved:true,limits,got},error:null};}
