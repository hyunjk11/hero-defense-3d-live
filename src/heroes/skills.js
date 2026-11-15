import { qFeedback } from '../render/q-feedback.js';
import { skillAllowed } from '../data/hard-party.js';
import { treeQBonus, treeSkillUsed } from '../data/skill-tree.js';
import { Snd } from '../audio/audio.js';
import * as THREE from 'three';
import { rand } from '../core/util.js';
import { G, later, asSkill } from '../core/state.js';
import { scene } from '../render/scene.js';
import { glow } from '../render/toon.js';
import { ringFx } from '../render/vfx.js';
import { play } from '../render/characters.js';
import { makeArrow } from '../combat/projectiles.js';
import { hero, stat } from './hero.js';
import { banner } from '../ui/hud.js';
import { mouseGround } from '../ui/input.js';
import { gunSkill } from './gunner.js';
import { mechTransform } from './mechanic.js';
import { fighterSkill } from './fighter.js';
import { advSkill } from './advfx.js';

// ================= 스킬 =================
function castSkill(at) {
  if (!skillAllowed(hero, 'Q')) return;
  const cd = hero && hero.skillCd, result = asSkill(castSkill0, at);
  if (hero && hero.skillCd > cd) {
    // Visual hold only: basic attacks, cooldowns and movement keep their original timing.
    const k=hero.adv?.skill;
    hero.qPoseT=((!k&&(hero.cls==='archer'||hero.cls==='mage'))||['storm','snipe','meteors','glacier','sanct'].includes(k))?Math.max(0,hero.atkT||0):0;
    hero.qPoseTerrain=G.tiles;
    hero.autoSkillUntil = G.t + Math.max(.8, hero.atkT || 0);treeSkillUsed(hero,'q',G.t);const target=(at&&at.isVector3?at:mouseGround).clone(),p=hero.g.position;if(target.distanceTo(p)>16)target.sub(p).setLength(16).add(p);qFeedback(hero,target);}
  return result;
} // 피해 미터: 스킬 피해로 집계. AUTO가 다음 스킬로 시전 동작을 끊지 않게 한다.
function castSkill0(at) { // at: 목표 지점(Vector3, 던전 AI). 없으면(키·버튼) 마우스 지점
  if (!hero || hero.dead > 0 || hero.skillCd > 0 || hero.eCastT > 0 || G.phase === 'select' || G.phase === 'over') return;
  hero.skillFocus = G.focus || 0;
  const mul = stat.skillMul()*(hero.treeMods?.qMul||1)*treeQBonus(hero,G.t), base = stat.dmg();
  if (hero.cls === 'mechanic') { if (mechTransform(mul, base)) { hero.skillCd = stat.skillCd(); } return; } // 메카닉: 변신 (이미 로봇이면 무시)
  if (hero.cls === 'fighter') { const t = at && at.isVector3 ? at : mouseGround.lengthSq() > 0 ? mouseGround : null; if (fighterSkill(t, mul)) { hero.skillCd = stat.skillCd(); } return; } // 격투가: 냥냥 진각 (도약 내려찍기)
  hero.skillCd = stat.skillCd();
  const tgt = (at && at.isVector3 ? at : mouseGround).clone(); const hp = hero.g.position; if (hp.distanceTo(tgt) > 16) tgt.sub(hp).setLength(16).add(hp);
  if (hero.cls !== 'warrior') hero.face = Math.atan2(tgt.x - hp.x, tgt.z - hp.z);
  if (hero.adv && advSkill(tgt, mul, base)) { return; } // 전직 Q 변형 (advfx.js)
  if (hero.cls === 'archer') {
    ringFx(tgt, 4.2, 0x6aff8a, 1.4); banner('화살비!', '#8aff9a', 900); play(hero.ch, hero.ch.acts.Ranged_Skill ? 'Ranged_Skill' : '2H_Ranged_Shoot', { once: true, force: true, speed: 1.2 }); hero.atkT = .6;
    for (let i = 0; i < 36; i++) later(i * .038, () => { const a = rand() * 6.28, rr = Math.sqrt(rand()) * 4, p = new THREE.Vector3(tgt.x + Math.cos(a) * rr, 18, tgt.z + Math.sin(a) * rr);
      const m = makeArrow(0x9affb0); m.position.copy(p); m.rotation.x = Math.PI / 2; scene.add(m); G.projs.push({ h:G.curHero, mk:1, kind: 'rain', m, dest: p.clone().setY(0), dmg: base * 1.3 * mul, spd: 40 }); });
  } else if (hero.cls === 'mage') {
    ringFx(tgt, 4.8, 0xff6a2a, .9); banner('메테오!', '#ffaa5a', 900); play(hero.ch, 'Spellcast_Long', { once: true, force: true, speed: 1.4 }); hero.atkT = 1;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), glow(0xff6a1a, 5)); m.position.set(tgt.x - 8, 26, tgt.z - 4); scene.add(m);
    G.projs.push({ h:G.curHero, mk:1, kind: 'meteor', m, dest: tgt.clone(), dmg: base * 16 * mul, spd: 30 });
  } else if (hero.cls === 'gunner') { gunSkill(mul, base);
  } else {
    hero.spinT = 2.5; banner('회오리 베기!', '#ffaa7a', 900); play(hero.ch, '2H_Melee_Attack_Spinning', { speed: 1.3 });
    if (!hero.swirl) { hero.swirl = new THREE.Mesh(new THREE.TorusGeometry(2.8, .25, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); hero.swirl.rotation.x = Math.PI / 2; hero.swirl.position.y = 1.2; hero.g.add(hero.swirl); }
    hero.swirl.visible = true; hero.spinTick = 0;
  }
  if (hero.cls === 'archer') { Snd.play('draw', { pos: hp }); Snd.whoosh(tgt, .9, 300, 3000, .35); for (let k = 1; k < 7; k++) Snd.play('arrow', { pos: tgt, delay: k * .12, force: true, vol: .7 }); }
  else if (hero.cls === 'mage') { Snd.play('meteorCast', { pos: hp, rate: .8 }); Snd.whoosh(tgt, 1.1, 150, 900, .5); }
  else if (hero.cls !== 'gunner') { Snd.whoosh(hp, .5, 400, 1600, .5); for (let k = 0; k < 4; k++) Snd.play('sword', { pos: hp, delay: k * .3, force: true, rate: 1.1 }); }

}

export { castSkill };
