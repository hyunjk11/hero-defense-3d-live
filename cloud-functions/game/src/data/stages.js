import { HARD_CHAPTERS, HARD_STAGES, hardUnlocked } from './hard.js';
export { HARD_CHAPTERS, HARD_STAGES };
export const getStage = id => STAGES[id] || HARD_STAGES[id] || null;
import { CHAPTERS } from './chapters/index.js';
export { CHAPTERS };
// 화면에 보이는 번호 = 챕터 안 순서 (id 는 저장 키라 바뀌지 않음: 2026-10-21 에 2~4장 보스 앞에 x-5·x-6 을 끼워 넣어 보스 id x-4 는 'x-6' 으로 표시)
for (const ch of CHAPTERS) ch.stages.forEach((s, i) => { s.no = `${ch.id}-${i + 1}`; });
export const STAGES = Object.fromEntries(CHAPTERS.flatMap(ch => ch.stages.map((s, i) => [s.id, { ...s, ch: ch.id, idx: i, last: i === ch.stages.length - 1 }])));
export const STAR_D = ['스테이지 클리어', '코어 체력 70% 이상 유지', '코어 피해 없이 클리어'];
export function starsFor(coreHp, coreMax) { const r = coreMax ? coreHp / coreMax : 0; return 1 + (r >= .7 ? 1 : 0) + (r >= 1 ? 1 : 0); }
export const stageNo = id => getStage(id)?.no || String(id);
export const stars = (save, id) => (HARD_STAGES[id] ? save.growth?.hard?.st?.[id] : (save.st || {})[id]) || 0;
export const totalStars = save => Object.values(save.st || {}).reduce((a, b) => a + b, 0);
export const chapterStars = (save, ch) => CHAPTERS.find(c => c.id === ch).stages.reduce((a, s) => a + stars(save, s.id), 0);
export function chapterUnlocked(save, ch) { const C = CHAPTERS.find(c => c.id === ch); if (!C || C.soon || !C.stages.length) return false; if (ch === 1) return true; const P = CHAPTERS.find(c => c.id === ch - 1); return !!P && P.stages.length > 0 && stars(save, P.stages[P.stages.length - 1].id) > 0; }
// 이미 깬 스테이지는 항상 열림 (보스를 깬 기존 저장: 새로 끼운 앞 스테이지를 안 깼어도 보스·다음 장이 다시 잠기지 않음)
export function stageUnlocked(save, id) { if (HARD_STAGES[id]) return hardUnlocked(save,id); const S = STAGES[id]; if (!S || !chapterUnlocked(save, S.ch)) return false; if (S.idx === 0 || stars(save, id) > 0) return true; const C = CHAPTERS.find(c => c.id === S.ch); return stars(save, C.stages[S.idx - 1].id) > 0; }
export const STAR_STEP = 5; // 별 5개마다 별 보상 상자
export const stageReward = (id, first) => { const S = STAGES[id]; const base = 40 + S.idx * 15 + (S.ch - 1) * 60 + (S.boss ? 60 : 0); return first ? base : Math.round(base / 2); };
export function nextStage(save, id) { if(HARD_STAGES[id]) {const ids=HARD_CHAPTERS.flatMap(c=>c.stages.map(s=>s.id)),i=ids.indexOf(id),n=ids[i+1];return n&&hardUnlocked(save,n)?n:null;} const ids = CHAPTERS.flatMap(c => c.stages.map(s => s.id)), n = ids[ids.indexOf(id) + 1]; return ids.includes(id) && n && stageUnlocked(save, n) ? n : null; }
// 폐허: 고대 성벽 칸 목록 (용암과 같은 꺾은선 규칙)
export const wallTiles = (S, GW = 24, GH = 16) => lavaTiles(S, GW, GH, 'walls');
// 용암 강 칸 목록 (꺾은선 → 칸, 포털·코어 주변 1칸 제외). 순수 함수: 렌더/경로/테스트 공용
export function lavaTiles(S, GW = 24, GH = 16, key = 'lava') {
  const out = new Set(); if (!S || !S[key]) return out; const near = (c, r) => [S.core, ...S.spawns].some(p => Math.abs(c - p[0]) <= 1 && Math.abs(r - p[1]) <= 1);
  for (const line of S[key]) for (let i = 0; i < line.length; i++) { const a = line[i], b = line[Math.min(i + 1, line.length - 1)], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    let pc = null, pr = null; const add = (c, r) => { if (c >= 0 && r >= 0 && c < GW && r < GH && !near(c, r)) out.add(c + ',' + r); };
    for (let k = 0; k <= n; k++) { const c = Math.round(a[0] + (b[0] - a[0]) * k / n), r = Math.round(a[1] + (b[1] - a[1]) * k / n); if (pc !== null && c !== pc && r !== pr) add(c, pr); add(c, r); pc = c; pr = r; } } // 대각선 이음새도 채움(4방향으로 새지 않게)
  return out;
}
