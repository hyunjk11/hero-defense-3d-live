import { TOWERS } from './towers.js';
export const XP_NEED = [0, 600, 2400], KILL_XP = 15;
export const STAR = [{ dmg: 1, rate: 1, rng: 1 }, { dmg: 1.2, rate: 1.08, rng: 1.05 }, { dmg: 1.45, rate: 1.15, rng: 1.1 }];
export const starsFor = xp => xp >= XP_NEED[2] ? 3 : xp >= XP_NEED[1] ? 2 : 1;
export const canSpecialize = tw => !!tw && !tw.dead && tw.lvl >= 3 && !tw.branch && starsFor(tw.xp || 0) >= 3;
export const TTYPES = ['arrow', 'cannon', 'magic', 'guardian'];
export const BRANCH = {
  arrow: {
    multi: { n: '연발 사수', icon: '🏹', c: '#7affc0', d: '대상 3명 동시 사격 (각 피해 75%) · 공격속도 +15%', dmg: .75, rate: 1.15, targets: 3 },
    snipe: { n: '저격수', icon: '🎯', c: '#ff7a9a', d: '사거리 +40% · 피해 ×2.3 · 공격속도 -40% · 체력 높은 적(보스) 우선 · 방어력 무시', dmg: 2.3, rate: .6, rng: 1.4, prio: 'hp', pierceArmor: true },
  },
  cannon: {
    blast: { n: '광역 폭발', icon: '💥', c: '#ffa04a', d: '폭발 반경 +60% · 피해 +10% · 착탄 후 집속탄 3발 (각 40%, 반경 1.6)', dmg: 1.1, splash: 1.6, cluster: 3, clusterK: .4, clusterR: 1.6 },
    pierce: { n: '단일 관통', icon: '➶', c: '#9ad8ff', d: '관통 철갑탄: 사거리 끝까지 직선 위 모든 지상 적 관통 · 피해 ×2 · 방어력 무시 · 폭발 없음', dmg: 2, pierce: true, pierceArmor: true },
  },
  guardian: {
    guardian_bulwark: { n: '집광', icon: '☀', c: '#8edbff', d: '집중 광선 피해 +20%', dmg: 1.2, beamFocus: true, maxHeat: 5.6 },
    guardian_assault: { n: '절단', icon: '✦', c: '#ffba77', d: '휩쓰는 광선 · 접촉 피해 200%', dmg: 2, beamSweep: true, maxHeat: 2.2 },
  },
  magic: {
    storm: { n: '폭풍 연쇄', icon: '⚡', c: '#c8a0ff', d: '연쇄 +4 · 연쇄 감쇠 15%→5% · 연쇄 거리 3.8→5.5', chainAdd: 4, falloff: .95, hop: 5.5 },
    frost: { n: '서리 결정', icon: '❄', c: '#8ae8ff', d: '연쇄 2로 감소 · 피해 ×1.6 · 둔화 70%(2초) · 4번째 공격마다 1.2초 빙결 (보스 0.4초)', dmg: 1.6, chainSet: 2, slowSet: .7, slowT: 2, freezeEvery: 4, freezeT: 1.2, freezeBoss: .4 },
  },
};
export const RES = {
  atk: { n: '공격력', icon: '⚔', d: lv => `피해 +${lv * 4}%`, max: 10, per: .04, souls: 40, k: 1.38, mat: 'steel', m0: 2, m1: 1 },
  rng: { n: '사거리', icon: '◎', d: lv => `사거리 +${lv * 3}%`, max: 5, per: .03, souls: 50, k: 1.5, mat: 'steel', m0: 3, m1: 2 },
  spd: { n: '공격속도', icon: '➹', d: lv => `공격속도 +${lv * 3}%`, max: 8, per: .03, souls: 45, k: 1.42, mat: 'steel', m0: 2, m1: 1 },
  efficiency: { n: '강화 설계', icon: '⚙', d: lv => `타워 강화 비용 -${lv * 6}%`, max: 4, souls: 160, k: 1.6, mat: 'crystal', m0: 2, m1: 2, need: 12 },
};
export const RKEYS = Object.keys(RES);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(+v) ? +v : 0)));
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export function emptyResearch() { return Object.fromEntries(TTYPES.map(t => [t, Object.fromEntries(RKEYS.map(k => [k, 0]))])); }
export function cleanResearch(r) { const o = emptyResearch(); r = obj(r); for (const t of TTYPES) { const x = obj(r[t]); for (const k of RKEYS) o[t][k] = int(k === 'efficiency' ? x.efficiency ?? x.start : x[k], 0, RES[k].max); } return o; }
export function mergeResearch(a, b) { a = cleanResearch(a); b = cleanResearch(b); const o = emptyResearch(); for (const t of TTYPES) for (const k of RKEYS) o[t][k] = Math.max(a[t][k], b[t][k]); return o; }
export const basicSum = r => r.atk + r.rng + r.spd;
export function resCost(k, lv) { const R = RES[k]; return { souls: Math.round(R.souls * Math.pow(R.k, lv)), [R.mat]: R.m0 + R.m1 * lv }; }
// 구매 가능 여부: null 이면 가능, 아니면 사유
export function resBlock(save, type, k) {
  const r = save.research[type], lv = r[k], R = RES[k]; if (lv >= R.max) return '최대';
  if (R.need && basicSum(r) < R.need) return `기본 연구 ${R.need}레벨 필요 (${basicSum(r)}/${R.need})`;
  const c = resCost(k, lv); if (save.souls < c.souls) return '영혼석 부족'; if ((save.mat[R.mat] || 0) < c[R.mat]) return (R.mat === 'steel' ? '강철' : '마력석') + ' 부족'; return null;
}
// save 는 progress.clean 된 객체 (souls, mat, research) — 성공 시 그 객체를 수정하고 true
export function buyResearch(save, type, k) { if (!TTYPES.includes(type) || !RES[k] || resBlock(save, type, k)) return false; const c = resCost(k, save.research[type][k]); save.souls -= c.souls; save.mat[RES[k].mat] -= c[RES[k].mat]; save.research[type][k]++; return true; }
// 판 시작 시 연구 효과 (연구 없으면 모두 1/0 → 기존 수치 그대로)
// am = 전직 타워 보너스(advance.js advTowerMods) — 연구 결과에 곱만 추가. 없으면 기존 결과와 완전히 같음
export function resMods(research, type, am) { const r = research && research[type], o = !r ? { dmg: 1, rate: 1, rng: 1, discount: 0 } : { dmg: 1 + RES.atk.per * r.atk, rate: 1 + RES.spd.per * r.spd, rng: 1 + RES.rng.per * r.rng, discount: .06 * (r.efficiency || 0) };
  if (!am) return o; o.dmg *= am.dmg; o.rate *= am.rate; o.rng *= am.rng; if (am.splash !== 1) o.splash = am.splash; if (am.slowAdd) o.slowAdd = am.slowAdd; if (Object.keys(am.br || {}).length) o.br = am.br; return o; }
export function branchFor(type, branch, mods, lvl = 3) { let B = branch && BRANCH[type][branch]; if (!B) return null; B = { ...B }; if (lvl >= 5) Object.assign(B, SIGNATURE[branch].effects); const x = mods && mods.br && mods.br[branch]; if (!x) return B;
  const o = { ...B }; if (x.targets) o.targets = (B.targets || 1) + x.targets; if (x.cluster) o.cluster = (B.cluster || 0) + x.cluster; if (x.dmg) o.dmg = (B.dmg || 1) * x.dmg; if (x.freezeEvery) o.freezeEvery = x.freezeEvery; return o; }

export const MAX_TOWER_LEVEL = 5;
export const SIGNATURE = {
  guardian_bulwark: { n: '백열 섬광', d: '동일 대상 4초 집중마다 강력한 섬광', effects: { beamBurst: true } },
  guardian_assault: { n: '왕복 절단', d: '광선이 왕복하며 적을 절단', effects: { beamReturn: true } },
  multi: { n: '화살 폭풍', d: '동시 사격 3 → 5명', effects: { targets: 5 } },
  snipe: { n: '거인 사냥', d: '단일 피해 ×2.3 → ×3.0 · 보스 우선', effects: { dmg: 3, prio: 'hp' } },
  blast: { n: '융단 폭격', d: '집속탄 3 → 5발', effects: { cluster: 5 } },
  pierce: { n: '장갑 파쇄', d: '관통 피해 ×2.0 → ×2.7', effects: { dmg: 2.7 } },
  storm: { n: '폭풍 그물', d: '추가 연쇄 4 → 6 · 연쇄 감쇠 2%', effects: { chainAdd: 6, falloff: .98 } },
  frost: { n: '빙하 봉인', d: '3번째 공격마다 빙결 · 보스 0.4초', effects: { freezeEvery: 3 } },
};
export function towerStats(type, lvl, branch = null, mods = null, stars = 1) {
  const D = TOWERS[type], L = Math.max(0, Math.min(MAX_TOWER_LEVEL - 1, lvl - 1));
  const B = branchFor(type, branch, mods, lvl) || {}, M = mods || { dmg: 1, rate: 1, rng: 1 };
  const X = STAR[Math.max(0, Math.min(2, (stars || 1) - 1))];
  const o = { dmg: D.dmg[L] * X.dmg * (B.dmg || 1) * M.dmg, rate: D.rate[L] * X.rate * (B.rate || 1) * M.rate, range: D.range[L] * X.rng * (B.rng || 1) * M.rng };
  if (D.splash && !B.pierce) o.splash = D.splash[L] * (B.splash || 1) * (M.splash || 1);
  if (D.chain) { o.chain = B.chainSet || D.chain[L] + (B.chainAdd || 0); o.slow = (B.slowSet || D.slow[L]) + (M.slowAdd || 0); o.falloff = B.falloff || .85; o.hop = B.hop || 3.8; }
  if (D.beam) Object.assign(o, { beamWarmup: D.warmup, beamMaxHeat: B.maxHeat ?? D.maxHeat });
  return o;
}
export function upgradeCost(type, lvl, mods) {
  const price = TOWERS[type]?.up[lvl - 1]; return price == null ? 0 : Math.ceil(price * (1 - Math.min(.24, mods?.discount || 0)));
}
export function upgradeBlock(tw, gold) {
  if (!tw || tw.dead) return '타워 없음';
  if (tw.lvl >= MAX_TOWER_LEVEL) return '최대 레벨';
  if (tw.lvl >= 3 && !tw.branch) return canSpecialize(tw) ? '전문화 선택 필요' : `XP ${Math.floor(tw.xp || 0)}/${XP_NEED[2]}`;
  return gold < upgradeCost(tw.type, tw.lvl, tw.mods) ? '골드 부족' : null;
}
