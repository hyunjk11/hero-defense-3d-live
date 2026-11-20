// Tab-local view state only; never part of account saves.
import { mobileApp } from './mobile-mode.js';
import { CH_KEYS } from '../data/items.js';
import { BOSS_SETS } from '../data/boss-sets.js';
const KEY = 'hd3d:pc:codex-view:1';
export function createCodexMemory(storage, keys, enabled = true) {
  if (!enabled) return { tab: () => 1, outer: () => 'bag', outerChanged() {}, leave() {}, mount() {} };
  const valid = key => keys.some(k => k === key);
  const position = n => Number.isFinite(n) ? Math.max(0, Math.min(100000, n)) : 0;
  let state = { tab: 1, codex: false, positions: {} }, active = null;
  try {
    const saved = JSON.parse(storage()?.getItem(KEY) || 'null');
    if (saved && valid(saved.tab)) {
      state.tab = saved.tab; state.codex = saved.codex === true;
      for (const key of keys) { const p = saved.positions?.[key]; if (p) state.positions[key] = [position(p[0]), position(p[1])]; }
    }
  } catch {}
  const save = () => { try { storage()?.setItem(KEY, JSON.stringify(state)); } catch {} };
  const capture = () => {
    if (!active) return;
    state.positions[active.tab] = [position(active.panel.scrollTop), position(active.grid?.scrollLeft)]; save();
  };
  return {
    tab: () => state.tab,
    outer: () => state.codex ? 'codex' : 'bag',
    outerChanged(tab) { state.codex = tab === 'codex'; save(); },
    leave() {
      capture();
      if (active) { active.panel.removeEventListener('scroll', capture); active.grid?.removeEventListener('scroll', capture); }
      active = null;
    },
    mount(tab, panel, grid) {
      if (!valid(tab) || !panel) return;
      this.leave(); state.tab = tab; save();
      const p = state.positions[tab] || [0, 0];
      panel.scrollTop = p[0]; if (grid) grid.scrollLeft = p[1];
      active = { tab, panel, grid };
      panel.addEventListener('scroll', capture, { passive: true }); grid?.addEventListener('scroll', capture, { passive: true });
    }
  };
}
export const codexMemory = createCodexMemory(() => globalThis.sessionStorage, [...CH_KEYS, ...Object.keys(BOSS_SETS)], !mobileApp);
