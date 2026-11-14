import { BLESS_BY, ROLE, jointReady, nextFloorHp } from '../data/dungeon.js';

export const AUTO_PICK_DELAY = 1.2;
const AUTO_KEY = 'hd3d_live_dungeonAllAuto';
export function loadDungeonAuto() { try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; } }
export function saveDungeonAuto(on) { try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch {} }

// Compare only the cards actually offered. Recovery accounts for the free floor rest.
export function autoBlessChoice(choices, taken = {}, heroes = [], pendingHeal = 0, healScale = 1) {
  const party = heroes.filter(h => h.max > 0), roles = party.map(h => ROLE[h.cls]);
  const hp = party.map(h => {
    const rest = nextFloorHp(Math.max(0, h.hp), h.max, h.dead > 0);
    const afterRest = h.dead > 0 ? rest : h.hp + (rest - h.hp) * healScale;
    return Math.min(1, afterRest / h.max + pendingHeal * healScale);
  });
  const mean = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
  const recovery = mean(hp.map(n => Math.min(.5 * healScale, 1 - n)));
  const low = hp.length ? Math.min(...hp) : 1;
  const share = role => roles.filter(r => r === role).length / Math.max(1, party.length);
  const scores = {
    heal: recovery * 120 + (recovery > .05 && low < .5 ? 35 : 0),
    regen: 24 + (1 - mean(hp)) * 18,
    haste: 22, might: 20, crit: 23, ult: 18,
    tank: 16 + (party.some(h => ROLE[h.cls] === 'tank' && (h.dead > 0 || h.hp < h.max * .5)) ? 22 : 0),
    ranged: 12 + share('ranged') * 32,
    caster: 12 + share('caster') * 32,
    bruiser: 14 + share('bruiser') * 32,
  };
  let best = null, score = -Infinity;
  for (const id of choices || []) {
    const b = BLESS_BY[id];
    if (!b || (taken[id] || 0) >= b.max || (b.role && !roles.includes(b.role))) continue;
    const value = scores[id] / (id === 'heal' ? 1 : 1 + (taken[id] || 0) * .35);
    if (value > score) { best = id; score = value; }
  }
  return best;
}

export function wantAutoJoint(heroes, enemies) {
  if (!jointReady(heroes)) return false;
  const targets = enemies.filter(e => !e.dead && e.dying === undefined && e.state !== 'spawn');
  return targets.length > 0 && (targets.length >= 4 || targets.some(e => e.E?.boss || e.E?.elite || e.elite)
    || heroes.some(h => h.dead <= 0 && h.hp < h.max * .4));
}
