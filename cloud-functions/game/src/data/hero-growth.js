// Shared client/server rules. XP fractions always floor; stat HP rounds at each existing stat layer.
import { HERO_KEYS, VISIBLE_HEROES } from './heroes.js';
import { cleanAwakening, cleanAwakeningSkills } from './awakening.js';
import { cleanTrees } from './skill-tree.js';
import { cleanHard, hardXP, HARD_STAGES } from './hard.js';
import { STAGES, getStage } from './stages.js';
export const VERSION = 1, MAX_LEVEL = 50, ADV_LEVEL = 10, MAX_XP = 1e9;
export const whole = (x, max = MAX_XP) => Number.isSafeInteger(x) && x >= 0 ? Math.min(max, x) : 0;
export const totalXP = level => { const n = Math.max(0, Math.min(49, Math.floor(level) - 1)); return 100 * n + 20 * n * (n - 1); };
export const nextXP = level => level >= MAX_LEVEL ? 0 : 100 + 40 * (Math.max(1, level) - 1);
export function levelOf(xp = 0) { let level = 1; while (level < MAX_LEVEL && totalXP(level + 1) <= whole(xp)) level++; return level; }
export function levelMods(level = 1) { const n = Math.max(0, Math.min(49, Math.floor(level) - 1)); return { dmg: 1 + .012 * n, hp: 1 + .005 * n, skill: 1 + .005 * n }; }
export const FOCUS_MAX = 5;
export const focusCost = n => Number.isInteger(n) && n >= 0 && n < FOCUS_MAX ? Math.round(40 * 1.5 ** n) : Infinity;
export function focusMods(n = 0) { n = whole(n, FOCUS_MAX); return { dmg: 1 + .04 * n, rate: 1 + .02 * n, skill: 1 + .04 * n, cd: .98 ** n }; }
export function buyFocus(state) {
  const n = state.focus ?? 0, cost = focusCost(n);
  if (!state.growthEnabled || state.dungeon || state.paused || state.navigating || !['build', 'wave'].includes(state.phase) || !Number.isFinite(cost) || !Number.isFinite(state.gold) || state.gold < cost) return false;
  state.gold -= cost; state.focus = n + 1; return true; // Never touch HP, cooldowns, effects or revive timers.
}
export function campaignXP(stage, completed, win = false, first = false) {
  const s = typeof stage === 'string' ? getStage(stage) : stage;
  if (!s) return whole(completed, 9999) * 12;
  if(s.hard)return hardXP(s,completed,win,first);
  if (!(s.ch >= 1 && s.ch <= 10)) return 0;
  const n = whole(completed, s.waves), wave = 10 + 2 * (s.ch - 1), clear = win === true && n === s.waves;
  const base = n * wave + (clear ? Math.floor(s.waves * wave / 3) : 0);
  return base + (clear && first ? Math.floor(base / 2) : 0);
}
export const dungeonXP = (floors, win, maxFloors = 10) => { const cap = maxFloors === 5 ? 5 : 10; return whole(floors, cap) * 40 + (floors === cap && win === true ? 100 : 0); };
export const spireXP = (from, top) => Math.max(0, Math.min(30, whole(top, 100000) - whole(from, 100000) + 1)) * 8;
export function initialGrowth(save = {}) {
  const first = Object.keys(STAGES).filter(k => STAGES[k].ch <= 8 && Number(save.st?.[k]) >= 1);
  const granted = first.reduce((n, k) => n + campaignXP(k, STAGES[k].waves, true, true), 0);
  return { version: VERSION, rev: 0, earned: 0, granted, spent: 0, balance: granted, xp: Object.fromEntries(HERO_KEYS.map(h => [h, 0])), first, legacyAdv: Object.keys(save.adv || {}).filter(h => HERO_KEYS.includes(h)), migrated: true };
}
export function cleanGrowth(v) {
  if (!v || v.version !== VERSION) return null;
  const g = initialGrowth(); for (const k of ['rev', 'earned', 'granted', 'spent', 'balance']) g[k] = whole(v[k]);
  for (const h of HERO_KEYS) g.xp[h] = Math.min(totalXP(50), whole(v.xp?.[h]));
  g.first = [...new Set((Array.isArray(v.first) ? v.first : []).filter(k => (STAGES[k]?.ch <= 10 || HARD_STAGES[k])))];
  g.legacyAdv = (Array.isArray(v.legacyAdv) ? v.legacyAdv : []).filter(h => HERO_KEYS.includes(h));
  if(v.trees)g.trees=cleanTrees(v.trees); if(v.hard)g.hard=cleanHard(v.hard);
  if(v.awakening){const awakening=cleanAwakening(v.awakening);if(Object.keys(awakening).length)g.awakening=awakening;}
  if(v.awakeningSkill){const awakeningSkill=cleanAwakeningSkills(v.awakeningSkill);if(Object.keys(awakeningSkill).length)g.awakeningSkill=awakeningSkill;}
  return g;
}
export function quote(g, hero, target) {
  if (!g || !VISIBLE_HEROES.includes(hero) || !Number.isInteger(target) || target < 1 || target > 50) return { ok: false, reason: 'invalid' };
  const before = levelOf(g.xp[hero]); if (target <= before) return { ok: false, reason: before === 50 ? 'max' : 'level' };
  const cost = totalXP(target) - g.xp[hero];
  return { ok: g.balance >= cost, reason: g.balance >= cost ? null : 'poor', before, target, cost, left: g.balance - cost };
}
export function invest(g, hero, target) {
  const q = quote(g, hero, target); if (!q.ok) return { ...q, growth: g };
  const n = structuredClone(g); n.balance -= q.cost; n.spent += q.cost; n.xp[hero] += q.cost; n.rev++;
  return { ...q, growth: n };
}
export function credit(g, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || g.earned + g.granted + amount > MAX_XP) throw new Error('XP limit');
  g.earned += amount; g.balance += amount; if (amount) g.rev++; return g;
}
export const heroLevel = (save, hero) => levelOf(save?.growth?.xp?.[hero]);
