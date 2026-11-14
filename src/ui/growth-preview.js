import * as H from '../data/hero-growth.js';
import * as E from '../account/equip.js';
import * as AD from '../data/advance.js';
import { sortieC, finalStats } from '../data/herostats.js';
export function affordableLevel(g, hero) {
  if (!g) return 1; let level=H.levelOf(g.xp[hero]);
  while(level<H.MAX_LEVEL && H.quote(g,hero,level+1).ok)level++;
  return level;
}
export function growthPreview(save,g,hero,target) {
  const quote=H.quote(g,hero,target),current=H.levelOf(g.xp[hero]);
  const L={perm:save.heroLv[hero],adv:AD.advOf(hero,save.adv[hero]),eq:E.bonus(save,hero)};
  const stats=level=>finalStats(sortieC(hero,{...L,level}),L.eq);
  return {quote,before:stats(current),after:stats(quote.cost?target:current)};
}
