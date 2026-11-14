// Boss equipment is independent of chapter loot and retired unique items.
const names = { warrior: '모르비아의 장송검', archer: '모르비아의 혼백궁', mage: '모르비아의 영혼홀', gunner: '모르비아의 망령쌍총', fighter: '모르비아의 귀골권갑', armor: '모르비아의 장막갑주', acc: '모르비아의 왕관 목걸이' };
export const MORVIA = {
  key: 'morvia', n: '모르비아', badge: '♛', color: '#b899e8', source: '던전 5층', grade: 3, chance: .3,
  names: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, [null, null, null, n]])),
  accW: { skill: 4, cdr: 3 }, subW: { hp: 3, skill: 4, cdr: 3 },
  bonuses: [{ pieces: 2, stats: { hp: 8 } }, { pieces: 3, stats: { skill: 12 } }],
};
export const ABYSSAL_PROC = Object.freeze({ hits: 5, icd: 3, mul: 1, radius: 2.4, max: 3 });
export const ABYSSAL = {
  key: 'abyssal', n: '심연의 별', badge: '✦', color: '#79dbff', source: '던전 10층 클리어', grade: 4,
  names: Object.fromEntries(Object.entries({warrior:'심연별의 대검',archer:'심연별의 장궁',mage:'심연별의 성운봉',gunner:'심연별의 쌍성총',fighter:'심연별의 유성권갑',armor:'심연별의 성운갑',acc:'심연별의 공명석'}).map(([k,n])=>[k,[null,null,null,null,n]])),
  accW: { skill: 4, cdr: 3 }, subW: { hp: 2, skill: 4, cdr: 3 },
  bonuses: [{pieces:2,stats:{skill:12}},{pieces:3,stats:{},effect:'abyssalResonance',desc:'별의 공명: 기본 공격 5회마다 대상 주변 반경 2.4의 적 최대 3명에게 공격력 100% 추가 피해. 재사용 3초. 무기 전설 효과와 별도 발동.'}]
};
export const BOSS_SETS = { morvia: MORVIA, abyssal: ABYSSAL };
export const MORVIA_HEROES = ['warrior', 'archer', 'mage', 'gunner', 'fighter'];
export function morviaSpec(slot, hero) {
  const s = ['weapon', 'armor', 'acc'].includes(slot) ? slot : 'armor';
  return { k: 'gear', s, g: MORVIA.grade, set: MORVIA.key, ...(s === 'weapon' ? { h: MORVIA_HEROES.includes(hero) ? hero : 'mage' } : {}) };
}
export function morviaRoll(hero, rnd = Math.random) {
  if (rnd() >= MORVIA.chance) return null;
  return morviaSpec(['weapon', 'armor', 'acc'][Math.min(2, Math.floor(rnd() * 3))], hero);
}
export function canDropMorvia({ dungeon, spire, floor, type, entry, over }) {
  return !!dungeon && !spire && !over && floor === 4 && type === 'dg_lich'
    && (entry?.mode === 'ranked' || entry?.mode === 'local');
}
export const MORVIA_SHOP = [...MORVIA_HEROES, 'armor', 'acc'].map(row => {
  const s = row === 'armor' || row === 'acc' ? row : 'weapon', spec = morviaSpec(s, row);
  return { id: `dg_morvia_${row}`, price: s === 'weapon' ? 45 : s === 'armor' ? 40 : 35, n: names[row], icon: '♛', reward: { items: [spec] }, desc: `영웅 · ${s === 'weapon' ? ({ warrior:'전사',archer:'궁수',mage:'마법사',gunner:'총사',fighter:'격투가' })[row] + ' 무기' : s === 'armor' ? '공용 방어구' : '공용 장신구'}` };
});

// Ten-floor completion awards exactly one legendary piece; no chapter drop tables are changed.
export function abyssalSpec(slot, hero) {
  const s = ['weapon','armor','acc'].includes(slot) ? slot : 'armor';
  return { k:'gear', s, g:ABYSSAL.grade, set:ABYSSAL.key, ...(s==='weapon'?{h:MORVIA_HEROES.includes(hero)?hero:'mage'}:{}) };
}
export function abyssalRoll(hero, rnd=Math.random) {
  return abyssalSpec(['weapon','armor','acc'][Math.max(0,Math.min(2,Math.floor(rnd()*3)))],hero);
}
