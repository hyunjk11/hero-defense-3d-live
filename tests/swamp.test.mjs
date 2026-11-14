import assert from 'node:assert/strict';
import { SWAMP_ENEMIES, SWAMP_SET } from '../src/data/chapters/swamp.js';
import { ETYPES, ROSTERS } from '../src/data/monsters.js';
import { CHSET } from '../src/data/items.js';
import { STAGES } from '../src/data/stages.js';
import { stageWave, waveBoss, previewWave } from '../src/core/roster.js';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import { swampIcon } from '../src/ui/swamp-icons.js';
const R = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;

assert.equal(CHSET[5], SWAMP_SET);
assert.equal(new Set(Object.values(SWAMP_ENEMIES).map(e => e.form)).size, 7);
for (const [key, enemy] of Object.entries(SWAMP_ENEMIES)) { assert.equal(ETYPES[key], enemy); assert.equal(enemy.proc, 'swamp'); assert.ok(enemy.hp > 0 && enemy.h > 0 && enemy.gold > 0); }
for (let s = 1; s <= 6; s++) {
  const stage = STAGES[`5-${s}`];
  for (let w = 1; w <= stage.waves; w++) {
    const queue = stageWave(stage, w, 8 + w * 3, R(s * 100 + w));
    assert.ok(queue.every(k => SWAMP_ENEMIES[k] && !SWAMP_ENEMIES[k].child));
    assert.equal(previewWave(stage, w).boss, waveBoss(stage, w));
    if (w % 5 === 0 || w === stage.waves) assert.ok(SWAMP_ENEMIES[waveBoss(stage,w)]?.boss);
  }
}
assert.equal(waveBoss(STAGES['5-6'], 15), 'boss_swamp');
assert.equal(waveBoss(STAGES['5-1'], 5), 'swamp_guardian');
assert.equal(waveBoss(STAGES['4-1'], 5), 'boss');
const mothShare = id => previewWave(STAGES[id], 6).list.find(e => e.t === 'swamp_moth').share;
assert.ok(mothShare('5-5') > mothShare('5-4') * 2);
const nestQueue = stageWave(STAGES['5-5'], 6, 10000, R(12));
assert.ok(Math.abs(nestQueue.filter(t => t === 'swamp_moth').length / nestQueue.length - mothShare('5-5')) < .02);
assert.deepEqual(ROSTERS[5].pool.map(p => p[0]), ['swamp_runner','swamp_spitter','swamp_beetle','swamp_mender','swamp_moth']);
const names = new Set(), icons = new Set();
for (const [row, rowNames] of Object.entries(SWAMP_SET.names)) {
  assert.equal(rowNames.length, 5);
  icons.add(swampIcon({ c: 5, s: ['armor','acc'].includes(row) ? row : 'weapon', h: row, g: 3 }));
  for (const name of rowNames) { assert.ok(!names.has(name)); names.add(name); }
}
assert.equal(names.size, 40); assert.equal(icons.size, 8); assert.equal(swampIcon({ c: 4 }), null);
let save = P.empty(), random = R(42);
for (const slot of E.SLOT_KEYS) { const it = E.makeItem(slot, 'mage', 3, random, 5); save.inv.push(it); save.eq.mage[slot] = it.id; }
const raw = {}; for (const it of save.inv) for (const [k,v] of Object.entries(E.itemStats(it))) raw[k] = (raw[k] || 0) + v;
assert.equal(E.bonus(save,'mage').hp, raw.hp + 8); assert.equal(E.bonus(save,'mage').cdr, (raw.cdr || 0) + 5);
assert.equal(E.setBonuses(save,'mage').length, 2);
const roundtrip = P.clean(JSON.parse(JSON.stringify(save)));
assert.deepEqual(E.bonus(roundtrip,'mage'), E.bonus(save,'mage'));
delete save.eq.mage.acc;
assert.equal(E.setBonuses(save,'mage').length, 1);
delete save.eq.mage.armor;
assert.equal(E.setBonuses(save,'mage').length, 0);
const rewardSave = P.empty();
const [cleared, reward] = P.applyStage(rewardSave, '5-1', 2, 'mage', R(80));
assert.ok(reward.first && cleared.chests.length > 0);
assert.ok(cleared.chests.every(c => c.it.c === 5 && c.it.g >= 1 && names.has(c.it.n)));
const [, opened] = E.openChests(cleared);
assert.ok(opened.opened.length > 0); assert.equal(cleared.chests.length, 0);
const [, repeat] = E.openChests(cleared); assert.equal(repeat.opened.length, 0);
for (const it of cleared.inv) assert.equal(E.cleanItem(it, P.HEROES)?.n, it.n);
console.log('swamp.test ok: bespoke roster, boss queues, 40 item names/8 icons, set activation, rewards, save roundtrip');
