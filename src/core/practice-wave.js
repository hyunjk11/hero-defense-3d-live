// Sandbox waves share the campaign roster, boss placement and scaling.
import { ETYPES } from '../data/monsters.js';
import { eliteQueue } from '../data/hard.js';
import { resolveRuleset } from '../data/rulesets.js';
import { stageWave, waveBoss } from './roster.js';

export const PRACTICE_PRESETS = Object.freeze({
  normal: '일반', elite: '정예', boss: '보스', mixed: '혼합', stage: '스테이지',
});
const eliteRules = Object.freeze({ hard:true, attackMul:1.12, rule:'forest-pulse' });
const normal = ['grunt', 'imp', 'grunt', 'golem', 'bat', 'grunt', 'imp', 'golem'];
const elites = ['golem', 'shield', 'charger', 'frostgolem'];
const mixed = ['grunt', 'golem', 'bat', 'shield', 'imp', 'boss', 'golem', 'grunt'];
export const practiceWaveNumber = (stage, wave) => Math.min(stage.waves, Math.max(1, Math.trunc(+wave) || 1));

export function practiceWave(preset, { stage, wave, random = Math.random } = {}) {
  if (!Object.hasOwn(PRACTICE_PRESETS, preset)) return null;
  if (preset === 'stage') {
    if (!stage) return null;
    const n = practiceWaveNumber(stage, wave), count = 8 + n * 3;
    const queue = stageWave(stage, n, count, random);
    if (!queue) return null;
    const boss = waveBoss(stage, n);
    if (boss) { if (stage.boss && n === stage.waves) queue.push(boss); else queue.splice(Math.floor(count / 2), 0, boss); }
    return {
      queue, elites: stage.hard ? eliteQueue(queue,n,ETYPES,stage.rule) : null,
      hard: stage.hard ? stage : null, hp: 1.16 ** (n - 1) * stage.hp * resolveRuleset('standard').enemyHp,
      exclusiveElites:false,
    };
  }
  const queue = [...({normal, elite:elites, boss:['boss'], mixed})[preset]];
  const variants = preset === 'elite' ? queue.map(() => true) : preset === 'mixed' ? queue.map((_, i) => i === 1 || i === 3) : null;
  return { queue, elites:variants, hard:variants ? eliteRules : null, hp:1.16 ** 4, exclusiveElites:preset === 'elite' };
}
