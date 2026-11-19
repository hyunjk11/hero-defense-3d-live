import { $ } from '../core/util.js';
import { G } from '../core/state.js';
import { BRANCH, canSpecialize } from '../data/growth.js';
import { chooseBranch } from '../world/growth.js';

let shownTower = null;

export function renderBranch(tower) {
  const next = tower?.kind === 'tower' && canSpecialize(tower) ? tower : null;
  // Keep buttons stable during HUD ticks so a press cannot lose its target.
  if (shownTower === next) return;
  shownTower = next;
  const el = $('tBranch');
  if (el.contains(document.activeElement)) document.activeElement.blur();
  el.replaceChildren();
  el.classList.toggle('hidden', !next);
  if (!next) return;
  for (const [key, branch] of Object.entries(BRANCH[next.type])) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tBranchChoice';
    button.dataset.branch = key;
    button.style.setProperty('--branch-color', branch.c);
    button.innerHTML = `<span aria-hidden="true">${branch.icon}</span><b>${branch.n}</b>`;
    button.onclick = e => {
      e.stopPropagation();
      // Detached buttons cannot specialize a previously selected tower.
      if (G.sel === next && shownTower === next) chooseBranch(next, key);
    };
    el.append(button);
  }
}
