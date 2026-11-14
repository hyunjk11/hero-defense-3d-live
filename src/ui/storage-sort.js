import * as SG from '../account/storage.js';
import { power, setOf } from '../account/equip.js';

export const STORAGE_SORTS = { group: '종류·등급순', set: '세트순', grade: SG.SORTS.grade, power: SG.SORTS.power, enh: SG.SORTS.enh, recent: SG.SORTS.recent };
const SLOT = { weapon: 0, armor: 1, acc: 2 };
// View order only: preserve save order, item identity and selection IDs.
export function sortStorageItems(items, mode = 'group') {
  if (mode !== 'group' && mode !== 'set') return SG.sortItems(items, mode);
  return items.map((item, index) => ({ item, index, power: power(item) })).sort((a, b) => {
    const x = a.item, y = b.item;
    const bySet = mode === 'set' ? String(setOf(x)?.key ?? x.set ?? x.c ?? '').localeCompare(String(setOf(y)?.key ?? y.set ?? y.c ?? ''), undefined, { numeric: true }) : 0;
    return bySet || (SLOT[x.s] ?? 3) - (SLOT[y.s] ?? 3)
      || String(x.h || '').localeCompare(String(y.h || ''))
      || (Number(y.g) || 0) - (Number(x.g) || 0)
      || (Number(y.e) || 0) - (Number(x.e) || 0)
      || b.power - a.power || a.index - b.index;
  }).map(row => row.item);
}
