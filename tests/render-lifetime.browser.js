// Browser regression checks: import only in an isolated ?test=1 guest page.
import * as THREE from 'three';
import { G } from '../src/core/state.js';
import { camera, renderer, scene } from '../src/render/scene.js';
import { castLegend, legendProc } from '../src/heroes/legend.js';
import { disposeHeroModel, makeHeroModel, play } from '../src/render/characters.js';
import { updateChapterGear } from '../src/render/chapter-gear.js';

const check = (value, message) => { if (!value) throw new Error(message); };
export const render = () => renderer.render(scene, camera);
export function sample() {
  let objects = 0; scene.traverse(() => objects++);
  return { ...renderer.info.memory, programs: renderer.info.programs.length,
    objects, effects: G.lfx.length, fades: G.fxs.length, projectiles: G.projs.length, timers: G.timers.length };
}
export function castCycle(name) {
  check(G.manual && G.pauseRender && G.hero && G.phase === 'build', 'Use an isolated paused test battle');
  check(!G.Snd.cfg.bgmOn && !G.Snd.cfg.sfxOn, 'Mute audio before testing');
  const h = G.hero, saved = { lsk: h.lsk, force: G.legendForce, position: h.g.position.clone() };
  try {
    h.lsk = name; h.lcd = h.licd = 0; G.legendForce = true;
    const at = h.g.position.clone().add(new THREE.Vector3(0, 0, 4));
    if (['frostorb', 'boomerang', 'multishot'].includes(name)) legendProc({ g: { position: at }, dead: false });
    else check(castLegend(at), `Skill did not cast: ${name}`);
    // Render every simulation step: otherwise temporary meshes never allocate GPU resources.
    for (let i = 0; i < 90; i++) { G.sim(.05, .05); render(); }
    G.sim(4, .05); render();
    const result = sample();
    check(result.effects + result.fades + result.projectiles + result.timers === 0, `${name}: unfinished effects`);
    return result;
  } finally { h.lsk = saved.lsk; G.legendForce = saved.force; h.g.position.copy(saved.position); }
}
export function heroCycle(cls = 'mage', withGear = false) {
  check(G.manual && G.pauseRender, 'Use an isolated paused test page');
  const ch = makeHeroModel(cls); ch.g.position.copy(G.hero.g.position); scene.add(ch.g);
  if (withGear) updateChapterGear(ch, ['weapon', 'armor', 'acc'].map((s, i) => ({ s, h: cls, id: `qa-${i}`, set: 'morvia' })));
  play(ch, 'Idle'); ch.mixer.update(.1); render();
  let releasedMaterials = 0; const materials = new Set(ch.mats);
  for (const m of materials) m.addEventListener('dispose', () => releasedMaterials++);
  disposeHeroModel(ch); render();
  check(!ch.g.parent, 'Disposed hero is still in scene');
  check(ch.mixer.stats.actions.total === 0 && ch.mixer.stats.bindings.total === 0, 'Mixer retains disposed hero');
  check(releasedMaterials === materials.size, 'Hero materials not released exactly once');
  return sample();
}
