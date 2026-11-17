// Shared enemy-side leases prevent multiple towers/soldiers from chaining an infinite block.
export function canGuard(e, now) {
  return !e.dead && !e.E.fly && e.state !== 'spawn' && !(e.immT > now) &&
    !(e.guardUntil > now) && !(e.guardImmuneUntil > now) &&
    (e.guardTotal || 0) < (e.E.boss ? .6 : 8);
}
export function acquireGuard(e, soldier, now, stats) {
  if (!canGuard(e, now)) return false;
  const duration = Math.min(e.E.boss ? stats.bossBlockTime : stats.blockTime,
    (e.E.boss ? .6 : 8) - (e.guardTotal || 0));
  e.guardTotal = (e.guardTotal || 0) + duration;
  e.guardUntil = now + duration;
  e.guardImmuneUntil = e.guardUntil + Math.max(5, stats.blockCooldown || 5);
  e.guardSoldier = soldier;
  return true;
}
export function releaseGuard(e, soldier) {
  if (e?.guardSoldier === soldier) { e.guardSoldier = null; e.guardUntil = 0; }
}
export function activeGuard(e, now) {
  const s = e.guardSoldier;
  return s && s.hp > 0 && !s.tw.dead && now < e.guardUntil && !e.dead && !e.E.fly ? s : null;
}
// Enemy specials/cast timers execute before this hook; it replaces only ordinary movement.
export function guardCombat(e, now, dt, damageScale = 1) {
  const s = activeGuard(e, now); if (!s) return null;
  const dx = s.m.g.position.x - e.g.position.x, dz = s.m.g.position.z - e.g.position.z;
  if (dx * dx + dz * dz > 2.8 * 2.8) { releaseGuard(e, s); return null; }
  s.hp = Math.max(0, s.hp - Math.max(0, e.E.dps || 0) * dt * damageScale);
  s.hit = .16; s.support = (s.support || 0) + dt;
  return s;
}
