import { inGrid, isBlock, T, toTile } from '../core/grid.js';
import { G, heroFx } from '../core/state.js';
import { tileAt } from '../world/terrain.js';
const FX=heroFx();
const walk = (x, z) => { const [c, r] = toTile(x, z); if (!inGrid(c, r)) return false; const t = tileAt(c, r); return !isBlock(t.t) && t.t !== T.BEDROCK && !t.tower && !t.bar; };
// 밀쳐내기: (ox,oz)에서 바깥으로 dist 만큼 0.22초에 걸쳐 밀고 짧게 띄움. 막힌 칸으로는 밀지 않음 · 비행/보스는 약하게
export function knock(e, ox, oz, dist, up = .5) {
  if (e.dead || e.E.fly) return; if (e.E.boss) { dist *= .25; up *= .3; } let dx = e.g.position.x - ox, dz = e.g.position.z - oz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const dur = .22; let t = 0; e.stunT = Math.max(e.stunT || 0, dur + .1); if (!e.kup) e.kup = { t: 0, dur: e.stunT, h: up };
  FX.push(dt => { if (e.dead) return false; const k = Math.min(dt, dur - t), st = dist / dur * k * (1.6 - 1.2 * t / dur), p = e.g.position; t += dt;
    if (walk(p.x + dx * st, p.z)) p.x += dx * st; if (walk(p.x, p.z + dz * st)) p.z += dz * st;
    if (t < dur) return true; const [c, r] = toTile(p.x, p.z); if (inGrid(c, r) && walk(p.x, p.z)) e.tile = [c, r]; e.next = null; return false; });
}

export function updateKnockback(dt) { for (let i=FX.length-1;i>=0;i--) if(!FX[i](dt)) FX.splice(i,1); }
