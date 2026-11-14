// 관리자 우편 보상의 아이템 · 조각(전직 정수) — 순수 로직 (node 테스트: tests/admin.test.mjs)


import { MORVIA, MORVIA_SHOP, MORVIA_HEROES, BOSS_SETS } from '../data/boss-sets.js';
import { CHSET, CH_KEYS } from '../data/items.js';
import { CLASSES, HERO_KEYS, VISIBLE_HEROES } from '../data/heroes.js';
import { GRADES, SLOTS, SLOT_KEYS, GEAR_NAMES } from './equip.js';

export const MAX_ITEMS = 10, MAX_ESSENCE = 10000;
export const ITEM_HEROES = HERO_KEYS; // 서버가 받는 영웅 키 (숨긴 영웅은 받을 때 기본 영웅 무기로 — equip.randomItem 과 같은 규칙)
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function validItem(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  if (x.k !== 'gear') return false;
  if (!Object.keys(x).every(k => ['k', 's', 'h', 'g', 'c', 'set'].includes(k)) || !SLOT_KEYS.includes(x.s) || !isInt(x.g, 0, 4)) return false;
  if (x.s === 'weapon' ? !ITEM_HEROES.includes(x.h) : 'h' in x) return false;
  if ('set' in x) return !!BOSS_SETS[x.set] && x.g === BOSS_SETS[x.set].grade && !('c' in x) && (x.s !== 'weapon' || MORVIA_HEROES.includes(x.h));
  return !('c' in x) || Number.isInteger(x.c) && CH_KEYS.includes(x.c);
}
export const validItems = v => v === undefined || (Array.isArray(v) && v.length >= 1 && v.length <= MAX_ITEMS && v.every(validItem));
// 정리: 올바른 것만, 최대 10개 (받을 때 사용)
export const cleanItems = v => (Array.isArray(v) ? v.filter(validItem).slice(0, MAX_ITEMS) : []);
// 이름표
const gearName = x => { const row = x.s === 'weapon' ? x.h : x.s, C = BOSS_SETS[x.set] || CHSET[x.c]; const n = C && C.names[row] && C.names[row][x.g]; return n || (GEAR_NAMES[row] || [])[x.g]?.join(' / ') || SLOTS[x.s]; };
export function itemLabel(x) {
  if (!validItem(x)) return '알 수 없는 아이템';
  return `${GRADES[x.g].n} ${x.s === 'weapon' ? (CLASSES[x.h] ? CLASSES[x.h].n + ' ' : '') + '무기' : SLOTS[x.s]}${x.set && BOSS_SETS[x.set] ? ` · ${BOSS_SETS[x.set].n} 세트` : x.c && CHSET[x.c] ? ` · ${CHSET[x.c].n} 세트` : ''} (${gearName(x)})`;
}
export const itemIcon = x => (x && x.s === 'weapon' ? '⚔️' : x && x.s === 'armor' ? '🛡️' : '💍');
export const gradeColor = x => (GRADES[(x && x.g) || 0].c);
export function itemsText(list) { const L = cleanItems(list); if (!L.length) return ''; return L.length <= 2 ? L.map(itemLabel).join(', ') : `장비 ${L.length}개`; }

export function catalog(heroes = VISIBLE_HEROES) {
  const out = [];
  for (const c of [0, ...CH_KEYS]) for (const s of SLOT_KEYS) for (const h of s === 'weapon' ? heroes : [null]) for (let g = 0; g <= 4; g++) {
    const spec = { k: 'gear', s, g }; if (h) spec.h = h; if (c) spec.c = c; out.push({ spec, n: gearName(spec), label: itemLabel(spec) }); }
  for (const item of MORVIA_SHOP) { const spec = item.reward.items[0]; if (!spec.h || heroes.includes(spec.h)) out.push({ spec, n: gearName(spec), label: itemLabel(spec) }); }
  return out;
}
export function searchCatalog(q, limit = 8, cat = catalog()) { q = String(q || '').trim().toLowerCase(); if (!q) return []; const t = q.split(/\s+/);
  return cat.filter(e => { const hay = (e.label + ' ' + e.n).toLowerCase(); return t.every(w => hay.includes(w)); }).slice(0, limit); }

export function previewLines(rw, owns = () => false) {
  const o = [], f = n => (+n || 0).toLocaleString('ko-KR'); if (!rw) return o;
  for (const [k, n] of [['souls', '영혼석'], ['steel', '강철'], ['crystal', '마력석'], ['essence', '전직 정수'], ['medals', '🏅 던전 메달']]) if (+rw[k]) o.push(`${n} +${f(rw[k])}`);
  if (rw.hero && CLASSES[rw.hero]) o.push(`유료 영웅 ${CLASSES[rw.hero].nm || ''} · ${CLASSES[rw.hero].n} 해금`);
  for (const x of cleanItems(rw.items)) o.push(`${itemLabel(x)} → 🎁 상자`);
  return o;
}
// 우편 id·순번으로 고정된 난수 (같은 우편을 다시 처리해도 같은 장비)
export function seeded(seed) { let a = 0; for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 1) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
