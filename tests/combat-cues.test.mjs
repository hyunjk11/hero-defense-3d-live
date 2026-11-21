import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { COMBAT_CUES, playCombatCue } from '../src/audio/combat-cues.js';
import { LSK } from '../src/account/equip.js';
import { fixture } from './support/advance-e-runtime.mjs';

test('every available gear proc sounds once per successful trigger, and mobile retains its old audio',()=>{
  const gears=Object.entries(LSK).filter(([key,s])=>s.h!=='mechanic'&&key!=='ricochet');
  for(const [key,s] of gears) for(const mobile of [false,true]) {
    const f=fixture(s.h,null,50,null,null,mobile), cues=[];
    f.env.Snd.combatCue=k=>cues.push(k);
    const t=f.target();
    f.hero.lsk=key;
    f.api.legendProc(t,{mode:'melee'});
    f.api.legendProc(t,{mode:'melee'}); // cooldown prevents a second sound
    assert.deepEqual(cues,mobile?[]:['gear_'+key],key);
    assert.ok(Object.hasOwn(COMBAT_CUES,'gear_'+key));
  }
});
test('artillery sounds once at mark and once at a live strike, never after a stale battle',()=>{
  for(const stale of [false,true]){
    const f=fixture('gunner'), cues=[];
    f.env.Snd.combatCue=k=>cues.push(k);
    f.hero.lsk='ricochet'; f.G.wave=3;
    f.api.legendProc(f.target());
    assert.deepEqual(cues,['artillery_call']);
    f.tick(.45);assert.deepEqual(cues,['artillery_call']);
    if(stale)f.G.phase='over';
    f.tick(.12);assert.deepEqual(cues,stale?['artillery_call']:['artillery_call','artillery_impact']);
  }
});
test('PC awakening accents sound at actual share, freeze or first cat contact only',()=>{
  for(const [hero,branch,cue] of [
    ['warrior','paladin','awakening_twin_shield'],['mage','frost','awakening_frost_collapse'],
    ['fighter','dragon','awakening_cat_impact']
  ]) for(const mobile of [false,true]) {
    const f=fixture(hero,branch,50,null,null,mobile), cues=[];
    f.env.Snd.combatCue=k=>cues.push(k); f.hero.awakeningLevel=0;
    const g=new f.THREE.Group();g.position.set(1,0,1);f.scene.add(g);
    f.G.heroes.push({g,hp:100,max:100,ch:{},dead:0});
    f.target(0,2);f.target(0,3);f.api.castLegend(new f.THREE.Vector3(0,0,3));
    assert.deepEqual(cues,[]);
    f.tick(6); assert.deepEqual(cues,mobile?[]:[cue]);
  }
  const f=fixture('fighter','dragon'),cues=[];f.env.Snd.combatCue=k=>cues.push(k);f.hero.awakeningLevel=0;
  f.api.castLegend(new f.THREE.Vector3(0,0,3));f.tick(2);assert.deepEqual(cues,[]);
});
function audioContext(){
 const nodes=[],param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>{const n={frequency:param(),gain:param(),connect(){},disconnect(){this.disconnected=(this.disconnected||0)+1;},start(t){this.startTime=t;},stop(){}};nodes.push(n);return n;};
 return {nodes,currentTime:1,state:'running',createOscillator:node,createGain:node};
}
test('PC cues use bounded reserved slots, disconnect, and respect volume and background mute',()=>{
  const src=fs.readFileSync(new URL('../src/audio/audio.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace('export const Snd','const Snd');
  const c=audioContext(), env=vm.createContext({COMBAT_CUES,playCombatCue,localStorage:{getItem:()=>null},fetch:()=>Promise.resolve({ok:false}),document:{addEventListener(){}},window:{addEventListener(){}},addEventListener(){},setTimeout(){}});
  vm.runInContext(src+';this.Snd=Snd;',env);
  const s=env.Snd; s.ctx=c;s.sfxG={};s.voices=31;
  for(const mode of ['off','zero','background','suspended']){
    s.cfg.sfxOn=mode!=='off';s.cfg.sfx=mode==='zero'?0:1;s.bg.muted=mode==='background';c.state=mode==='suspended'?'suspended':'running';
    assert.equal(s.combatCue('artillery_impact'),undefined);assert.equal(c.nodes.length,0);
  }
  c.state='running';
  const stopped=Object.keys(COMBAT_CUES).slice(0,4).map(k=>s.combatCue(k,{x:100,z:100}));
  assert.equal(s.voices,35);assert.equal(s.combatCue('artillery_impact'),undefined);
  assert.equal(s.combatCue(Object.keys(COMBAT_CUES)[0]),undefined);
  for(const stop of stopped){stop();stop();}
  assert.equal(s.voices,31);assert.equal(s.combatCueVoices,0);assert.ok(c.nodes.every(n=>n.disconnected===1));
});
