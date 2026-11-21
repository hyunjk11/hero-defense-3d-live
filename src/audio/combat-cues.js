// Short weapon signatures, separate from generic hit/attack SFX.
// [waveform, start Hz, end Hz, offset seconds, duration seconds, peak]
export const COMBAT_CUES = Object.freeze({
  gear_multishot: [['triangle',420,930,0,.09,.17],['triangle',730,1410,.055,.10,.15],['triangle',1050,1620,.11,.11,.14]],
  gear_pierce: [['triangle',1570,510,0,.23,.31],['sine',390,145,0,.15,.20]],
  gear_frostorb: [['sine',1080,1420,0,.26,.24],['triangle',1840,1170,.065,.24,.13]],
  gear_meteorstorm: [['sawtooth',390,59,0,.26,.17],['sine',127,43,.06,.27,.38]],
  gear_boomerang: [['triangle',260,840,0,.14,.24],['triangle',890,280,.115,.23,.25]],
  gear_quake: [['triangle',128,43,0,.31,.46],['sawtooth',220,67,.04,.16,.13]],
  gear_rosebarrage: [['square',370,92,0,.085,.15],['triangle',220,59,0,.16,.39],['sine',2210,1380,.09,.18,.15]],
  gear_pawstorm: [['triangle',840,440,0,.09,.19],['triangle',1020,550,.06,.10,.20],['sine',1320,610,.12,.15,.21]],
  gear_tigerdash: [['sawtooth',680,167,0,.15,.18],['triangle',276,70,.095,.24,.30]],
  awakening_twin_shield: [['sine',523,660,0,.25,.25],['sine',784,988,.06,.32,.21],['triangle',1047,1319,.12,.23,.13]],
  awakening_frost_collapse: [['sine',1880,840,0,.26,.31],['triangle',1380,425,.035,.27,.23],['sine',2910,1300,.08,.14,.13]],
  awakening_cat_impact: [['triangle',370,90,0,.25,.32],['sawtooth',293,68,.03,.16,.12],['sine',1050,470,.1,.17,.19]],
  artillery_call: [['triangle',720,910,0,.105,.24],['triangle',995,1230,.15,.13,.24],['sine',1250,430,.28,.23,.19]],
  artillery_impact: [['triangle',141,38,0,.37,.58],['sawtooth',330,63,0,.14,.21],['sine',480,112,.065,.25,.18]],
});

export function playCombatCue(context, bus, kind, volume, onEnd) {
  const spec = Object.hasOwn(COMBAT_CUES, kind) && COMBAT_CUES[kind];
  if (!spec) return;
  const start = context.currentTime, out = context.createGain(), parts = [];
  out.gain.value = volume;
  out.connect(bus);
  let left = spec.length, closed = false;
  const close = () => { if (!closed) { closed = true; out.disconnect(); onEnd(); } };
  for (const [wave, low, high, offset, duration, peak] of spec) {
    const t = start + offset, end = t + duration, osc = context.createOscillator(), gain = context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(low,t);
    osc.frequency.exponentialRampToValueAtTime(high,end);
    gain.gain.setValueAtTime(0,t);
    gain.gain.linearRampToValueAtTime(peak,t+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,end);
    osc.connect(gain); gain.connect(out);
    const part = {osc, finish() {
      if (part.ended) return; part.ended = true;
      osc.disconnect(); gain.disconnect();
      if (!--left) close();
    }};
    parts.push(part);
    osc.onended = part.finish;
    osc.start(t); osc.stop(end+.01);
  }
  return () => { for (const part of parts) if (!part.ended) { part.osc.stop(); part.finish(); } };
}
