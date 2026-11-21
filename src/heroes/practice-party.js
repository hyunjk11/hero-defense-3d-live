import * as THREE from 'three';
import { G } from '../core/state.js';
import { $, esc } from '../core/util.js';
import { CLASSES, VISIBLE_HEROES, heroLabel } from '../data/heroes.js';
import { advModels } from '../data/advance.js';
import { clearOrders } from '../data/hard-party.js';
import { ensureModels, heroAssets, loadModel, MON_ASSETS } from '../render/characters.js';
import { cam } from '../render/scene.js';
import { typing, openLayers } from '../ui/keys.js';
import { resetControlInput } from '../ui/input.js';
import { refreshHud } from '../ui/hud.js';
import { runSupportAI } from './hard-party.js';
import { passAt, setControlled, spawnHero } from './hero.js';

const sandbox = () => G.practice === true && G.practiceSandbox === true;
const active = () => sandbox() && !!G.practiceParty;
const battle = () => active() && (G.phase === 'build' || G.phase === 'wave') && !G.paused && !G.navigating;
const cameraGoal = new THREE.Vector3();
const offsets = [[0,-1.4],[0,1.4],[-1.4,0],[1.4,0],[-1.4,-1.4],[-1.4,1.4],[1.4,-1.4],[1.4,1.4]];
function valid(run) {
  const party = run?.party;
  return Array.isArray(party) && party.length === VISIBLE_HEROES.length && new Set(party).size === party.length &&
    party.every(cls => VISIBLE_HEROES.includes(cls) && run.loadouts?.[cls] && typeof run.loadouts[cls] === 'object');
}
export async function preparePracticeParty(run) {
  if (!sandbox() || !valid(run)) return false;
  await ensureModels([...MON_ASSETS, ...run.party.flatMap(cls => heroAssets(cls, true))]);
  const models = new Set(run.party.flatMap(cls => advModels(run.loadouts[cls].adv)));
  await Promise.all([...models].map(key => loadModel(key).catch(() => { G.advModelFail = true; })));
  return sandbox();
}
const supportAI = (h, dt) => { if (battle() && G.practiceParty.assist) runSupportAI(h, dt); };
export function initPracticeParty(run) {
  if (!sandbox() || !valid(run) || G.hardParty || G.heroes.length !== 1 || G.hero?.cls !== run.party[0] || G.phase !== 'build') return false;
  if (G.practiceParty) return false;
  const main = G.hero, pos = main.g.position;
  // Use only walkable positions near the selected lead. Spawn with each hero's
  // snapshot rather than modifying the selected hero's shared loadout.
  const places = offsets.filter(([x,z]) => passAt(pos.x + x,pos.z + z));
  for (const [index, cls] of run.party.slice(1).entries()) {
    const h = spawnHero(cls, run.loadouts[cls], true);
    const [x,z] = places[index] || [0,0];
    h.g.position.set(pos.x+x,pos.y,pos.z+z);
  }
  G.practiceParty = { hudT: 0, focus: 0, assist: false, basic: true };
  G.partyAI = supportAI; setControlled(main); buildBar(); refreshHud(); return true;
}
export function clearPracticeParty() {
  if (!G.practiceParty) return;
  G.practiceParty = null;
  if (G.partyAI === supportAI) G.partyAI = null;
  const bar = $('practicePartyBar'); if (bar) bar.hidden = true;
}
export function switchPracticeHero(index) {
  if (!battle()) return false;
  const next = G.heroes[index]; if (!next || next === G.hero || next.dead > 0) return false;
  clearOrders(G.hero); clearOrders(next); resetControlInput(next); setControlled(next);
  G.practiceParty.focus = .5; renderBar(); refreshHud(); return true;
}
function cycle() {
  const current = G.heroes.indexOf(G.hero);
  for (let i = 1; i < G.heroes.length; i++) if (switchPracticeHero((current + i) % G.heroes.length)) return true;
  return false;
}
export function togglePracticeAssist() {
  if (!battle()) return false;
  const party = G.practiceParty;
  party.assist = !party.assist;
  for (const h of G.heroes) if (h !== G.hero) clearOrders(h);
  renderBar(); return true;
}
function togglePracticeBasic() {
  if (!battle()) return;
  G.practiceParty.basic = !G.practiceParty.basic;
  renderBar();
}
function buildBar() {
  let bar = $('practicePartyBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'practicePartyBar'; $('hud').appendChild(bar); }
  bar.innerHTML = G.heroes.map((h, i) => `<div class="hpMember"><button type="button" data-pick="${i}" title="${esc(heroLabel(h.cls))}" aria-label="${esc(heroLabel(h.cls))} 조종"><b aria-hidden="true">${CLASSES[h.cls].icon}</b><span class="hpLife" aria-hidden="true"><i></i></span></button></div>`).join('') + '<div class="hpMember"><button type="button" data-assist aria-label="파티 자동 전투" title="파티 자동 전투"><b aria-hidden="true">⚔</b></button></div><div class="hpMember"><button type="button" data-basic aria-label="조작 영웅 기본 공격" title="조작 영웅 기본 공격"><b aria-hidden="true">◎</b></button></div>';
  bar.onpointerdown = e => e.stopPropagation();
  bar.onclick = e => { const btn = e.target.closest('button'); if (!btn) return; e.stopPropagation(); if (btn.dataset.basic !== undefined) togglePracticeBasic(); else if (btn.dataset.assist !== undefined) togglePracticeAssist(); else switchPracticeHero(+btn.dataset.pick); };
  renderBar();
}
function renderBar() {
  const bar = $('practicePartyBar'); if (!bar) return;
  bar.hidden = !active() || (G.phase !== 'build' && G.phase !== 'wave');
  const assist = bar.querySelector('[data-assist]');
  if (assist) { const on = !!G.practiceParty?.assist; assist.classList.toggle('selected', on);
    assist.setAttribute('aria-pressed', String(on)); assist.disabled = !battle(); }
  const basic = bar.querySelector('[data-basic]');
  if (basic) { const on = G.practiceParty?.basic !== false; basic.classList.toggle('selected', on);
    basic.setAttribute('aria-pressed', String(on)); basic.disabled = !battle(); }
  G.heroes.forEach((h,i) => { const btn = bar.querySelector(`[data-pick="${i}"]`); if (!btn) return;
    const current = h === G.hero;
    btn.classList.toggle('selected', current); btn.setAttribute('aria-pressed', String(current)); btn.disabled = !battle() || h.dead > 0;
    btn.querySelector('i').style.width = Math.max(0,Math.min(1,h.hp/h.max))*100+'%';
  });
}
export function updatePracticeParty(dt) {
  if (!active()) return;
  if (battle() && G.hero.dead > 0) cycle();
  const party = G.practiceParty;
  if (party.focus > 0) {
    party.focus -= dt; const p = G.hero.g.position;
    cam.target.lerp(cameraGoal.set(p.x*.4,0,p.z*.4+1),Math.min(1,dt*10));
  }
  party.hudT -= dt; if (party.hudT <= 0) { party.hudT = .15; renderBar(); }
}
addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'v' || !battle() || openLayers().length || typing(e) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault(); cycle();
});
