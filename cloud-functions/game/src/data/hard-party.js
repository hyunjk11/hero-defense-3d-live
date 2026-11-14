import { VISIBLE_HEROES } from './heroes.js';
import { eKeyFor } from './hero-e.js';

export const HARD_PARTY_VERSION = 1;
export const validPartner = (main, partner) => VISIBLE_HEROES.includes(main) && VISIBLE_HEROES.includes(partner) && main !== partner;
export const movementAllowed = h => !h?.hardHold;
export function movingSkill(h, key) {
  if (key === 'Q') return h?.cls === 'fighter' && !['tigerquake', 'dragonwave'].includes(h.adv?.skill);
  return ['quake', 'tigerdash'].includes(eKeyFor(h?.cls, h?.C?.level || 1, h?.adv));
}
export const skillAllowed = (h, key) => !h?.hardHold || !movingSkill(h, key);
export function clearOrders(h) {
  if (!h) return;
  h.path = []; h.aiGoal = null; h.aiTgt = null; h.aiT = 0;
}
export function setHold(h, value) {
  if (!h) return;
  h.hardHold = !!value; clearOrders(h);
}
