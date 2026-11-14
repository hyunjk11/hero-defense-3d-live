import { ETYPES, ROSTERS } from '../data/monsters.js';
import { stageWave } from './roster.js';
const chapterBoss = ch => (ROSTERS[ch] && ROSTERS[ch].boss) || 'boss';
export function waveQueue(S, n, rand) {
  const count = 8 + n * 3, boss = n % 5 === 0, q = stageWave(S, n, count, rand) || Array(count).fill('grunt');
  if (n === S.waves && !boss) q.splice(Math.floor(count / 2), 0, 'boss'); if (S.boss && n === S.waves) q.push(chapterBoss(S.ch));
  if (boss && !(S.boss && n === S.waves)) q.splice(Math.floor(count / 2), 0, 'boss'); return q;
}
export function waveThreat(S, n, rand = Math.random) {
  const q = waveQueue(S, n, rand), mul = Math.pow(1.16, n - 1) * S.hp;
  return { hp: q.reduce((sum, t) => sum + ETYPES[t].hp * mul, 0), dps: q.reduce((sum, t) => sum + (ETYPES[t].dps || 0), 0), n: q.length };
}
export function avgThreat(S, n, seeds = 24) {
  const sum = { hp: 0, dps: 0, n: 0 };
  for (let k = 1; k <= seeds; k++) { let seed = k * 7919; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const result = waveThreat(S, n, r); for (const key in sum) sum[key] += result[key] / seeds; }
  return sum;
}
