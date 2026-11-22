import { toTile } from '../core/grid-metrics.js';

export function castleRank(G) {
  return G.stage?.hard === true && !G.practice && !G.practiceSandbox && !G.dungeon && Number.isInteger(G.castleResearch)
    ? Math.max(0, Math.min(10, G.castleResearch)) : 0;
}
export function inCastleRing(c, r, core) {
  if (!core) return false;
  const distance = Math.max(Math.abs(c - core[0]), Math.abs(r - core[1]));
  return distance >= 2 && distance <= 4;
}
export function castleHeroRank(G, hero) {
  const rank = castleRank(G), p = hero?.g?.position;
  if (!rank || !p || hero.dead > 0) return 0;
  const [c, r] = toTile(p.x, p.z);
  return inCastleRing(c, r, G.stage.core) ? rank : 0;
}
export function castleTowerRank(G, tower) {
  const rank = castleRank(G);
  return rank && tower && !tower.dead && inCastleRing(tower.c, tower.r, G.stage.core) ? rank : 0;
}
export function castleRepairCost(G, tower, baseCost) {
  return castleTowerRank(G, tower) >= 5 ? Math.ceil(baseCost * 9 / 10) : baseCost;
}
export function castleWaveRepair(G) {
  if (castleRank(G) < 10) return null;
  let target = null;
  for (const tw of G.towers) {
    if (tw.dead || !(tw.hp > 0 && tw.hp < tw.max) || !inCastleRing(tw.c, tw.r, G.stage.core)) continue;
    if (!target || tw.hp / tw.max < target.hp / target.max) target = tw;
  }
  if (target) {
    target.hp = Math.min(target.max, target.hp + target.max * .15);
    target.hb.set(target.hp / target.max);
  }
  return target;
}
