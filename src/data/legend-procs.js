// New automatic effects use bounded target selection; damage and VFX stay in the runtime.
export function procTargets(s, target, enemies, now, attack) {
  const ground = s.ground || (s.h === 'fighter' && attack?.mode !== 'ranged');
  const valid = e => e && !e.dead && e.dying === undefined && !(e.immT > now) && (!ground || !e.E.fly);
  if (!s.max || !enemies.includes(target) || !valid(target)) return [];
  const pos = target.g.position, dist = e => (e.g.position.x-pos.x)**2 + (e.g.position.z-pos.z)**2;
  return [target, ...enemies.filter(e => e !== target && valid(e) && dist(e) <= (s.radius || 0)**2).sort((a,b) => dist(a)-dist(b))].slice(0,s.max);
}
