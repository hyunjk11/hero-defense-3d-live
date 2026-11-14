import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/ui/input.js',import.meta.url),'utf8');
const start=source.indexOf('(function sndUI()');
const code=source.slice(start,source.indexOf('})();',start)+5);
function setup(){
  const nodes=Object.fromEntries(['bgmOn','sfxOn','bgmVol','sfxVol','bgMute','sndBtn','sndPanel'].map(id=>{
    const classes=new Set(id==='sndPanel'?['hidden']:[]),events={};
    return [id,{checked:false,value:0,events,classList:{contains:c=>classes.has(c),toggle(c,force){const next=force??!classes.has(c);next?classes.add(c):classes.delete(c);return next;}},addEventListener:(type,fn)=>events[type]=fn}];
  }));
  const cfg={bgmOn:true,sfxOn:true,bgm:.6,sfx:.8,bgMute:true},keys={};let saves=0;
  const Snd={cfg,apply(){},bgSync(){},save(){saves++},play(){},unlock(){}};
  vm.runInNewContext(code,{$:id=>nodes[id],Snd,addEventListener:(type,fn)=>keys[type]=fn});
  return {cfg,nodes,keys,saves:()=>saves};
}
test('opening sound settings reflects late account restore without writing preferences',()=>{
 const x=setup();Object.assign(x.cfg,{bgmOn:false,sfxOn:false,bgm:.23,sfx:.47,bgMute:false});
 const before=JSON.stringify(x.cfg),saves=x.saves();x.nodes.sndBtn.onclick();
 assert.equal(x.nodes.bgmOn.checked,false);assert.equal(x.nodes.sfxOn.checked,false);
 assert.equal(Number(x.nodes.bgmVol.value),23);assert.equal(Number(x.nodes.sfxVol.value),47);assert.equal(x.nodes.bgMute.checked,false);
 assert.equal(x.nodes.sndBtn.classList.contains('muted'),true);
 assert.equal(JSON.stringify(x.cfg),before);assert.equal(x.saves(),saves);
});
test('mute shortcut after restore preserves volume/background preferences',()=>{
 const x=setup();Object.assign(x.cfg,{bgmOn:false,sfxOn:false,bgm:.23,sfx:0,bgMute:false});
 x.keys.keydown({key:'m',repeat:false});assert.deepEqual(x.cfg,{bgmOn:true,sfxOn:true,bgm:.23,sfx:0,bgMute:false});
 const saves=x.saves();x.keys.keydown({key:'m',repeat:true});assert.equal(x.saves(),saves);
 x.keys.keydown({key:'M',repeat:false});assert.equal(x.cfg.sfxOn,false);assert.equal(x.cfg.bgmOn,false);assert.equal(x.cfg.sfx,0);
});
test('explicit edits retain restored values in other controls',()=>{
 const x=setup();Object.assign(x.cfg,{bgmOn:false,sfxOn:false,bgm:.19,sfx:.37,bgMute:false});
 x.nodes.sndBtn.onclick();x.nodes.sfxOn.checked=true;x.nodes.sfxOn.events.input();
 assert.deepEqual(x.cfg,{bgmOn:false,sfxOn:true,bgm:.19,sfx:.37,bgMute:false});
 x.nodes.sfxVol.value=0;x.nodes.sfxVol.events.input();assert.equal(x.cfg.sfx,0);
});
test('reopening reflects another account and legacy background default without writing',()=>{
 const x=setup();x.nodes.sndBtn.onclick();x.nodes.sndBtn.onclick();Object.assign(x.cfg,{bgmOn:false,sfxOn:true,bgm:.11,sfx:.52});delete x.cfg.bgMute;
 const saves=x.saves(),before=JSON.stringify(x.cfg);x.nodes.sndBtn.onclick();
 assert.equal(x.nodes.bgmOn.checked,false);assert.equal(Number(x.nodes.sfxVol.value),52);assert.equal(x.nodes.bgMute.checked,true);
 assert.equal(x.saves(),saves);assert.equal(JSON.stringify(x.cfg),before);
});
