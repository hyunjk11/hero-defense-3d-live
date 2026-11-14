// Run only in a disposable browser origin, on a fresh ?stage=1-1&run=1 page.
// This deliberately changes in-memory combat state. It never writes an account save.
export async function verifyBranch(type, branch) {
  const G = window.G;
  if (!G?.ready || G.stage?.id !== '1-1' || G.wave || G.towers.length) throw new Error('Use a fresh 1-1 run');
  G.manual = true; G.gold = 2000; G.build(12, 7, type);
  const tw = G.towers[0]; G.upgradeTower(tw); G.upgradeTower(tw);
  G.towerXp(tw, 2400);
  if (!G.chooseBranch(tw, branch)) throw new Error('Branch selection failed');
  G.upgradeTower(tw); G.upgradeTower(tw); G.heroes[0].g.position.set(22, 0, 14);
  const enemies = [];
  for (let i = 0; i < 8; i++) {
    const [x, z] = G.tileXZ(12, 8), e = G.spawnEnemy('grunt', 1000, { x: x + i % 2 * .4, z: z + Math.floor(i / 2) * .6, tile: [12, 8] });
    e.E = { ...e.E, spd: 0 }; enemies.push(e);
  }
  tw.cd = 0; (await import('../src/world/towers.js')).updTowers(.05);
  const projectiles = G.projs.map(p => p.kind); let peakStun = 0;
  for (let i = 0; i < 140; i++) { G.sim(.05); peakStun = Math.max(peakStun, ...enemies.map(e => e.stunT || 0)); }
  const result = { type, branch, level: tw.lvl, shots: tw.shots, projectiles, damaged: enemies.filter(e => e.hp < e.max).length, damage: enemies.reduce((n, e) => n + e.max - e.hp, 0), peakStun };
  if (tw.lvl !== 5 || !result.damage || !enemies.every(e => Number.isFinite(e.hp))) throw new Error('No valid Lv5 damage: ' + JSON.stringify(result));
  if (branch === 'pierce' && !projectiles.includes('pierce')) throw new Error('Piercing branch fired wrong projectile');
  if (branch === 'multi' && projectiles.length !== 5) throw new Error('Lv5 multi must fire five arrows');
  if (branch === 'frost' && peakStun < 1.2) throw new Error('Frost did not freeze');
  if (branch === 'storm' && result.damaged !== 8) throw new Error('Chain lightning missed reachable targets');
  return result;
}
