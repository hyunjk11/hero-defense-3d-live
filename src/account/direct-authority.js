import {GEAR_KEYS,gearOf,gearSave} from './direct-gear.js';
// Typed balances and progression are authoritative. The legacy blob remains a
// compatibility copy, never a second route for changing protected game state.
const cosmetic = new Set(['hero', 'settings', 'nick', 'growth']);
const typed = new Set(['souls', 'mat', 'heroLv', 'st', 'adv', 'hq', 'starRw', 'research', 'barLv', 'xch', 'hardRewardSeq', 'bestWave']);
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
export const stable = v => JSON.stringify(canonical(v));
export function authorityOf(save) {
  const sealed = Object.fromEntries(Object.entries(save).filter(([k]) => !cosmetic.has(k) && !typed.has(k) && !GEAR_KEYS.includes(k)));
  return { present:[...typed].filter(k=>Object.hasOwn(save,k)), souls: save.souls || 0, mat: save.mat || {steel:0,crystal:0},
    heroLv: save.heroLv || {}, st: save.st || {}, adv: save.adv || {}, hq:save.hq || {}, starRw:save.starRw || 0,
    bestWave:save.bestWave || 0, hardRewardSeq:save.hardRewardSeq || 0, research:save.research || {},barLv:save.barLv || 0,xch:save.xch || {},
    starsTotal:Object.values(save.st || {}).reduce((n,v)=>n+v,0), gear:gearOf(save), sealed: stable(sealed) };
}
export function authoritativeSave(blob, authority) {
  if (!authority) throw new Error('Typed authority migration required');
  return { ...Object.fromEntries(Object.entries(blob).filter(([k]) => cosmetic.has(k) && k !== 'growth')),
    ...JSON.parse(authority.sealed), ...gearSave(authority.gear), ...Object.fromEntries(authority.present.map(k=>[k,authority[k]])) };
}
// Infer only the existing one-step town training action. Rules independently
// validate cost, one field, level cap and all unchanged fields; this is not trust.
export function trainingIntent(before, after) {
  for (const hero of ['mage','archer','warrior','gunner','fighter']) for (const stat of ['hp','atk']) {
    const expected = structuredClone(before), level = before.heroLv?.[hero]?.[stat];
    if (!Number.isInteger(level)) continue;
    expected.heroLv[hero][stat]++;
    expected.souls -= Math.round((stat === 'hp' ? 30 : 40) * 1.5 ** level);
    if (stable(expected) === stable(after)) return {op:'economy_perm',hero,stat};
  }
  return null;
}
