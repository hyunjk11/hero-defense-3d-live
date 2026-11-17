import { readPartner, writePartner, partners } from '../account/hard-party.js';
import { CLASSES, heroLabel } from '../data/heroes.js';
import { REPEAT_ROWS, targetLabel } from '../data/repeat-target.js';
import { readTarget, writeTarget } from '../account/repeat-target.js';
// ================= 스테이지 선택 지도 (출정의 문) =================
import * as HG from '../account/hero-growth.js';
import { hardOpen, hardReward } from '../data/hard.js';
import { HARD_REWARD_VERSION, collectionOdds, collectionCount } from '../data/hard-collection.js';
import { selectedSummary } from './skill-tree.js';
import { Snd } from '../audio/audio.js';
import { $, esc } from '../core/util.js';
import { definePanel } from './panel.js';
import * as Acc from '../account/account.js';
import * as ST from '../data/stages.js';
import * as P from '../account/progress.js';
import * as E from '../account/equip.js';
import { GRADES } from '../account/equip.js';
import { card, showTip, hideTip, sampleItem, weaponIcon, iconKey, icon } from './gear.js';

const ICONS = { forest: ['🌲', '🍄'], snow: ['❄️', '⛄'], volcano: ['🌋', '🔥'], ruins: ['🏛️', '🗿'], swamp: ['🌿', '🧪'], desert: ['🌵', '☀️'], storm: ['⚡', '☁️'], machine: ['⚙️', '🔩'], abyss: ['🌀', '🔮'], citadel: ['🐉', '🏰'] };
let stageFocus=null;
function stageOverlay(open){
 const town=$('scr_town');if(!town)return;
 const wasOpen=town.classList.contains('stageOpen');
 town.classList.toggle('stageOpen',open);
 for(const el of town.querySelectorAll(':scope > .twLeft,:scope > .twRail,:scope > .twBottom'))el.inert=open;
 if(open){if(!wasOpen)stageFocus=document.activeElement;let b=$('stageBackdrop');if(!b){b=document.createElement('div');b.id='stageBackdrop';b.onclick=()=>closeStageSel();town.appendChild(b);}b.classList.remove('hidden');queueMicrotask(()=>{if(town.classList.contains('stageOpen'))$('stClose').focus();});}
 else{$('stageBackdrop')?.classList.add('hidden');if(stageFocus?.isConnected)stageFocus.focus();stageFocus=null;}
}
let ui = { open: false, hard:false, ch: 1, sel: null }, hooks = { challenge: () => {}, start: () => {} };
const LAST = 'hd3d_live_lastStage';
export function initStageSel(h) { hooks = { ...hooks, ...h }; $('stClose').onclick = () => closeStageSel(); }
function current(s) { for (const ch of ST.CHAPTERS) for (const st of ch.stages) if (ST.stageUnlocked(s, st.id) && !ST.stars(s, st.id)) return st.id; return null; }
export function rememberStage(id) { try { localStorage.setItem(LAST, JSON.stringify({ id })); } catch (_) {} }
export function openStageSel(id = null) {
  if (ST.getStage(id)) ui.sel = id;
  const s = HG.viewSave(); if (!ui.open) Snd.play('confirm');
  if (!ui.sel) { try { const last = JSON.parse(localStorage.getItem(LAST) || 'null'); if (last && ST.stageUnlocked(s, last.id)) ui.sel = ST.stars(s, last.id) ? ST.nextStage(s, last.id) || last.id : last.id; } catch (_) {} }
  ui.sel ||= current(s) || '1-1'; ui.hard=!!ST.getStage(ui.sel)?.hard;ui.ch = ST.getStage(ui.sel)?.ch||1; ui.open = true; SP.show(); render(); stageOverlay(true);
}
export function closeStageSel(silent) { if (ui.open && !silent) Snd.play('ui'); ui.open = false; SP.hide(); hideTip(); stageOverlay(false); }
const SP = definePanel('stage', { id: 'stagePanel', z: 40, isOpen: () => ui.open, close: s => closeStageSel(s) });
const starStr = n => [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}">★</i>`).join('');
function render() {
  if (!ui.open) return; const s = HG.viewSave(), chapters=ui.hard?ST.HARD_CHAPTERS:ST.CHAPTERS, C = chapters.find(c => c.id === ui.ch);
  $('stTabs').innerHTML = `<div class="treeTabs"><button class="ftab ${!ui.hard?'on':''}" id="stNormal">일반</button><button class="ftab ${ui.hard?'on':''}" id="stHard">하드 ${hardOpen(s)?'':'🔒'}</button></div>`+chapters.map(c => `<button class="chtab ${ui.ch === c.id ? 'on' : ''} ${(ui.hard?ST.stageUnlocked(s,c.stages[0].id):ST.chapterUnlocked(s,c.id)) ? '' : 'locked'}" data-c="${c.id}" style="--cc:${c.color}"><b>${c.id}. ${c.short}</b><small>★ ${c.stages.reduce((n,x)=>n+ST.stars(s,x.id),0)}/${c.stages.length * 3}</small></button>`).join('') + (ui.hard?'':`<button class="chtab chal ${ui.ch === 0 ? 'on' : ''}" data-c="0" style="--cc:#ff5a7a"><b>도전 모드</b><small>최고 ${s.bestWave}웨이브</small></button>`);
  $('stNormal').onclick=()=>{ui.hard=false;ui.ch=1;ui.sel='1-1';render();};$('stHard').onclick=()=>{ui.hard=true;ui.ch=1;ui.sel='hard-1-1';render();};
  document.querySelectorAll('#stTabs .chtab').forEach(b => b.onclick = () => { ui.ch = +b.dataset.c; const c = chapters.find(x => x.id === ui.ch); ui.sel = c ? (c.stages.find(x => ST.stageUnlocked(s, x.id) && !ST.stars(s, x.id)) || c.stages[0]).id : null; Snd.play('select'); render(); });
  $('stTotal').innerHTML = ui.hard?(hardOpen(s)?`하드 ${ui.ch}장`: '일반 10-6 클리어 후 해금'):`총 별 <b>★ ${ST.totalStars(s)}</b> · 다음 별 보상 상자까지 ${ST.STAR_STEP - ST.totalStars(s) % ST.STAR_STEP}개`;
  const map = $('stMap'), info = $('stInfo');
  if (!C) {
    map.style.background = 'linear-gradient(160deg,#4a1a2a,#140810)'; map.innerHTML = floaties(['⚔️', '💀', '🔥', '👑']) + `<div class="chalBig"><div class="chalIco">♾️</div><div class="chalT">끝없는 도전</div><div class="chalD">5웨이브마다 보상 상자 · 보스 장비 드롭</div><div class="chalBest">최고 기록 <b>${s.bestWave}</b> 웨이브</div></div>`;
    info.innerHTML = '<div class="sn">도전 모드</div><div class="sd">웨이브 제한 없음 · 패배하거나 귀환할 때까지</div><button class="gbtn main bigGo" id="stChalGo">🌀 도전 시작</button>';
    $('stChalGo').onclick = () => { closeStageSel(true); hooks.challenge(); }; bindTips(map, s); return;
  }
  map.style.background = C.bg;
  const n = C.stages.length, pos = C.stages.map((st, i) => [8 + i * 84 / (n - 1), 50 + (i % 2 ? -22 : 20) + Math.sin(i * 1.7) * 6]);
  map.innerHTML = floaties(ICONS[C.theme] || ICONS.forest) + `<svg class="stPath" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${pos.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ')}" /></svg>` + C.stages.map((st, i) => {
    const u = ST.stageUnlocked(s, st.id), k = ST.stars(s, st.id);
    return `<button class="snode ${u ? '' : 'locked'} ${u && !k ? 'cur' : ''} ${st.boss ? 'boss' : ''} ${ui.sel === st.id ? 'sel' : ''}" data-id="${st.id}" style="left:${pos[i][0]}%;top:${pos[i][1]}%;--cc:${C.color}"><span class="num">${u ? st.boss ? '👑' : st.no : '🔒'}</span><span class="stars">${starStr(k)}</span><span class="nm">${st.n}</span></button>`;
  }).join('');
  map.querySelectorAll('.snode').forEach(b => b.onclick = () => { ui.sel = b.dataset.id; Snd.play('select'); render(); });
  const S = ST.getStage(ui.sel) || ST.getStage(C.stages[0].id), u = ST.stageUnlocked(s, S.id)&&(!ui.hard||HG.enabled()&&HG.HG.features.hard===1), k = ST.stars(s, S.id);
  const rewardVersion=HG.available()&&HG.HG.features.hardCollection===1?HARD_REWARD_VERSION:1;
  const extra=collectionCount(S,S.waves,true,!k,rewardVersion);
  const reward = ui.hard ? hardReward(S, S.waves, true, !k, s.hero,undefined,null,rewardVersion) : null;
  info.innerHTML = `<div class="sn">${S.no} · ${S.n}${S.boss ? ' <span class="bossT">챕터 보스</span>' : ''}</div><div class="sd">웨이브 ${S.waves} · 포털 ${S.spawns.length}개 · 몬스터 체력 ×${S.hp}</div><div class="prop" style="--cc:${C.color}"><b>${C.propN}</b> ${C.propD}</div>${S.hint ? `<div class="sd">💡 ${esc(S.hint)}</div>` : ''}<div class="conds">${ST.STAR_D.map((d, i) => `<div class="${i < k ? 'got' : ''}">${i < k ? '★' : '☆'} ${d}</div>`).join('')}</div><div class="rw">영혼석 ${ui.hard?reward.souls:ST.stageReward(S.id, !k)}${ui.hard?' · 장비 상자 '+reward.items.length+'개':k ? ' (재도전)' : ' + 첫 클리어 장비 1개'}</div>${dropHtml(P.dropPreview(S.id, s.hero, s),extra)}${k&&u&&HG.HG.features.repeatTarget===1?targetHtml(S.id):''}<div class="sd">${esc(selectedSummary(s.hero))}</div>${ui.hard&&HG.HG.features.hardParty===1?partnerHtml(s.hero):''}${u ? '<button class="gbtn main bigGo" id="stGo">⚔ 출정!</button>' : `<div class="warn">🔒 ${ui.hard?!hardOpen(s)?'일반 10-6':HG.HG.features.hard!==1?'로그인·하드 서버 연결':'이전 하드 스테이지':ST.chapterUnlocked(s, C.id) ? '이전 스테이지' : '이전 챕터 보스'}를 클리어하면 열려요</div>`}`;
  if ($('stGo')) $('stGo').onclick = () => { closeStageSel(true); hooks.start(S.id); }; bindTips(info, s);
  const partner=$('hardPartner'); if(partner)partner.onchange=()=>{if(!writePartner(s.hero,partner.value)){partner.value=readPartner(s.hero)||'';partner.setCustomValidity('편성을 저장하지 못했습니다.');partner.reportValidity();}else partner.setCustomValidity('');};
  const target=$('repeatTarget');if(target)target.onchange=()=>{if(!writeTarget(S.id,target.value)){target.value=readTarget(S.id)||'';target.setCustomValidity('선택을 저장하지 못했습니다.');target.reportValidity();}else target.setCustomValidity('');};
}
function floaties(ic) { let h = '<div class="floaties">'; for (let i = 0; i < 14; i++) h += `<i style="left:${(i * 37) % 100}%;animation-delay:${-(i * 1.3) % 9}s;animation-duration:${8 + (i % 5)}s;font-size:${14 + (i % 4) * 6}px">${ic[i % ic.length]}</i>`; return h + '</div>'; }


function dropHtml(D, extra=0) {
  if (!D) return ''; const C = D.set, top = D.grades.lastIndexOf(true);
  const chips = [['weapon', weaponIcon(D.hero)], ['armor', iconKey('armor')], ['acc', iconKey('acc')]].map(([sl, ic]) => `<button class="drc" aria-label="${C.n} ${E.SLOTS[sl]} 미리보기" data-tip="set" data-sl="${sl}" data-g="${top}" data-ch="${D.ch}" data-h="${D.hero}">${ic}<i>${C.badge}</i></button>`).join('');
  const dots = D.grades.map((on, g) => `<i class="gd ${on ? 'on' : ''}" style="--gc:${GRADES[g].c}" title="${GRADES[g].n} ${Math.round(D.odds[g] * 1000) / 10}%"></i>`).join('');
  return `<div class="drop" style="--cc:${C.color}"><div class="drRow"><span class="drL">${C.badge} ${C.n} 세트</span><span class="drChips">${chips}</span><span class="drG">${dots}</span></div>${extra?`<div class="drRow">추가 상자 ${extra}개 · ${collectionOdds(D.ch).map((v,g)=>v?GRADES[g].n+' '+v+'%':'').filter(Boolean).join(' · ')}</div>`:''}</div>`;
}
let tipT = 0;
function bindTips(root, s) {
  const html = b => { const it = sampleItem(+b.dataset.ch, b.dataset.sl === 'weapon' ? b.dataset.h : b.dataset.sl, +b.dataset.g); return `<div class="cxUnseen">견본 · 이 스테이지 최고 등급 ${GRADES[+b.dataset.g].n}</div>${card(it)}`; };
  root.querySelectorAll('.drc').forEach(b => { b.onpointerenter = e => { if (e.pointerType === 'mouse') showTip(b, html(b)); }; b.onpointerleave = e => { if (e.pointerType === 'mouse') hideTip(); };
    b.onclick = e => { e.stopPropagation(); showTip(b, html(b)); clearTimeout(tipT); tipT = setTimeout(hideTip, 3200); Snd.play('select'); }; });
}

HG.onGrowth(()=>{if(ui.open)render();});

function targetHtml(id){const selected=readTarget(id)||'';return `<label class=repeatTarget>반복 상자 1개<select id=repeatTarget aria-label="반복 보상 목표 장비">${['',...REPEAT_ROWS].map(row=>`<option value="${row}" ${row===selected?'selected':''}>${esc(targetLabel(row))}</option>`).join('')}</select></label>`;}

function partnerHtml(main){const selected=readPartner(main);return `<label class="repeatTarget">서브 영웅<select id="hardPartner" aria-label="하드 서브 영웅">${partners(main).map(h=>`<option value="${h}" ${h===selected?'selected':''}>${CLASSES[h].icon} ${esc(heroLabel(h))} · Lv.${HG.level(h)}</option>`).join('')}</select></label>`;}
