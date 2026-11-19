// First preparation is always manual. Time-based auto follows the simulation clock.
import { $ } from '../core/util.js';
import { G } from '../core/state.js';
import { STAGE } from '../core/grid.js';
import { startWave } from '../core/waves.js';
export const AUTO_WAVE_S = 15;
const autoKey='hd3d_live_autoWave', instantKey='hd3d_live_autoWaveInstant';
const read = key => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const save = (key, on) => { try { localStorage.setItem(key,on?'1':'0'); } catch { /* session setting still works */ } };
let auto = read(autoKey), instant = read(instantKey);
export const autoWaveOn = () => auto;
let shown = '';
function show(v) { if (v === shown) return; shown = v; const b = $('startWave'); if (!b) return; if (v) b.dataset.auto = v; else delete b.dataset.auto; }
export function updAutoWave(clearBonus) {
  if (!auto || G.phase !== 'build' || !(G.wave > 0) || G.practice || G.dungeon || G.coreHp <= 0 || (STAGE && G.wave >= STAGE.waves)) {
    G.autoWaveAt = 0; show(''); return;
  }
  if (G.paused || G.navigating) return;
  if (instant) { G.autoWaveAt=0; show(''); startWave(clearBonus); return; }
  if (!G.autoWaveAt) G.autoWaveAt = G.t + AUTO_WAVE_S;
  const left = G.autoWaveAt - G.t; if (left <= 0) { G.autoWaveAt = 0; show(''); startWave(); return; }
  show(String(Math.ceil(left)));
}
const controls = ids => ids.map(id => $(id)).filter(Boolean);
const parents=controls(['stAutoWave','sndAutoWave']), children=controls(['stAutoWaveInstant','sndAutoWaveInstant']);
function sync() {
  for (const cb of parents) cb.checked=auto;
  for (const cb of children) { cb.checked=instant; cb.disabled=!auto; }
}
for (const cb of parents) cb.addEventListener('change', () => {
  auto=cb.checked; save(autoKey,auto); G.autoWaveAt=0; show(''); sync();
});
for (const cb of children) cb.addEventListener('change', () => {
  if (auto) { instant=cb.checked; save(instantKey,instant); G.autoWaveAt=0; show(''); }
  sync();
});
sync();
// Settings changed in a second game tab take effect without reloading this battle.
if (typeof addEventListener === 'function') addEventListener('storage', e => {
  if (e.storageArea !== localStorage || (e.key !== null && e.key !== autoKey && e.key !== instantKey)) return;
  const a=read(autoKey), i=read(instantKey);
  if (auto!==a || instant!==i) { auto=a; instant=i; G.autoWaveAt=0; show(''); sync(); }
});
