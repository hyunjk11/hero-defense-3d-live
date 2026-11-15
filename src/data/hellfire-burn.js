// Per-cast transient damage only; no save fields, proc recursion or wall-clock timers.
// One active brand per enemy across casters. Stronger brands replace weaker ones;
// same-cast hits refresh duration without resetting the half-second tick clock.
export function createHellfireBurn(owner) {
  const entries=new Map(), token={}, interval=.5, live=e=>!e.dead&&e.dying===undefined;
  const remove=(e,b)=>{if(e.hellfireBurn===b)delete e.hellfireBurn;entries.delete(e);};
  return {
    get size(){return entries.size;},
    add(e,now,dps,duration){
      if(!live(e)||!(dps>0)||!(duration>0))return;
      const old=e.hellfireBurn;
      if(old&&old.until>now&&old.token!==token&&old.dps>dps)return;
      if(old?.token===token){old.until=now+duration;return;}
      const b={token,owner,dps,until:now+duration,next:old&&old.until>now?old.next:now+interval};
      entries.set(e,b);e.hellfireBurn=b;
    },
    step(now,hit,active=null){
      for(const [e,b] of entries){
        if(!live(e)||e.hellfireBurn!==b||(active&&!active.has(e))){remove(e,b);continue;}
        while(b.next<=Math.min(now,b.until)+1e-8){b.next+=interval;hit(e,b.dps*interval);if(!live(e))break;}
        if(!live(e)||now>=b.until-1e-8)remove(e,b);
      }
    },
    visit(fn){for(const [e,b] of entries)if(e.hellfireBurn===b&&live(e))fn(e,b);},
    clear(){for(const [e,b]of entries)remove(e,b);},
  };
}
