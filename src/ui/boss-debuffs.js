import { enemySlow } from '../combat/tower-slow.js';
import { SP_AFFIX_BY } from '../data/spire.js';
import { ETYPES } from '../data/monsters.js';

// Read the same remaining timers/flags as enemy AI; never advance or change them here.
export function bossDebuffs(boss, now = 0) {
  if (!boss || boss.dead || boss.dying !== undefined || !boss.E?.boss) return [];
  const effects = [], timed = (id, name, time, detail = '') => {
    if (Number.isFinite(time) && time > 0) effects.push({ id, name, time, detail });
  };
  if (boss.stunT > 0) {
    const liftTime = boss.kup ? Math.min(boss.stunT, boss.kup.dur - boss.kup.t) : 0;
    const lifted = !boss.E.fly && liftTime > 0;
    if (boss.frozen) timed('freeze', '빙결', boss.stunT);
    if (lifted) timed('airborne', '띄우기', liftTime);
    if (!boss.frozen && !lifted) timed('stun', '기절', boss.stunT);
  }
  // AI uses 45% when slowAmt is zero/unset, and pauses slowT during a stun.
  const slow = enemySlow(boss);
  if (Number.isFinite(slow.amount) && slow.amount > 0) timed('slow', '둔화', slow.time, `${Math.round(slow.amount * 100)}%`);
  const burn = boss.hellfireBurn;
  if (burn) timed('hellfire', '업화 화상', burn.until-now, `초당 ${Math.round(burn.dps)} 피해(방어 적용 전)`);
  const crack = boss.E.ab?.crack;
  if (boss.cracked && crack && boss.armor < crack.armor) {
    effects.push({ id: 'crack', name: '갑옷 파괴', time: crack.regen > 0 && boss.regenT > 0 ? boss.regenT : null, detail: '' });
  }
  if (boss.E.shieldDef) timed('exposed', '방패 해제', boss.guardOpenT);
  // Chapter bosses also lower armor during their own recovery window.
  for (const [family, timer, awakened] of [['storm', 'stormRecover', 'stormAwakened'], ['machine', 'machineRecover', 'machineAwakened'], ['endgame', 'endRecover', 'endAwakened']]) {
    const rule = boss.E[family], normalArmor = boss[awakened] ? rule?.phase?.armor : boss.E.armor;
    if (rule?.exposed && boss.armor < normalArmor) timed('vulnerable', '약점 노출', boss[timer]);
  }
  if (boss.swampRuptured && boss.E.swamp?.rupture && boss.armor < boss.E.armor) {
    effects.push({ id: 'rupture', name: '외피 파괴', time: null, detail: '' });
  }
  return effects;
}

export function bossBuffs(boss, now = 0, context = {}) {
  if (!boss || boss.dead || boss.dying !== undefined || !boss.E?.boss) return [];
  const out=[], E=boss.E, A=E.ab||{}, pct=n=>Math.round(n*1000)/10;
  const add=(id,name,detail='',time=null)=>out.push({id,name,time,detail,kind:'buff'});
  // Absorption consumes shield itself. A stale duration is not evidence of a shield.
  if(boss.shield>0)add('shield',boss.shDark?'어둠 보호막':'보호막',`${Math.ceil(boss.shield)}`,boss.shieldT>0?boss.shieldT:null);
  if(boss.immT>now)add('immune',boss.phaseT>0?'실체 소멸':'무적','',boss.immT-now);
  if(boss.enraged&&A.enrage)add('enrage','분노',`이속 +${pct(A.enrage.spd-1)}%`);
  if(boss.phase2&&A.dread)add('dread','어둠 각성','기술 강화');
  for(const [family,flag] of [['desert','desertAwakened'],['storm','stormAwakened'],['machine','machineAwakened'],['endgame','endAwakened']])
    if(boss[flag]&&E[family]?.phase)add('awaken','각성','기술 강화');
  if(E.dgBoss&&boss.bz?.phase===2)add('dungeon-rage','분노','기술 강화');
  if(boss.packOn&&A.pack)add('pack','무리 강화',`피해 −${pct(A.pack.red)}%`);
  if(A.crack&&!boss.cracked&&boss.armor>0)add('ice-armor','빙결 갑옷',`피해 −${pct(boss.armor)}%`);
  if(E.shieldDef&&!(boss.guardOpenT>0))add('guard','방패 방어','정면·측면');
  const aff=context.floor?.affixes||[], base=ETYPES[boss.type];
  if(aff.includes('haste')&&base&&E.spd>base.spd)add('spire-haste','가속',`이속 +${pct(E.spd/base.spd-1)}%`);
  const armor=boss.armor??E.armor??0;
  if(aff.includes('armor')&&base&&armor===E.armor&&armor>(base.armor||0))add('spire-armor','철갑',`방어 +${pct(armor-(base.armor||0))}%p`);
  if(aff.includes('regen')&&boss.hp>0&&boss.hp<boss.max)add('spire-regen','재생',`회복 ${pct(SP_AFFIX_BY.regen.regen)}%/초`);
  if(context.attackScale>1)add('spire-frenzy','광폭',`공격 +${pct(context.attackScale-1)}%`);
  return out;
}

const duration = time => Number.isFinite(time) && time > 0 ? `${(Math.max(1, Math.ceil(time * 10 - 1e-8)) / 10).toFixed(1)}초` : '';
const views = new WeakMap();
export function renderBossDebuffs(container, boss, now = 0, context = {}) {
  if (!container) return; // A cached older HTML document must still keep playing.
  let view = views.get(container);
  if (!view) { view = { boss: null, nodes: new Map() }; views.set(container, view); }
  if (view.boss !== boss) { container.replaceChildren(); view.nodes.clear(); view.boss = boss; }
  const effects = [...bossBuffs(boss,now,context),...bossDebuffs(boss,now)], active = new Set(effects.map(effect => effect.id));
  for (const [id, node] of view.nodes) if (!active.has(id)) { node.remove(); view.nodes.delete(id); }
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]; let node = view.nodes.get(effect.id);
    if (!node) {
      node = container.ownerDocument.createElement('span'); node.className = `bossDebuff ${effect.id}${effect.kind==='buff'?' buff':''}`;
      node.dataset.effect = effect.id; view.nodes.set(effect.id, node);
    }
    const label = [effect.kind==='buff'?'↑':'',effect.name, effect.detail, duration(effect.time)].filter(Boolean).join(' ');
    if (node.textContent !== label) node.textContent = label;
    if (container.children[i] !== node) container.insertBefore(node, container.children[i] || null);
  }
  container.hidden = effects.length === 0;
}
