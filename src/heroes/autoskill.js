// AUTO는 조작 영웅의 Q와 영웅 Lv.10 E를 각각의 쿨타임과 공격 범위에 맞춰 사용한다.
// 설정: localStorage hd3d_live_autoSkill='1' (기본 off → 회귀·시드 테스트 영향 없음). 전투 HUD AUTO 버튼(#autoSkillBtn) · Z 키 · 메뉴 ⚙(#stAutoSkill) / 전투 ⚙(#sndAutoSkill) 칸이 같은 값
// 판단 = core/autoskill.js (순수). 일반 스테이지 + 던전·무한의 탑의 조작 영웅. 조작하지 않는 파티원은 원래대로 파티 AI(dungeon/run.js partyAI)가 씀. 마을·선택·결과 화면에선 안 씀
import * as THREE from 'three';
import { $ } from '../core/util.js';
import { G } from '../core/state.js';
import { hero, stat } from './hero.js';
import { castSkill } from './skills.js';
import { castLegend, legendActive, heroEKey } from './legend.js';
import { banner } from '../ui/hud.js';
import { typing } from '../ui/keys.js';
import { skillShape, legendShape, autoTarget, skillBusy, AS_TICK } from '../core/autoskill.js';
const KEY = 'hd3d_live_autoSkill';
const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
export const autoSkillOn = () => LS(KEY) === '1';
const CBS = ['stAutoSkill', 'sndAutoSkill'];
function sync() { const on = !!G.autoSkill, b = $('autoSkillBtn');
  if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); const s = b.querySelector('.asSt'); if (s) s.textContent = on ? 'ON' : 'OFF'; b.title = `스킬 자동 사용 ${on ? '켜짐' : '꺼짐'} (Z)`; }
  for (const id of CBS) { const c = $(id); if (c) c.checked = on; } }
export function setAutoSkill(on, quiet = false) { G.autoSkill = !!on; LS(KEY, on ? '1' : '0'); G.autoSkillT = 0; sync();
  if (!quiet && G.Snd) G.Snd.play('ui'); if (!quiet) banner(on ? '⚡ 스킬 자동 사용 켜짐' : '스킬 자동 사용 꺼짐', on ? '#8affc0' : '#c8c0d8', 900); }
const inBattle = () => (G.phase === 'wave' || G.phase === 'build') && G.screen !== 'town';
// 매 스텝 (main.js step). 결정적: 게임 시간(dt)만 씀 · 난수 없음
export function updAutoSkill(dt) {
  if (!G.autoSkill || G.paused || !inBattle() || (G.dungeon && (G.dg?.auto || G.dg?.blessing))) return; const h = G.hero; if (!h || h !== hero) return;
  G.autoSkillT = (G.autoSkillT || 0) - dt; if (G.autoSkillT > 0) return; G.autoSkillT = AS_TICK;
  useAutoSkill(h);
}
// Called in the corresponding hero context, also by dungeon all-auto party AI.
export function useAutoSkill(h, { enemies, allowCast, priorityTarget } = {}) {
  if (!h || h !== hero || G.paused || !inBattle() || G.dg?.blessing) return;
  if (h.dead > 0 || h.warpT > 0 || skillBusy(h) || h.autoSkillUntil > G.t) return;
  const En = enemies ?? G.enemies.filter(e => !e.dead && e.dying === undefined && !(e.immT > G.t) && e.state !== 'spawn'); if (!En.length) return;
  const p = h.g.position, self = { x: p.x, z: p.z, dmg: stat.dmg() };
  const targets = En.map(e => ({ x: e.g.position.x, z: e.g.position.z, hp: e.hp, max: e.max, boss: !!e.E.boss, elite: !!e.E.elite, fly: !!e.E.fly }));
  const priority = priorityTarget ? targets[En.indexOf(priorityTarget)] : null;
  const aim = (key, skill, shape) => {
    if (!shape) return null;
    const accept = t => t && (!allowCast || allowCast(key, skill, t));
    if (priority && (!shape.ground || !priority.fly)) {
      const d = Math.hypot(priority.x - self.x, priority.z - self.z);
      const within = shape.kind === 'self' ? d <= shape.r : d <= shape.reach && (shape.kind !== 'line' || d > .3);
      if (within) {
        const at = shape.kind === 'self' ? self : priority;
        const t = { x: at.x, z: at.z, why: 'core', n: 1 };
        if (accept(t)) return t;
      }
    }
    const t = autoTarget(shape, self, targets);
    return accept(t) ? t : null;
  };
  const record = (key, skill, t) => { G.autoSkillN = (G.autoSkillN || 0) + 1; G.autoSkillLast = { key, cls: h.cls, skill: skill || null, why: t.why, n: t.n, x: t.x, z: t.z, t: G.t }; };
  if (!(h.skillCd > 0)) {
    const skill = h.adv && h.adv.skill, t = aim('Q', skill, skillShape(h.cls, skill, stat.range()));
    if (t) { const cd0 = h.skillCd; castSkill(new THREE.Vector3(t.x, 0, t.z));
      if (h.skillCd > cd0) { record('Q', skill, t); return; } }
  }
  const active=legendActive(), shape = active && !(h.lcd > 0) && legendShape(active.kind?active:heroEKey());
  const t = aim('E', active, shape);
  if (t && castLegend(new THREE.Vector3(t.x, 0, t.z))) record('E', heroEKey(), t);
}
// ---- UI: HUD 버튼 · Z 키 · 설정 칸 ----
G.autoSkill = autoSkillOn(); G.setAutoSkill = setAutoSkill;
if (typeof document !== 'undefined') {
  const b = $('autoSkillBtn'); if (b) b.onclick = e => { e.stopPropagation(); setAutoSkill(!G.autoSkill); b.blur(); };
  for (const id of CBS) { const c = $(id); if (c) c.addEventListener('change', () => setAutoSkill(c.checked, true)); }
  addEventListener('keydown', e => { if (e.repeat || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return; if ((e.key === 'z' || e.key === 'Z') && inBattle()) setAutoSkill(!G.autoSkill); });
  sync();
}
