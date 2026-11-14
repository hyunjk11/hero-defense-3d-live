import { abyssalRoll } from '../data/boss-sets.js';
import { makeItem, addChests } from './equip.js';
// Versioned run limits preserve payouts for guest entries started before expansion.
const rewardFor = (floors, win, maxFloors) => [0,150,400,700,1100,1700,2400,3200,4100,5100,6300][floors] + (win && floors === maxFloors ? 300 : 0);

// Guest entries live in the same save as the payout, so a retry cannot add it twice.
export const dungeonDay = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
export function cleanGuestDungeon(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) || !/^[0-9a-f-]{36}$/i.test(value.token) || !['active', 'done'].includes(value.status)) return null;
  const maxFloors = value.maxFloors === 10 ? 10 : 5;
  return { maxFloors, day: value.day, token: value.token, status: value.status, floors: Math.max(0, Math.min(maxFloors, Math.floor(+value.floors || 0))), win: !!value.win };
}
export function guestDungeonLeft(save, now = Date.now()) {
  const r = cleanGuestDungeon(save.guestDungeon);
  return r && r.day >= dungeonDay(now) ? 0 : 1;
}
export function startGuestDungeon(save, token, now = Date.now()) {
  if (!guestDungeonLeft(save, now)) return { save, ok: false, reason: 'daily_limit' };
  const entry = cleanGuestDungeon({ maxFloors: 10, day: dungeonDay(now), token, status: 'active', floors: 0, win: false });
  if (!entry) return { save, ok: false, reason: 'bad_token' };
  return { save: { ...save, guestDungeon: entry }, ok: true, token, maxFloors: entry.maxFloors };
}
export function finishGuestDungeon(save, token, cleared, win, hero = 'mage', random = Math.random) {
  const r = cleanGuestDungeon(save.guestDungeon);
  if (!r || r.token !== token) return { save, ok: false, reason: 'bad_token' };
  if (r.status === 'done') return { save, ok: true, souls: rewardFor(r.floors, r.win, r.maxFloors), floors: r.floors, win: r.win, already: true };
  const maxFloors = r.maxFloors;
  const floors = Math.max(0, Math.min(maxFloors, Math.floor(+cleared || 0))), won = !!win && floors === maxFloors, souls = rewardFor(floors, won, maxFloors);
  const next = { ...save, souls: (save.souls || 0) + souls, guestDungeon: { ...r, status: 'done', floors, win: won } };
  let item = null;
  if (won && maxFloors === 10) {
    item = abyssalRoll(['warrior','archer','mage','gunner','fighter'].includes(hero) ? hero : 'mage', random);
    next.chests = [...(save.chests || [])]; next.mat = { ...(save.mat || {}) };
    addChests(next, [{ it: makeItem(item.s, item.h, item.g, random, item.set), src: 'boss' }]);
  }
  return { save: next, ok: true, souls, floors, win: won, maxFloors, item };
}
