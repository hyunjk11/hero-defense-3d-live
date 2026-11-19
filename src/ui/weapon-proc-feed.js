// One compact line per recent caster, independent of graphics quality, sound and combat speed.
// No timers or gameplay state: the regular HUD tick expires entries against the real clock.
export function createWeaponFeed() {
  const rows = new Map();
  function refresh(state, now) {
    for (const [hero, row] of rows) {
      if (now < row.until && row.map === state.tiles && state.screen !== 'town' && state.screen !== 'menu'
          && (state.phase === 'wave' || state.phase === 'build') && (hero === state.hero || state.heroes?.includes(hero))) continue;
      row.el.remove(); rows.delete(hero);
    }
  }
  function record(root, state, hero, skill, now) {
    if (!root || state.screen === 'town' || state.screen === 'menu' || skill?.type !== 'proc' || !(state.phase === 'build' || state.phase === 'wave') ||
        !(hero === state.hero || state.heroes?.includes(hero))) return;
    refresh(state, now);
    let row = rows.get(hero);
    if (!row) {
      if (rows.size >= 2) {
        const oldest = [...rows].reduce((a,b) => a[1].until <= b[1].until ? a : b);
        oldest[1].el.remove(); rows.delete(oldest[0]);
      }
      const el = root.ownerDocument.createElement('div');
      row = { el, map:state.tiles, name:'', count:0 }; rows.set(hero,row); root.appendChild(el);
    }
    row.count = row.name === skill.n ? row.count + 1 : 1;
    row.name = skill.n; row.until = now + 2200;
    const who = hero.C?.nm ? hero.C.nm+' · ' : '';
    row.el.textContent = who+'무기 발동: '+skill.n+(row.count > 1 ? ' ×'+row.count : '');
  }
  return { record, refresh };
}
export const weaponProcFeed = createWeaponFeed();
