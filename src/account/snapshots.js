// Whole-save decisions. Consumable balances and item inventories must never be unioned.
import { clean, empty } from './progress.js';

export const sameSave = (a, b) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
export function hasProgress(value) {
  const s = clean(value);
  const base = clean(empty());
  for (const key of ['hero', 'nick', 'settings']) { delete s[key]; delete base[key]; }
  return JSON.stringify(s) !== JSON.stringify(base);
}
export function reconcile(local, cloud, { first = false, dirty = false, changed = false } = {}) {
  if (!cloud) return { source: 'local', data: clean(local) };
  if (sameSave(local, cloud)) return { source: 'cloud', data: clean(cloud) };
  if ((first && hasProgress(local)) || (dirty && changed)) return { source: 'conflict' };
  return dirty && !first ? { source: 'local', data: clean(local) } : { source: 'cloud', data: clean(cloud) };
}
