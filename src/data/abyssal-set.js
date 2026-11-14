import { ABYSSAL_PROC } from './boss-sets.js';
import { procTargets } from './legend-procs.js';
// Per-hero state, bounded targets and no RNG; never called recursively from the follow-up hit.
export function abyssalStrike(hero,target,enemies,now,attack) {
  const active=hero?.equippedSets?.some(s=>s.key==='abyssal'&&s.tiers?.some(t=>t.pieces===3&&t.active));
  if(!active||hero.dead>0){if(hero)hero.abyssalState=null;return [];}
  const targets=procTargets(ABYSSAL_PROC,target,enemies,now,attack);
  if(!Number.isFinite(now)||!targets.length)return [];
  const state=hero.abyssalState||(hero.abyssalState={hits:0,ready:0});
  state.hits=Math.min(ABYSSAL_PROC.hits,state.hits+1);
  if(state.hits<ABYSSAL_PROC.hits||now<state.ready)return [];
  state.hits=0;state.ready=now+ABYSSAL_PROC.icd;return targets;
}
