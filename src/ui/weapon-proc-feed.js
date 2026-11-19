// A single title in the same slot as the normal skill banner. A real skill / wave
// announcement takes priority; keep only recent procs and never stack titles.
export function createWeaponFeed() {
  let current=null;
  const waiting=new Map(), visibleMs=900, freshMs=2400;
  const valid=(e,state,now)=>e.until>now && e.map===state.tiles &&
    state.screen!=='town' && state.screen!=='menu' && (state.phase==='wave'||state.phase==='build') &&
    (e.hero===state.hero||state.heroes?.includes(e.hero));
  function remove(){current?.el.remove();current=null;}
  function enqueue(e){
    const previous=waiting.get(e.hero);
    if(!previous || previous.at<=e.at)waiting.set(e.hero,e);
    if(waiting.size>2)waiting.delete(waiting.keys().next().value);
  }
  function refresh(state,now){
    for(const [hero,e] of waiting)if(!valid(e,state,now))waiting.delete(hero);
    if(current && (!valid(current,state,now)||now>=current.end))remove();
    const root=current?.root||waiting.values().next().value?.root;
    if(!root)return;
    if(root.ownerDocument.getElementById?.('banner')?.classList.contains('show')){
      if(current){
        if(now-current.start<350)enqueue(current);
        remove();
      }
      return;
    }
    if(current)return;
    const e=waiting.values().next().value;if(!e)return;
    waiting.delete(e.hero);
    const el=root.ownerDocument.createElement('div');el.textContent=e.name+'!';root.appendChild(el);
    current={...e,el,start:now,end:now+visibleMs};
  }
  function record(root,state,hero,skill,now){
    if(!root||skill?.type!=='proc')return;
    const entry={root,map:state.tiles,hero,name:skill.n,at:now,until:now+freshMs};
    if(!valid(entry,state,now))return;
    if(current?.hero!==hero||current.name!==skill.n||now>=current.end)enqueue(entry);
    refresh(state,now);
  }
  return {record,refresh};
}
export const weaponProcFeed=createWeaponFeed();
