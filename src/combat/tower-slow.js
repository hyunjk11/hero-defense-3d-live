// Tower chain slows have independent lifetimes. Never write the combined value
// back to legacy hero slowT/slowAmt: their refresh logic would extend tower frost.
export function applyTowerSlow(enemy, amount, duration) {
  if (!enemy || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(duration) || duration <= 0) return;
  const effects = enemy.towerSlows ||= [];
  const same = effects.find(effect => effect.amount === amount);
  if (same) same.time = Math.max(same.time, duration);
  else effects.push({ amount, time: duration });
}
export function tickTowerSlow(enemy, dt) {
  const effects = enemy.towerSlows;
  if (!effects || !(dt > 0)) return;
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].time -= dt;
    if (effects[i].time <= 1e-9) effects.splice(i, 1);
  }
  if (!effects.length) delete enemy.towerSlows;
}
// Allocation-free hot-path read: normal enemy movement never creates status objects.
export function enemySlowAmount(enemy) {
  let amount = enemy.slowT > 0 ? enemy.slowAmt || .45 : 0;
  const effects = enemy.towerSlows;
  if (effects) for (let i = 0; i < effects.length; i++) {
    if (effects[i].time > 0 && effects[i].amount > amount) amount = effects[i].amount;
  }
  return amount;
}
// Pure read shared by movement and status UI; existing hero slow semantics stay intact.
export function enemySlow(enemy) {
  let amount = enemy.slowT > 0 ? enemy.slowAmt || .45 : 0;
  let time = amount > 0 ? enemy.slowT : 0;
  const effects = enemy.towerSlows;
  if (effects) for (const effect of effects) {
    if (!(effect.time > 0)) continue;
    if (effect.amount > amount) { amount = effect.amount; time = effect.time; }
    else if (effect.amount === amount) time = Math.max(time, effect.time);
  }
  return { amount, time };
}
