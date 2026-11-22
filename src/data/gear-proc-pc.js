import { LSK } from '../account/equip.js';

// Keep the equipment key/stored loot unchanged; both clients interpret it as artillery.
export const ARTILLERY = Object.freeze({
  ...LSK.ricochet, n: '포격 요청', radius: 3.25, delay: .52, maxTargets: 4,
  d: '공격 시 22% · 착탄 범위 내 최대 4명에게 각 70%',
});

export const equipProc = key => key === 'ricochet' ? ARTILLERY : LSK[key];

export function artilleryTargets(enemies, x, z, time) {
  const near = [];
  for (const e of enemies) {
    if (e.dead || e.dying !== undefined || e.immT > time) continue;
    const p=e.g.position, d=(p.x-x)**2+(p.z-z)**2;
    if (d <= ARTILLERY.radius**2) near.push({e,d});
  }
  near.sort((a,b)=>a.d-b.d);
  return near.slice(0,ARTILLERY.maxTargets).map(v=>v.e);
}
