import assert from 'node:assert/strict';
import * as ST from '../src/data/stages.js';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import { ETYPES, ROSTERS } from '../src/data/monsters.js';
import { CH_KEYS } from '../src/data/items.js';
import { stageWave, previewWave } from '../src/core/roster.js';
import { resolveRuleset, RULESETS, SPIRE_ELITE } from '../src/data/rulesets.js';
assert.equal(ST.CHAPTERS.length, 10); assert.equal(Object.keys(ST.STAGES).length, 60);
assert.deepEqual(Object.keys(RULESETS), ['standard']); assert.equal(resolveRuleset('hard').id, 'standard');
assert.equal(SPIRE_ELITE.hp, 2.5);
let save = P.empty();
for (const chapter of ST.CHAPTERS) {
  assert.equal(chapter.stages.length, 6); assert.ok(ST.chapterUnlocked(save, chapter.id));
  for (const data of chapter.stages) {
    const S = ST.STAGES[data.id]; assert.ok(ST.stageUnlocked(save, S.id));
    for (let n = 1; n <= S.waves; n++) {
      const queue = stageWave(S, n, 8 + n * 3, () => .45); assert.ok(queue.length > 0);
      for (const type of queue) assert.ok(ETYPES[type], type);
      const preview = previewWave(S, n); if (preview.boss) assert.ok(ETYPES[preview.boss], preview.boss);
    }
    [save] = P.applyStage(save, S.id, 3, 'mage', () => .5);
  }
  assert.ok(ETYPES[ROSTERS[chapter.id].boss]);
  assert.equal(ST.chapterStars(save, chapter.id), 18);
}
assert.equal(ST.totalStars(save), 180); assert.equal(ST.nextStage(save, '10-6'), null);
assert.equal(ST.stageNo('2-4'), '2-6'); assert.equal(ST.stageNo('4-4'), '4-6');
const migrated = P.clean({ v: 1, souls: 400, hst: { '1-1': 3 }, st: { '4-4': 1 }, codexRw: ['10:all'], inv: [{ id: 'u_f_arm', uq: 'f_arm' }] });
assert.ok(!('hst' in migrated)); assert.equal(migrated.souls, 400); assert.equal(migrated.inv.length, 0);
assert.deepEqual(migrated.codexRw, ['10:all']); assert.ok(ST.chapterUnlocked(migrated, 5));
assert.deepEqual(CH_KEYS, [1,2,3,4,5,6,7,8,9,10]);
console.log('60 stages, 180 stars, rosters, sequential unlocks, old IDs and migration passed.');
