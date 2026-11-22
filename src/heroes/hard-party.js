import * as THREE from 'three';
import { G } from '../core/state.js';
import { $, esc } from '../core/util.js';
import { CORE, tileX, tileZ } from '../core/grid.js';
import { CLASSES, heroLabel } from '../data/heroes.js';
import { dungeonRole } from '../data/dungeon.js';
import { FT, TQ, isRangedFoe } from '../data/fighter.js';
import { clearOrders, setHold } from '../data/hard-party.js';
import { rolePlan } from '../dungeon/logic.js';
import { skillBusy } from '../core/autoskill.js';
import { useAutoSkill } from './autoskill.js';
import { heroGoTo, spawnHero, setControlled, stat } from './hero.js';
import { ensureModels, heroAssets, loadModel, MON_ASSETS } from '../render/characters.js';
import { advModels } from '../data/advance.js';
import { resetControlInput } from '../ui/input.js';
import { refreshHud } from '../ui/hud.js';
import { typing, openLayers } from '../ui/keys.js';
import { cam } from '../render/scene.js';
import { stageAutoOwnsHardPair } from '../ui/stage-auto-combat.js';

const active = () => !!G.hardParty && (!!G.stage?.hard || !!G.practice) && G.heroes.length === 2;
const battle = () => active() && ['build', 'wave'].includes(G.phase) && !G.paused && !G.navigating;
const pos = h => ({ x: h.g.position.x, z: h.g.position.z });
const goal = new THREE.Vector3();
export async function prepareHardParty(run) {
  if (!run?.party || run.party.length !== 2 || !run.loadouts) return;
  const need = [...MON_ASSETS, ...run.party.flatMap(h => heroAssets(h, true))];
  await ensureModels(need);
  for (const h of run.party) for (const model of advModels(run.loadouts[h].adv)) await loadModel(model).catch(() => { G.advModelFail = true; });
}
export function startHardParty(run) {
  if ((!G.stage?.hard && !G.practice) || !run?.party || run.party.length !== 2 || G.hardParty || G.heroes.length !== 1 || G.hero?.cls !== run.party[0]) return false;
  const main = G.hero, sub = spawnHero(run.party[1], run.loadouts[run.party[1]], true);
  sub.g.position.set(tileX(CORE[0] - 1), 0, tileZ(CORE[1]) + 1.4);
  for (const h of G.heroes) { h.hardHold = false; clearOrders(h); }
  G.hardParty = { roster: run.party.slice(), focusCamera: .5, hudT: 0 };
  G.partyAI = supportAI; setControlled(main); buildBar(); refreshHud(); return true;
}
function supportAI(h, dt) {
  if (!battle() || stageAutoOwnsHardPair()) return;
  runSupportAI(h, dt);
}
export function runSupportAI(h, dt) {
  if (h.dead > 0) return;
  h.aiT = (h.aiT || 0) - dt; if (h.aiT > 0) return; h.aiT = .3;
  const enemies = G.enemies.filter(e => !e.dead && e.dying === undefined && !(e.immT > G.t) && e.state !== 'spawn');
  if (!h.hardHold && !skillBusy(h) && !(h.warpT > 0)) {
    const role = dungeonRole(h.cls, h.adv), dragon = h.cls === 'fighter' && h.adv?.k === 'dragon';
    const allies = G.heroes.filter(x => x !== h && x.dead <= 0), tank = allies.find(x => dungeonRole(x.cls, x.adv) === 'tank');
    const lead = allies.includes(G.hero) ? G.hero : allies[0];
    const plan = rolePlan(role, { ...pos(h), range: dragon ? FT.jpRange : stat.range(), minRange: dragon ? Math.min(FT.jpRange * .7, Math.max(4, stat.range() + 1.2)) : undefined, jp: FT.jpRange, qSelf: h.adv?.skill === 'tigerquake' ? TQ.R * .85 : 0, skillReady: h.skillCd <= 0 }, { lead: lead ? pos(lead) : null, tank: tank ? pos(tank) : null, enemies: enemies.map(e => ({ ...pos(e), r: isRangedFoe(e.E), fly: !!e.E.fly })), backs: allies.map(pos) });
    h.aiTgt = plan.focus == null ? null : enemies[plan.focus];
    if (plan.move) {
      if (!h.aiGoal || Math.hypot(h.aiGoal.x - plan.move.x, h.aiGoal.z - plan.move.z) > 1.2 || !h.path.length) { heroGoTo(goal.set(plan.move.x, 0, plan.move.z)); h.aiGoal = plan.move; }
    } else { h.path = []; h.aiGoal = null; }
  } else if (h.hardHold) clearOrders(h);
  useAutoSkill(h);
}
export function switchHardHero(index) {
  if (!battle()) return false;
  const next = G.heroes[index]; if (!next || next.dead > 0 || next === G.hero) return false;
  clearOrders(G.hero); clearOrders(next); resetControlInput(next); setControlled(next);
  G.hardParty.focusCamera = .5; renderBar(); refreshHud(); return true;
}
export function toggleHardHold(index) {
  if (!battle()) return false;
  const h = G.heroes[index]; if (!h || h.dead > 0) return false;
  setHold(h, !h.hardHold);
  if(h.hardHold && h.warpT>0){h.warpT=0;if(h.warpFx)h.warpFx.visible=false;}
  if (h === G.hero) resetControlInput(); renderBar(); return true;
}
function buildBar() {
  let bar = $('hardPartyBar'); if (!bar) { bar = document.createElement('div'); bar.id = 'hardPartyBar'; $('hud').appendChild(bar); }
  bar.innerHTML = G.heroes.map((h, i) => `<div class="hpMember"><button type="button" data-pick="${i}" aria-label="${esc(heroLabel(h.cls))} 조종"><b>${CLASSES[h.cls].icon} ${esc(CLASSES[h.cls].nm)}</b><small></small><span class="hpLife"><i></i></span></button><button type="button" data-hold="${i}" aria-label="${esc(heroLabel(h.cls))} 홀드">홀드</button></div>`).join('');
  bar.onpointerdown = e => e.stopPropagation();
  bar.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); if (b.dataset.pick != null) switchHardHero(+b.dataset.pick); else toggleHardHold(+b.dataset.hold); b.blur(); };
  renderBar();
}
function renderBar() {
  const bar = $('hardPartyBar'); if (!bar) return;
  bar.hidden = !active() || !['build', 'wave'].includes(G.phase);
  for (const [i, h] of G.heroes.entries()) {
    const b = bar.querySelector(`[data-pick="${i}"]`), hold = bar.querySelector(`[data-hold="${i}"]`); if (!b || !hold) continue;
    b.classList.toggle('selected', h === G.hero); b.setAttribute('aria-pressed', String(h === G.hero)); b.disabled = h.dead > 0 || !battle();
    b.querySelector('small').textContent = h.dead > 0 ? `부활 ${Math.ceil(h.dead)}초` : h.hardHold ? '홀드' : h === G.hero ? '조종 중' : '자동 전투';
    b.querySelector('i').style.width = Math.max(0, Math.min(1, h.hp / h.max)) * 100 + '%';
    hold.textContent = h.hardHold ? '해제' : '홀드'; hold.setAttribute('aria-pressed', String(h.hardHold)); hold.disabled = h.dead > 0 || !battle();
  }
}
export function updateHardParty(dt) {
  if (!active()) return;
  if (battle() && G.hero.dead > 0) { const next = G.heroes.findIndex(h => h.dead <= 0); if (next >= 0) switchHardHero(next); }
  if (G.hardParty.focusCamera > 0) { G.hardParty.focusCamera -= dt; const p = G.hero.g.position; cam.target.lerp(goal.set(p.x * .4, 0, p.z * .4 + 1), Math.min(1, dt * 10)); }
  G.hardParty.hudT -= dt; if (G.hardParty.hudT <= 0) { G.hardParty.hudT = .15; renderBar(); }
}
addEventListener('keydown', e => {
  if (!battle() || openLayers().length || typing(e) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'v') { e.preventDefault(); switchHardHero(G.heroes.indexOf(G.hero) === 0 ? 1 : 0); }
  if (k === 'b') { e.preventDefault(); toggleHardHold(G.heroes.indexOf(G.hero)); }
});
