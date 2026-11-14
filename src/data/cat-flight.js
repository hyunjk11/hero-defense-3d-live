import { DW, steer } from './fighter.js';

// One bounded flight: the original three bolts x three pierces = nine strikes.
// Each target gets at most one three-swipe combo. Dead/escaped targets cannot
// restart their combo, and following another target cannot add travel distance.
const alive = e => !e.dead && e.dying === undefined;
export function catFlight(origin, direction, spec) {
  return { x: origin.x, z: origin.z, dx: direction.x, dz: direction.z,
    distance: 0, time: 0, hit: new Set(), target: null, seek: null,
    attackTime: 0, swipes: 0, strikes: 0, pulse: 0, done: false,
    reach: spec.reach * (spec.reachMul || 1), width: spec.width * (spec.radius || 1),
    budget: spec.pierce * spec.ticks, ticks: spec.ticks, interval: spec.interval };
}
export function stepCatFlight(f, dt, enemies, now, hit) {
  const valid = e => !!e && enemies.includes(e) && alive(e) && !(e.immT > now);
  const near = e => Math.hypot(e.g.position.x - f.x, e.g.position.z - f.z) <= f.width + 1e-8;
  const pick = () => {
    let best = null, distance = DW.seek * DW.seek;
    for (const e of enemies) {
      if (!valid(e) || f.hit.has(e)) continue;
      const x = e.g.position.x - f.x, z = e.g.position.z - f.z, d = x*x + z*z;
      if (d >= distance || x*f.dx + z*f.dz < DW.cone * Math.sqrt(d)) continue;
      distance = d; best = e;
    }
    return best;
  };
  const swipe = () => { f.swipes++; f.strikes++; f.pulse = 1; if (valid(f.target) && near(f.target)) hit(f.target); };
  // Fixed upper step keeps curved swept collision and combo timing stable at low FPS.
  let left = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  while (left > 1e-9 && !f.done) {
    const h = Math.min(left, 1/120); left -= h; f.time += h; f.pulse = Math.max(0, f.pulse-h*7);
    if (f.target) {
      f.attackTime += h;
      // Stay alongside a normally walking target while swiping. This movement
      // consumes the same 18-unit path budget; no teleport, U-turn or extra range.
      if (valid(f.target)) {
        const x=f.target.g.position.x-f.x,z=f.target.g.position.z-f.z,d=Math.hypot(x,z);
        if (d>f.width*.35 && d<DW.seek && x*f.dx+z*f.dz>=0 && f.distance<f.reach) {
          [f.dx,f.dz]=steer(f.dx,f.dz,x,z,DW.turn*h);
          const step=Math.min(24*h,d-f.width*.35,f.reach-f.distance);
          f.x+=f.dx*step;f.z+=f.dz*step;f.distance+=step;
        }
      }
      if (valid(f.target) && near(f.target)) {
        while (f.swipes < f.ticks && f.strikes < f.budget && f.attackTime + 1e-9 >= f.swipes*f.interval) swipe();
      } else f.swipes = f.ticks;
      if (f.swipes >= f.ticks || f.strikes >= f.budget) {
        f.target = null; f.seek = null;
        if (f.strikes >= f.budget || f.distance >= f.reach) f.done = true;
      }
      continue;
    }
    if (f.distance >= f.reach || f.strikes >= f.budget) { f.done = true; break; }
    if (!valid(f.seek) || f.hit.has(f.seek) ||
      (f.seek.g.position.x-f.x)*f.dx+(f.seek.g.position.z-f.z)*f.dz < 0) f.seek = pick();
    if (f.seek) [f.dx,f.dz] = steer(f.dx,f.dz,f.seek.g.position.x-f.x,f.seek.g.position.z-f.z,DW.turn*h);
    const step = Math.min(24*h,f.reach-f.distance), candidates=[];
    for (const e of enemies) {
      if (!valid(e) || f.hit.has(e)) continue;
      const x=e.g.position.x-f.x,z=e.g.position.z-f.z,along=x*f.dx+z*f.dz;
      if (along<0 || along>step) continue;
      if ((x-f.dx*along)**2+(z-f.dz*along)**2 <= f.width*f.width) candidates.push({e,along});
    }
    candidates.sort((a,b)=>a.along-b.along);
    const contact=candidates[0],travel=contact?contact.along:step;
    f.x+=f.dx*travel;f.z+=f.dz*travel;f.distance+=travel;
    if (contact) { f.target=contact.e;f.hit.add(contact.e);f.attackTime=0;f.swipes=0;swipe(); }
  }
  return !f.done;
}
