import { G } from '../core/state.js';
import { clearOrders } from '../data/hard-party.js';
import { withHero } from '../heroes/hero.js';
import { runSupportAI } from '../heroes/hard-party.js';

// At most one controlled-hero tactical decision per interval. Reuse native
// support movement, aim and skill checks; neither force casts nor touch gold,
// cooldowns, equipment proc chances or the existing Hard partner AI.
const THINK = .45;
let active = null;

export function clearStageAutoCombat() {
  const old = active;
  active = null;
  if (!old || old.h !== G.hero || old.stage !== G.stage || old.tiles !== G.tiles) return;
  // A manual move after the last decision may have replaced this array.
  // Release only the auto-owned path/focus, never a newer manual order.
  if (old.h.path === old.path) clearOrders(old.h);
  else {
    if (old.h.aiTgt === old.focus) old.h.aiTgt = null;
    if (old.h.aiGoal === old.goal) old.h.aiGoal = null;
    old.h.aiT = 0;
  }
}

export function runStageAutoCombat(dt) {
  if (G.phase !== 'wave' || G.screen === 'town' || G.practice || G.dungeon || !G.stage) {
    clearStageAutoCombat();
    return false;
  }
  if (G.paused || G.navigating || G.chooseWait || G.coreHp <= 0 || !G.hero) return false;
  const h = G.hero;
  if (!active || active.h !== h || active.stage !== G.stage || active.tiles !== G.tiles) {
    // A previously controlled Hard ally is managed by the native party AI
    // again once the user changes the controlled hero.
    clearStageAutoCombat();
    active = { h, stage:G.stage, tiles:G.tiles, until:0 };
  }
  if (!Number.isFinite(dt) || dt <= 0 || h.dead > 0 || h.warpT > 0) return false;
  active.until -= dt;
  if (active.until > 0) return false;
  active.until = THINK;
  // Support AI owns its own cadence for noncontrolled heroes. The controller
  // above schedules this particular hero; do not start another AI scan.
  h.aiT = 0;
  withHero(h, () => runSupportAI(h, dt));
  Object.assign(active,{path:h.path,focus:h.aiTgt,goal:h.aiGoal});
  return true;
}
