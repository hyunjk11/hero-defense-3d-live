// Transient dungeon-only actions. No damage callbacks or saved/account state.
const living=h=>h&&h.dead<=0&&h.hp>0&&Number.isFinite(h.max)&&h.max>0;
export function jointBlessing(bless,heroes,now,state){
 if(!bless?.rally||!Number.isFinite(now)||now<(state.rallyReady||0))return false;
 state.rallyReady=now+12;
 for(const h of heroes.filter(living).slice(0,4))h.blessHasteUntil=now+6;
 return true;
}
export function rescueBlessing(bless,heroes,now,state,healScale=1){
 if(!bless?.rescue||!Number.isFinite(now)||now<(state.rescueReady||0))return [];
 const party=heroes.filter(living).slice(0,4), low=party.find(h=>h.hp<=h.max*.3);
 if(!low)return [];
 state.rescueReady=now+12;
 const healed=[];
 for(const h of party){
  const dx=h.g.position.x-low.g.position.x,dz=h.g.position.z-low.g.position.z;
  if(dx*dx+dz*dz>16||h.hp>=h.max)continue;
  h.hp=Math.min(h.max,h.hp+h.max*.08*Math.max(0,Math.min(1,healScale)));
  healed.push(h);
 }
 return healed;
}
