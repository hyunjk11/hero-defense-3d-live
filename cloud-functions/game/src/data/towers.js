// Five paid combat levels. Lv3 selects a specialization; Lv5 grants its signature.
export const TOWER_RATE_K = .8;
const R = a => a.map(v => +(v * TOWER_RATE_K).toFixed(4));
const TOWERS = {
  arrow:  { n: '화살탑', cost: 60, up: [55, 95, 140, 200], dmg: [16, 26, 38, 54, 72], rate: R([2.0, 2.4, 2.7, 3.1, 3.6]), range: [8, 8.8, 9.2, 9.6, 10], air: true, hp: [260, 360, 480, 620, 800], d: '빠른 단일 공격' },
  cannon: { n: '대포탑', cost: 90, up: [80, 130, 190, 270], dmg: [45, 75, 105, 155, 220], rate: R([.55, .62, .7, .78, .86]), range: [7, 7.5, 8, 8.4, 8.8], splash: [2.2, 2.5, 2.8, 3.0, 3.2], air: false, hp: [340, 460, 620, 820, 1050], d: '광역 포격 (지상)' },
  guardian: { n: '광선탑', cost: 130, up: [100, 150, 220, 300], dmg: [6, 9, 13, 18, 25], rate: R([5, 5, 5, 5, 5]), range: [7, 7.3, 7.6, 7.9, 8.2], air: true, hp: [380, 500, 650, 830, 1050], beam: true, warmup: 2.5, maxHeat: 2.5, d: '연속 광선 · 집중할수록 피해 증가' },
  magic:  { n: '마법탑', cost: 100, up: [90, 150, 210, 290], dmg: [20, 32, 46, 64, 86], rate: R([.9, 1.0, 1.1, 1.22, 1.35]), range: [7.5, 8, 8.5, 9, 9.5], chain: [3, 4, 4, 5, 6], slow: [.35, .38, .42, .46, .5], air: true, hp: [300, 410, 550, 720, 920], d: '연쇄 번개 + 둔화' },
};

// 수리 비용 = 잃은 체력 비율 × 누적 투자액 × REPAIR_K (최소 5G)
const REPAIR_K = .45;

// 바리케이드: 설치 비용 · 철거 환급 (ui/input.js 건설·철거, ui/hud.js 버튼 표시, index.html 도구 버튼 가격)
const BARRICADE = Object.freeze({ cost: 30, refund: 15 });
export const barHpAt = (lv, adv = 1) => 320 * (1 + .25 * lv) * adv; // 바리케이드 체력 (world/barricades.js barMaxHp · Q-7 #ups 미리보기)

export { TOWERS, REPAIR_K, BARRICADE };
