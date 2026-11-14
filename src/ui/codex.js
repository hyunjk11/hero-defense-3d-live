// 도감 탭 (C-10b: ui/gear.js 에서 분리 — 동작 불변). 가방 패널 상태(ui)·훅·다시 그리기는 gear.js 가 X 로 넘김
import { Snd } from '../audio/audio.js';
import { $, esc } from '../core/util.js';
import { CLASSES, heroLabel } from '../data/heroes.js';
import {directGearEnabled,runDirectGear} from '../account/direct-gear-client.js';
import * as Acc from '../account/account.js';
import * as E from '../account/equip.js';
import * as HG from '../account/hero-growth.js';
import { optionalCollectionGrade } from '../data/hard-collection.js';
import * as P from '../account/progress.js';
import * as ST from '../data/stages.js';
import { CHSET, CH_KEYS, CODEX_RW } from '../data/items.js';
import { MORVIA_HEROES, BOSS_SETS } from '../data/boss-sets.js';
import { setStatuses, setDefinition } from '../account/set-status.js';
import { setCard } from './setview.js';
import { iconKey, weaponIcon, icon, clsN, GC, card } from './itemview.js';
import { showTip, hideTip } from './gear.js'; // 순환 import — 호출 시점에만 씀
// 도감 (가방 패널의 '도감' 탭) ----------
export const cxRowIcon = row => (row === 'armor' || row === 'acc' ? iconKey(row) : weaponIcon(row));
export const cxRowN = row => (row === 'armor' ? '방어구' : row === 'acc' ? '장신구' : `${(CLASSES[row] || {}).nm || clsN(row)} 무기`);
export const cxSlot = row => (row === 'armor' || row === 'acc' ? row : 'weapon');
export const rwTxt = rw => [rw.crystal ? `마력석 ${rw.crystal}` : '', rw.essence ? `전직 정수 ${rw.essence}` : '', rw.souls ? `영혼석 ${rw.souls}` : ''].filter(Boolean).join(' · ');
export function codexClaimable(s) { return CH_KEYS.some(ch => { const C = P.codexState(s, ch); return C.rows.some(r => r.done && !r.got) || (C.all.done && !C.all.got); }); }
// 견본(표시용, 저장 안 함): 고정 시드
export const sampleR = () => { let q = 12345; return () => (q = (q * 16807) % 2147483647) / 2147483647; };
export const sampleItem = (ch, row, g) => E.makeItem(cxSlot(row), cxSlot(row) === 'weapon' ? row : P.codexRows()[0], g, sampleR(), ch);
export function renderCodex(s, X) { const ui = X.ui;
  const extraEnabled=HG.available()&&HG.HG.features.hardCollection===1;
  if (!CH_KEYS.includes(ui.cxTab) && !BOSS_SETS[ui.cxTab]) ui.cxTab = 1;
  const tabs = CH_KEYS.map(c => [c, `${CHSET[c].badge} ${CHSET[c].n}`, (C => `${C.seen}/${C.total}`)(P.codexState(s, c))]);
  for(const C of Object.values(BOSS_SETS)) tabs.push([C.key, `${C.badge} ${C.n}`, '던전']);
  let h = `<div class="cxTabs">${tabs.map(([c, n, sm]) => `<button class="ftab ${ui.cxTab === c ? 'on' : ''}" data-c="${c}" style="--cc:${setDefinition(c).color}">${n} <small>${sm}</small></button>`).join('')}</div>`;
  h += setCard(setStatuses(s, s.hero).find(x => x.key === ui.cxTab), heroLabel(s.hero));
  if (BOSS_SETS[ui.cxTab]) { const C=BOSS_SETS[ui.cxTab];
    h += `<div class="cxBossSource">${C.source} · 영웅 등급 · 현재 보유 (가방·창고)</div><div class="cxBossGrid">` + [...MORVIA_HEROES, 'armor', 'acc'].map(row => {
      const owned = E.allItems(s).filter(it => it.set === C.key && (cxSlot(row) === 'weapon' ? it.s === 'weapon' && it.h === row : it.s === row)).length;
      return `<button class="cxBossItem${owned ? ' owned' : ''}" data-boss-row="${row}"><span>${cxRowIcon(row)}</span><span><b>${esc(C.names[row][C.grade])}</b><small>${cxRowN(row)}</small></span><em>${owned ? `보유 ${owned}` : '미보유'}</em></button>`;
    }).join('') + '</div>';
  } else if (ui.cxTab) { const ch = ui.cxTab, C = P.codexState(s, ch), SC = ST.CHAPTERS.find(c => c.id === ch), un = ST.chapterUnlocked(s, ch);
    h += `<div class="cxGridScroll" tabindex="0" role="region" aria-label="장비 수집 등급표"><div class="cxGrid" style="--cc:${CHSET[ch].color}"><div class="cxHd"></div>${E.GRADES.map(g => `<div class="cxHd" style="color:${g.c}">${g.n}</div>`).join('')}<div class="cxHd">보상</div>`
      + C.rows.map(r => `<div class="cxRow">${cxRowIcon(r.row)}<small>${cxRowN(r.row)}</small></div>` + [0, 1, 2, 3, 4].map(g => { const seen = r.bits & (1 << g), optional = optionalCollectionGrade(ch,g)&&(extraEnabled||!!seen), na = !(C.mask & (1 << g))&&!optional; return `<button class="cxC ${seen ? 'seen' : ''}${na ? ' na' : ''}" data-ch="${ch}" data-row="${r.row}" data-g="${g}" data-extra="${optional?1:0}" aria-label="${cxRowN(r.row)} ${E.GRADES[g].n} · ${seen?'획득':na?'미출현':'미획득'}${optional?' · 추가 수집':''}" style="--gc:${GC(g)}">${seen ? `<span>${icon(sampleItem(ch, r.row, g))}</span>` : na ? '—' : '?'}</button>`; }).join('')
        + `<div class="cxRw">${r.got ? '✓' : r.done ? `<button class="gbtn sm main cxGet" data-k="${r.key}">받기</button>` : `${r.n}/${r.max}`}</div>`).join('') + '</div></div>'
      + `<div class="cxFoot"><span>${SC.n} · 도감 수집 <b>${C.seen}/${C.total}</b>${optionalCollectionGrade(ch,0)&&(extraEnabled||C.rows.some(r=>r.extra&1))?` · 추가 수집 ${C.rows.filter(r=>r.bits&1).length}/${C.rows.length}`:''}${un ? '' : ' · 🔒 아직 열리지 않은 챕터'}</span><span class="cxAllRw">행 완성 ${rwTxt(CODEX_RW.row)} · 전부 완성 ${rwTxt(CODEX_RW.all)}</span>${C.all.got ? '<b class="cxDone">✓ 완성 보상 받음</b>' : C.all.done ? `<button class="gbtn main cxGet" data-k="${C.all.key}">🏆 완성 보상 받기</button>` : ''}</div>`;
  }
  $('codexBody').innerHTML = h;
  document.querySelectorAll('#codexBody .cxTabs .ftab').forEach(b => b.onclick = () => { ui.cxTab = BOSS_SETS[b.dataset.c] ? b.dataset.c : +b.dataset.c; Snd.play('ui'); hideTip(); X.renderInv(); });
  document.querySelectorAll('#codexBody .cxGet').forEach(b => b.onclick = async () => { let rw;try{if(directGearEnabled()){const [r]=await runDirectGear([{p_action:'codex',p_item:b.dataset.k}]);rw=r.reward;}else Acc.update(d => { const o = P.claimCodex(d, b.dataset.k); rw = o[1]; return o[0]; });}catch(e){showTip(b,esc(e.message));return;} if (rw) { Snd.play('levelUp', { force: true }); Snd.play('coins'); X.hooks().cheer(); } else Snd.play('error'); X.hooks().onChange(true); X.renderInv(); });
  document.querySelectorAll('#codexBody [data-boss-row]').forEach(b => {
    const tip = () => card(sampleItem(ui.cxTab, b.dataset.bossRow, BOSS_SETS[ui.cxTab].grade));
    b.onpointerenter = e => { if (e.pointerType === 'mouse') showTip(b, tip()); };
    b.onpointerleave = e => { if (e.pointerType === 'mouse') hideTip(); };
    b.onclick = () => { showTip(b, tip()); X.tipLater(); Snd.play('select'); };
  });
  const tipOf = b => { const it = sampleItem(+b.dataset.ch, b.dataset.row, +b.dataset.g), na = b.classList.contains('na'); return (b.dataset.extra==='1' ? `<div class="cxUnseen">추가 수집 · 완성 보상 제외${b.classList.contains('seen')?'':' · 미획득'}</div>` : na ? `<div class="cxUnseen">${CHSET[+b.dataset.ch].n} 세트는 ${E.GRADES[+b.dataset.g].n} 등급이 나오지 않아요 · 도감 완성에 필요 없음${b.classList.contains('seen') ? ' (특별 획득)' : ''}</div>` : b.classList.contains('seen') ? '' : '<div class="cxUnseen">아직 얻지 못한 장비 (견본)</div>') + card(it); };
  document.querySelectorAll('#codexBody .cxC').forEach(b => { b.onpointerenter = e => { if (e.pointerType === 'mouse') showTip(b, tipOf(b)); }; b.onpointerleave = e => { if (e.pointerType === 'mouse') hideTip(); };
    b.onclick = () => { showTip(b, tipOf(b)); X.tipLater(); Snd.play('select'); }; });
}
