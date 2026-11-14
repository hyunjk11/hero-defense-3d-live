// Run in a disposable, memory-only localhost review profile while in town.
// Exercises the actual UI handlers, including renderer frames, not just dispose().
export async function checkTownMenuLifetime(cycles = 12) {
  if (!['localhost', '127.0.0.1'].includes(location.hostname) || !window.__isolatedReview?.memoryOnly) throw Error('Use an isolated memory-only review profile');
  const { G } = await import('../src/core/state.js');
  const { renderer } = await import('../src/render/scene.js');
  if (G.screen !== 'town') throw Error('Enter town before running the check');
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const samples = [];
  for (let i = 0; i <= cycles; i++) {
    await frame(); samples.push({ ...renderer.info.memory, programs: renderer.info.programs.length });
    if (i === cycles) break;
    document.getElementById('twMenu').click(); if (G.screen !== 'menu') throw Error('Menu transition failed');
    const resume = document.getElementById('mnCont');
    (resume.disabled ? document.getElementById('mnNew') : resume).click();
    if (G.screen !== 'town') throw Error('Town transition failed');
  }
  const stable = samples.slice(1), first = stable[0];
  if (!stable.every(x => x.geometries === first.geometries && x.textures === first.textures && x.programs === first.programs)) throw Error('Town/menu resources grew: ' + JSON.stringify(samples));
  return { cycles, samples };
}
