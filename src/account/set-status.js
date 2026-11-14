// Read-only presentation of the same equipped slots and tiers used by bonus().
import { equippedItems, setOf, setBonuses, SLOT_KEYS } from './equip.js';
import { CHSET, CH_KEYS } from '../data/items.js';
import { BOSS_SETS } from '../data/boss-sets.js';

export const SET_KEYS = [...CH_KEYS, ...Object.keys(BOSS_SETS)];
export const setDefinition = key => BOSS_SETS[key] || CHSET[key];
export const itemSetKey = it => setOf(it) ? String(it.set || it.c) : '';
export function setStatuses(save, hero) {
  const items = equippedItems(save, hero), applied = setBonuses(save, hero);
  return SET_KEYS.map(key => {
    const C = setDefinition(key), worn = items.filter(it => itemSetKey(it) === String(key));
    return { key, name: C.n, badge: C.badge, color: C.color, count: worn.length,
      slots: SLOT_KEYS.map(slot => ({ slot, item: worn.find(it => it.s === slot)?.n || null })),
      tiers: (C.bonuses || []).map(b => ({ pieces: b.pieces, stats: { ...b.stats },
        active: applied.some(a => String(a.set || a.ch) === String(key) && a.pieces === b.pieces) })) };
  });
}
// Capture at spawn so changing the viewed hero/account never changes battle labels.
export function setsForItems(items, hero) {
  const eq = Object.fromEntries(items.map(it => [it.s, it.id]));
  return setStatuses({ inv: items, eq: { [hero]: eq } }, hero).filter(s => s.count);
}
