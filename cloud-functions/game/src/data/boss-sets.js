// Boss equipment is independent of chapter loot and retired unique items.
const names = { warrior: '모르비아의 장송검', archer: '모르비아의 혼백궁', mage: '모르비아의 영혼홀', gunner: '모르비아의 망령쌍총', fighter: '모르비아의 귀골권갑', armor: '모르비아의 장막갑주', acc: '모르비아의 왕관 목걸이' };
export const MORVIA = {
  key: 'morvia', n: '모르비아', badge: '♛', color: '#b899e8', source: '던전 5층', grade: 3, chance: .3,
  names: Object.fromEntries(Object.entries(names).map(([k, n]) => [k, [null, null, null, n]])),
  accW: { skill: 4, cdr: 3 }, subW: { hp: 3, skill: 4, cdr: 3 },
  bonuses: [{ pieces: 2, stats: { hp: 8 } }, { pieces: 3, stats: { skill: 12 } }],
};
export const BOSS_SETS = { morvia: MORVIA };
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
