import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import * as GR from '../src/data/growth.js';
import * as AD from '../src/data/advance.js';
import { TOWERS, TOWER_RATE_K } from '../src/data/towers.js';
assert.equal(TOWER_RATE_K, .8);
for (const type of GR.TTYPES) {
  assert.equal(TOWERS[type].up.length, 4);
  for (let lvl = 1; lvl <= 5; lvl++) {
    const actual = GR.towerStats(type, lvl), base = TOWERS[type];
    assert.equal(actual.dmg, base.dmg[lvl - 1]); assert.equal(actual.rate, base.rate[lvl - 1]);
    assert.deepEqual(GR.towerStats(type, lvl, null, GR.resMods(GR.emptyResearch(), type)), actual);
    if (lvl > 1) assert.ok(actual.dmg > GR.towerStats(type, lvl - 1).dmg);
  }
  assert.equal(Object.keys(GR.BRANCH[type]).length, 2);
  const tw = { type, lvl: 1, mods: null, branch: null };
  assert.equal(GR.upgradeBlock(tw, 0), '골드 부족');
  assert.equal(GR.upgradeBlock(tw, GR.upgradeCost(type, 1)), null);
  tw.lvl = 3; assert.equal(GR.canSpecialize(tw), false); assert.equal(GR.upgradeBlock(tw, 1e6), 'XP 0/2400'); tw.xp = 2399; assert.equal(GR.canSpecialize(tw), false); tw.xp = 2400; assert.equal(GR.canSpecialize(tw), true); assert.equal(GR.upgradeBlock(tw, 1e6), '전문화 선택 필요');
  tw.branch = Object.keys(GR.BRANCH[type])[0]; assert.equal(GR.upgradeBlock(tw, 1e6), null);
  tw.lvl = 5; assert.equal(GR.upgradeBlock(tw, 1e6), '최대 레벨');
  for (const branch of Object.keys(GR.BRANCH[type])) {
    assert.ok(GR.towerStats(type, 5, branch).dmg > GR.towerStats(type, 3, branch).dmg); assert.ok(GR.SIGNATURE[branch]);
  }
}
assert.equal(GR.branchFor('arrow', 'multi', null, 5).targets, 5);
assert.equal(GR.branchFor('magic', 'frost', null, 5).freezeEvery, 3);
assert.equal(GR.towerStats('magic', 5, 'storm').chain, 12);
assert.equal(GR.towerStats('magic', 5, 'frost').chain, 2);
assert.equal(TOWERS.cannon.air, false);
assert.equal(GR.branchFor('cannon', 'pierce').pierceArmor, true);
let s = P.clean({ v: 1, souls: 123, research: { arrow: { start: 4, atk: 3 } } });
assert.equal(s.research.arrow.efficiency, 4); assert.equal(s.souls, 123);
assert.ok(!('start' in s.research.arrow)); assert.deepEqual(P.clean(s), s);
assert.equal(GR.upgradeCost('arrow', 4, GR.resMods(s.research, 'arrow')), 152);
assert.equal(GR.upgradeCost('arrow', 4), 200);
for (const key of GR.RKEYS) for (let lvl = 1; lvl < GR.RES[key].max; lvl++) assert.ok(GR.resCost(key, lvl).souls > GR.resCost(key, lvl - 1).souls);
s = P.empty(); assert.equal(P.buyResearch(s, 'arrow', 'atk')[1], false);
s.souls = 1e6; s.mat.steel = 1e4; s.mat.crystal = 100;
assert.match(GR.resBlock(s, 'arrow', 'efficiency'), /기본 연구/);
for (let i = 0; i < 30; i++) for (const key of GR.RKEYS) [s] = P.buyResearch(s, 'arrow', key);
assert.deepEqual(s.research.arrow, { atk: 10, rng: 5, spd: 8, efficiency: 4 });
assert.equal(P.buyResearch(s, 'arrow', 'atk')[1], false);
const m = GR.resMods(s.research, 'arrow'); assert.equal(m.dmg, 1.4); assert.equal(m.discount, .24);
const wind = GR.resMods(s.research, 'arrow', AD.advTowerMods(AD.ADV.archer.wind, 'arrow'));
assert.equal(GR.branchFor('arrow', 'multi', wind, 5).targets, 6);
assert.ok(Math.abs(wind.rate / m.rate - 1.06) < 1e-9);
console.log('Five levels, choices, economy, research migration and advancement passed.');

assert.equal(GR.starsFor(599),1); assert.equal(GR.starsFor(600),2); assert.equal(GR.starsFor(2399),2); assert.equal(GR.starsFor(2400),3); assert.equal(GR.canSpecialize({lvl:1,xp:2400}),false); assert.ok(GR.towerStats('arrow',1,null,null,2).dmg>GR.towerStats('arrow',1).dmg);
