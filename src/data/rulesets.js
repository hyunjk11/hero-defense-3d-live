// Future difficulty modes must supply their own rules and versioned save namespace.
// Only the standard rule set is registered; unknown/legacy requests resolve to standard.
export const RULESETS = Object.freeze({ standard: Object.freeze({ id: 'standard', version: 1, enemyHp: 1, waveGold: 1, reward: 1 }) });
export const resolveRuleset = id => RULESETS[id] || RULESETS.standard;
export const SPIRE_ELITE = Object.freeze({ hp: 2.5, scale: 1.25 });
