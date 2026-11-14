// Bright "pyoong" cast cue, as an explicit alternative to the indistinct synthetic meow.
// A short triangle sweep keeps a clear onset and body without a piercing noise layer.
// Caller owns activation/mute/volume. Every node is disconnected at completion/cancel.
export function catVoice(context,destination,onEnd=()=>{}) {
  const t=context.currentTime,voice=context.createOscillator(),gain=context.createGain();
  voice.type='triangle';
  voice.frequency.setValueAtTime(540,t);voice.frequency.exponentialRampToValueAtTime(1320,t+.025);voice.frequency.exponentialRampToValueAtTime(420,t+.22);voice.frequency.exponentialRampToValueAtTime(260,t+.44);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.48,t+.008);gain.gain.linearRampToValueAtTime(.3,t+.09);gain.gain.exponentialRampToValueAtTime(.001,t+.44);
  voice.connect(gain);gain.connect(destination);let ended=false;
  const clean=()=>{if(ended)return;ended=true;voice.disconnect();gain.disconnect();onEnd();};
  voice.onended=clean;voice.start(t);voice.stop(t+.46);
  return ()=>{if(!ended){try{voice.stop();}finally{clean();}}};
}
