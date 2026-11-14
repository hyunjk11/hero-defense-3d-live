// Read the same remaining timers/flags as enemy AI; never advance or change them here.
export function bossDebuffs(boss) {
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
  const slow = boss.slowAmt || .45;
  if (Number.isFinite(slow) && slow > 0) timed('slow', '둔화', boss.slowT, `${Math.round(slow * 100)}%`);
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

const duration = time => Number.isFinite(time) && time > 0 ? `${(Math.max(1, Math.ceil(time * 10 - 1e-8)) / 10).toFixed(1)}초` : '';
const views = new WeakMap();
export function renderBossDebuffs(container, boss) {
  if (!container) return; // A cached older HTML document must still keep playing.
  let view = views.get(container);
  if (!view) { view = { boss: null, nodes: new Map() }; views.set(container, view); }
  if (view.boss !== boss) { container.replaceChildren(); view.nodes.clear(); view.boss = boss; }
  const effects = bossDebuffs(boss), active = new Set(effects.map(effect => effect.id));
  for (const [id, node] of view.nodes) if (!active.has(id)) { node.remove(); view.nodes.delete(id); }
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]; let node = view.nodes.get(effect.id);
    if (!node) {
      node = container.ownerDocument.createElement('span'); node.className = `bossDebuff ${effect.id}`;
      node.dataset.effect = effect.id; view.nodes.set(effect.id, node);
    }
    const label = [effect.name, effect.detail, duration(effect.time)].filter(Boolean).join(' ');
    if (node.textContent !== label) node.textContent = label;
    if (container.children[i] !== node) container.insertBefore(node, container.children[i] || null);
  }
  container.hidden = effects.length === 0;
}
