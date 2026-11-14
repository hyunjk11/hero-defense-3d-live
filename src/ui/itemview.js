import { endgameIcon } from './endgame-icons.js';
import { machineIcon } from './machine-icons.js';
import { morviaIcon } from './morvia-icons.js';
import { stormIcon } from './storm-icons.js';

import { esc } from '../core/util.js';
import { CLASSES, HERO_KEYS } from '../data/heroes.js';
import * as E from '../account/equip.js';
import * as ST from '../data/stages.js';
import { CHSET } from '../data/items.js';
import { desertIcon } from './desert-icons.js';
import { swampIcon } from './swamp-icons.js';
export const ICON = { ...Object.fromEntries(HERO_KEYS.map(k => [k, CLASSES[k].icon])), armor: '🛡️', acc: '💍' }; // 영웅 무기 아이콘은 data/heroes.js 의 icon (빠진 영웅이 없도록 한 곳에서)
export const FALLBACK = { weapon: '⚔️', any: '📦' }; // 모르는 영웅/슬롯 키 → 'undefined' 대신 일반 아이콘
export const iconKey = k => ICON[k] || FALLBACK.any;
export const weaponIcon = h => ICON[h] || FALLBACK.weapon;
export const icon = it => endgameIcon(it) || morviaIcon(it) || machineIcon(it) || stormIcon(it) || desertIcon(it) || swampIcon(it) || (!it ? FALLBACK.any : it.s === 'weapon' ? weaponIcon(it.h) : iconKey(it.s));

export const setOf = E.setOf;
export const GCi = it => GC(it.g);
export const clsN = h => (CLASSES[h] || {}).n || '알 수 없는 영웅';
export const pct = (k, v) => `${E.STAT[k]} +${v}%`;
export const GC = g => E.GRADES[g].c;
export const eqOf = (s, id) => { for (const h in s.eq) for (const sl in s.eq[h]) if (s.eq[h][sl] === id) return h; return null; };
export function sorted(list, s) { return [...list].sort((a, b) => (!!eqOf(s, b.id) - !!eqOf(s, a.id)) || b.g - a.g || b.e - a.e || E.power(b) - E.power(a)); }
export function tile(it, s, extra = '') { const h = eqOf(s, it.id), C = setOf(it); return `<button class="itile g${it.g}${C ? ' cset' : ''} ${extra}" data-id="${esc(it.id)}" style="--gc:${GCi(it)}${C ? `;--cc:${C.color}` : ''}"><span class="ic">${icon(it)}</span>${it.e ? `<span class="en">+${it.e}</span>` : ''}${h ? `<span class="eqb">${clsN(h)[0]}</span>` : ''}${E.legendKey(it) ? '<span class="lst">✦</span>' : ''}${C ? `<span class="chb">${C.badge}</span>` : ''}</button>`; }
export function lskHtml(it) { const k = E.legendKey(it); if (!k) return ''; const L = E.LSK[k]; return `<div class="lsk"><div class="lskH">✦ ${L.n} <i>자동 발동</i></div><div class="lskD">${L.d}</div></div>`; }
export function card(it, cmp) {
  if (!it) return '<div class="icard empty">빈 칸</div>'; const st = E.itemStats(it), cs = cmp ? E.itemStats(cmp) : null, keys = new Set([...Object.keys(st), ...(cs ? Object.keys(cs) : [])]);
  const lines = [...keys].map(k => { const v = st[k] || 0, d = cs ? Math.round((v - (cs[k] || 0)) * 10) / 10 : 0; return `<div class="sl ${k === it.m[0] ? 'main' : ''}">${E.STAT[k]} <b>+${v}%</b>${cs && d ? `<i class="${d > 0 ? 'gup' : 'gdn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>` : ''}</div>`; }).join('');
  const C = setOf(it), setLine = C?.bonuses ? `<div class="isetStats">${C.bonuses.map(b => `${b.pieces}세트 · ${Object.entries(b.stats).map(([k,v]) => pct(k,v)).join(" · ")}`).join("<br>")}</div>` : "";
  return `<div class="icard g${it.g}${C ? ' cset' : ''}" style="--gc:${GC(it.g)}${C ? `;--cc:${C.color}` : ''}"><div class="ih"><span class="ic">${icon(it)}${C ? `<i class="chb">${C.badge}</i>` : ''}</span><div><div class="in">${esc(it.n)}${it.e ? ` <span class="en">+${it.e}</span>` : ''}</div><div class="ig">${E.GRADES[it.g].n} · ${E.SLOTS[it.s]}${it.h ? ' · ' + clsN(it.h) + ' 전용' : ''}</div>${C ? `<div class="iset">${C.badge} ${C.n} 세트 · ${C.source || ST.CHAPTERS.find(c => c.id === it.c)?.n.split(' · ')[0] || ''}</div>` : ''}</div></div>${lines}${setLine}${lskHtml(it)}${cmp ? `<div class="cmpn">장착 중인 장비와 비교</div>` : ''}</div>`;
}
export function bonusHtml(b) { const e = Object.entries(b); return e.length ? e.map(([k, v]) => `<span>${pct(k, v)}</span>`).join('') : '<span class="none">장착한 장비 없음</span>'; }
export function heroDots(s, h) { return E.SLOT_KEYS.map(sl => { const it = s.inv.find(x => x.id === (s.eq[h] || {})[sl]); return `<i class="dot" style="background:${it ? GCi(it) : '#3a3450'}" title="${E.SLOTS[sl]}"></i>`; }).join(''); }

