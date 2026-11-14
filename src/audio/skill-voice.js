// Short deterministic accents. No samples, timers or game/random state are consumed.
export const SKILL_VOICES = Object.freeze({
  legend_pierce:['triangle',1240,360,.15,.16], legend_meteorstorm:['sine',620,1240,.24,.18],
  legend_quake:['sawtooth',130,32,.18,.17], legend_rosebarrage:['triangle',750,170,.12,.17], legend_tigerdash:['triangle',310,60,.16,.21],
  wind:['sine',880,320,.14,.16], hawk:['triangle',1400,180,.2,.25],
  flame:['sawtooth',150,45,.26,.13], frost:['sine',1800,700,.24,.17],
  paladin:['sine',520,1040,.32,.23], berserk:['sawtooth',240,65,.16,.16],
  duel:['triangle',420,80,.1,.2], thorn:['sawtooth',180,38,.25,.2], tiger:['triangle',210,55,.13,.27]
});
export function skillVoice(context, destination, kind, onEnd=()=>{}) {
  const spec=SKILL_VOICES[kind]; if(!spec) return null;
  const [type,from,to,duration,volume]=spec,t=context.currentTime,o=context.createOscillator(),g=context.createGain();
  o.type=type; o.frequency.setValueAtTime(from,t); o.frequency.exponentialRampToValueAtTime(to,t+duration);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(volume,t+.006); g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(destination);let ended=false;
  const clean=()=>{if(ended)return;ended=true;o.disconnect();g.disconnect();onEnd();};
  o.onended=clean;o.start(t);o.stop(t+duration+.015);
  return ()=>{if(!ended){try{o.stop();}finally{clean();}}};
}
