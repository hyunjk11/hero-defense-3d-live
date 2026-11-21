import * as Acc from './account.js';
import * as HG from './hero-growth.js';
import { DG_PICK_KEY, DG_MAX, dungeonParty, pickParty } from '../data/dungeon.js';
import { SP_PICK_KEY } from '../data/spire.js';
import { heroOwned } from './shop.js';

const key = mode => mode === 'spire' ? SP_PICK_KEY : DG_PICK_KEY;
export function readPracticeParty(mode) {
  try {
    const a = JSON.parse(localStorage.getItem(key(mode)) || 'null');
    return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, 8) : null;
  } catch { return null; }
}
export function readSortieParty(mode) {
  if (Acc.A.user) {
    if (HG.sortieSettingsEnabled()) return HG.HG.growth?.sortieSettings?.[mode] || null;
    // Until an online account has been read, don't display another player's local party.
    if (!HG.enabled()) return null;
  }
  return readPracticeParty(mode);
}
export function writeSortieParty(mode, party) {
  if (HG.sortieSettingsEnabled() || Acc.A.user && Acc.A.sb?.serverEconomy && !HG.enabled()) return HG.changeSortieSettings(mode, party);
  try { localStorage.setItem(key(mode), JSON.stringify(party)); return true; } catch { return false; }
}
export function rankParty(mode) {
  if (!HG.sortieSettingsEnabled()) return null;
  const pref = readSortieParty(mode) || (mode === 'spire' ? readSortieParty('dungeon') : null);
  return pickParty(dungeonParty(c => heroOwned(c)), pref);
}
export function cleanEntryParty(value) {
  return Array.isArray(value) && value.length >= 1 && value.length <= DG_MAX &&
    new Set(value).size === value.length && value.every(c => typeof c === 'string') ? value : null;
}
