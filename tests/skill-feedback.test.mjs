import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {createSkillCues,fixture} from './support/advance-e-runtime.mjs';
import {skillVoice,SKILL_VOICES} from '../src/audio/skill-voice.js';
test('pooled cues cap simultaneous effects, consume no runtime RNG, expire and clear only their owner',()=>{
 const scene=new THREE.Scene(),pool=createSkillCues(scene,8),a={},b={},random=Math.random;let calls=0;Math.random=()=>{calls++;return .5;};
 try{for(let i=0;i<8;i++)assert.equal(pool.show(i%2?a:b,'impact',{x:1,y:2,z:3},0xffffff),true);
 assert.equal(pool.show(a,'aim',{x:0,y:0,z:0},1),false);assert.equal(pool.active(),8);pool.clear(a);assert.equal(pool.active(),4);pool.update(b,1);assert.equal(pool.active(),0);assert.equal(scene.children.length,0);assert.equal(calls,0);
 }finally{Math.random=random;pool.dispose();}
});
test('nine E accents match real fire count; frost/flame onset and final tick only; cat cue remains separate',()=>{
 for(const [h,b,count] of [['archer','wind',1],['archer','hawk',1],['mage','flame',2],['mage','frost',2],['warrior','paladin',1],['warrior','berserk',2],['gunner','duel',6],['gunner','thorn',1],['fighter','tiger',3],['fighter','dragon',0]]){
  const f=fixture(h,b),calls=[];f.env.Snd.skill=k=>calls.push(k)&&(()=>{});f.target(0,2);f.api.castLegend(new THREE.Vector3(0,0,2));f.tick(9);assert.equal(calls.length,count,b);assert.ok(calls.every(k=>k===b));assert.equal(f.cues.active(),0);assert.equal(f.scene.children.length,1);
 }
});
const context=()=>{const nodes=[],param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>{const n={frequency:param(),gain:param(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.onended?.();}};nodes.push(n);return n;};return {nodes,currentTime:1,state:'running',createOscillator:node,createGain:node};};
test('every deterministic voice disconnects once on completion/cancel, no random or timers',()=>{
 for(const kind of Object.keys(SKILL_VOICES)){let ended=0;const c=context(),random=Math.random;Math.random=()=>{throw Error('audio RNG');};try{const stop=skillVoice(c,{},kind,()=>ended++);stop();assert.equal(ended,1);assert.ok(c.nodes.every(n=>n.disconnected));}finally{Math.random=random;}}
});
test('audio respects activation, suspension, SFX mute, volume, background mute, rate and voice budget',()=>{
 const src=fs.readFileSync(new URL('../src/audio/audio.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace('export const Snd','const Snd');
 const box=vm.createContext({SKILL_VOICES,skillVoice,catVoice(){},localStorage:{getItem:()=>null},fetch:()=>Promise.resolve({ok:false}),document:{addEventListener(){}},window:{addEventListener(){}},addEventListener(){},setTimeout(){}});
 vm.runInContext(src+';this.Snd=Snd;',box);const s=box.Snd;
 for(const mode of ['unactivated','suspended','off','volume','background','voices']){
  const c=context();s.ctx=mode==='unactivated'?null:c;s.sfxG={};s.last={};s.voices=mode==='voices'?24:0;s.cfg.sfx=mode==='volume'?0:1;s.cfg.sfxOn=mode!=='off';s.bg.muted=mode==='background';if(mode==='suspended')c.state='suspended';s.skill('thorn',{x:0,z:0});assert.equal(c.nodes.length,0,mode);
 }
 const c=context();s.ctx=c;s.voices=0;s.cfg.sfx=1;s.cfg.sfxOn=true;s.bg.muted=false;s.last={};s.skill('thorn',{x:0,z:0});const n=c.nodes.length;assert.ok(n>0);s.skill('thorn');assert.equal(c.nodes.length,n);assert.equal(s.voices,0);
});
