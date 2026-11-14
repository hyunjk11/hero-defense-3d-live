import { esc } from '../core/util.js';
import { SLOTS, STAT } from '../account/equip.js';

export const setStatsText = stats => Object.entries(stats).map(([k, v]) => `${STAT[k]} +${v}%`).join(' · ');
export function setCard(s, hero = '', compact = false) {
  const active = s.tiers.some(t => t.active);
  return `<section class="setCard${compact ? ' compact' : ''}" style="--set-color:${s.color}" aria-label="${esc(s.name)} 착용 세트">
    <div class="setHead"><b>${s.badge} ${esc(s.name)}</b><span>${hero ? `${esc(hero)} · ` : ''}${s.count}/3부위 장착</span></div>
    ${compact ? '' : `<div class="setSlots">${s.slots.map(x => `<span class="${x.item ? 'worn' : ''}" title="${esc(x.item || '장착 안 함')}">${x.item ? '✓' : '−'} ${SLOTS[x.slot]}</span>`).join('')}</div>`}
    ${s.tiers.length ? `<div class="setTiers">${s.tiers.map(t => `<div class="setTier${t.active ? ' active' : ''}"><b>${t.active ? '✓ 활성' : '미활성'} · ${t.pieces}부위</b><span>${esc([setStatsText(t.stats),t.desc].filter(Boolean).join(' · '))}</span>${t.active ? '' : `<small>${Math.max(0,t.pieces-s.count)}부위 더 장착</small>`}</div>`).join('')}</div>` : '<div class="setNone">별도 착용 세트 효과 없음</div>'}
    ${compact || !s.tiers.length ? '' : `<small class="setHint">${active ? '활성 효과는 능력치에 합산됨' : '같은 영웅에게 장착하면 활성'} · 등급 무관</small>`}
  </section>`;
}
export const equippedSetsHtml = states => states.length ? states.map(s => setCard(s, '', true)).join('') : '<div class="stNone">장착한 세트 장비 없음</div>';
