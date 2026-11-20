import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {settingsHtml} from '../src/ui/settings.js';
const read = f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const strip = f=>read(f).replace(/^import .*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=const|function)/g,'');
const AUTO='hd3d_live_autoWave', INSTANT='hd3d_live_autoWaveInstant';
function fixture(values={},stage=null,mobileApp=false) {
 const store=new Map(Object.entries(values)),nodes=new Map(),logs=[],G={t:1,phase:'build',wave:0,coreHp:30,gold:0,stats:{goldEarned:0},classic:true,waveLog:[]};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},addEventListener(k,f){this[k]=f;}});return nodes.get(id);};
 const listeners={},cheers=[]; const hero={hp:5,max:100,dead:0},env=vm.createContext({addEventListener:(k,f)=>listeners[k]=f,G,STAGE:stage,$,hero,mobileApp,ETYPES:{grunt:{},imp:{}},eliteQueue:()=>[],localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
 resolveRuleset:()=>({waveGold:1,enemyHp:1}),waveStart:(_,n,t)=>logs.push(['start',n,t]),waveEnd:(_,t)=>logs.push(['end',G.wave,t]),
 waveBoss:()=>null,rand:()=>0,select:()=>{},Snd:{play(){},duck(){},horn(){}},banner:text=>logs.push(['banner',text]),play:(...args)=>cheers.push(args),computeDist(){},setPhaseUI:()=>{}});
 vm.runInContext(strip('src/core/waves.js')+strip('src/ui/autowave.js')+';this.api={startWave,endWave,updAutoWave};',env);
 G.onXPWave=()=>logs.push(['xp',G.completedWaves]);
 const toggle=(id,checked)=>{const e=$(id);e.checked=checked;e.change();};
 return {G,hero,logs,cheers,setControlled:h=>{env.hero=h;},store,$,toggle,storageEvent:key=>listeners.storage({key,storageArea:env.localStorage}),...env.api};
}
test('checkbox order, default, synchronization, dependency and persistence in both settings panels',()=>{
 for(const [i,p] of ['st','snd'].entries())assert.match(settingsHtml(i),new RegExp(p+'AutoWave"> 다음 웨이브 자동 시작</label><label class="snd sndSub".*?'+p+'AutoWaveInstant"> 즉시 시작</label>'));
 const f=fixture();
 assert.equal(f.$('stAutoWaveInstant').checked,false);assert.equal(f.$('sndAutoWaveInstant').disabled,true);
 f.toggle('stAutoWave',true);assert.equal(f.$('sndAutoWave').checked,true);assert.equal(f.$('sndAutoWaveInstant').disabled,false);
 f.toggle('sndAutoWaveInstant',true);assert.equal(f.$('stAutoWaveInstant').checked,true);
 const reload=fixture(Object.fromEntries(f.store));assert.equal(reload.$('sndAutoWaveInstant').checked,true);
 reload.toggle('sndAutoWave',false);assert.equal(reload.$('stAutoWaveInstant').disabled,true);
 reload.G.wave=1;reload.updAutoWave();assert.equal(reload.G.phase,'build');
 reload.toggle('sndAutoWave',true);reload.toggle('stAutoWaveInstant',false);
 assert.equal(reload.$('sndAutoWaveInstant').checked,false);assert.equal(reload.store.get(INSTANT),'0');
 reload.store.set(INSTANT,'1');reload.storageEvent(INSTANT);assert.equal(reload.$('stAutoWaveInstant').checked,true);
});
test('first daylight remains manual; repeated clears award XP, heal and gold once before next wave starts in the same step',()=>{
 const f=fixture({[AUTO]:'1',[INSTANT]:'1'});f.G.t=100;f.updAutoWave();assert.equal(f.G.wave,0);f.startWave();
 for(const [n,bonus] of [[1,31],[2,37]]){
  f.G.t+=10;f.hero.hp=1;const payout=f.endWave();f.updAutoWave(payout);f.updAutoWave();
  assert.equal(f.G.phase,'wave');assert.equal(f.G.nightTarget,1);assert.equal(f.G.wave,n+1);assert.equal(f.hero.hp,100);
  assert.equal(f.G.completedWaves,n);assert.equal(f.G.autoWaveAt,0);assert.equal(f.$('startWave').dataset.auto,undefined);
  assert.equal(f.logs.at(-1)[1],`웨이브 ${n+1} · +${bonus}G`);
 }
 assert.equal(f.G.gold,68);assert.equal(f.G.stats.goldEarned,68);
 assert.deepEqual(f.logs.filter(a=>a[0]!=='banner'),[['start',1,100],['end',1,110],['xp',1],['start',2,110],['end',2,120],['xp',2],['start',3,120]]);
 const main=read('src/main.js');assert.match(main,/clearBonus = endWave\(\); \}\s+updAutoWave\(clearBonus\);/);assert.ok(main.indexOf('updAutoWave(clearBonus)')<main.indexOf('updLighting(dt);'));
});
test('standard auto still counts fifteen simulation seconds, can be interrupted by toggles or manual start',()=>{
 const f=fixture({[AUTO]:'1'});f.G.wave=1;f.updAutoWave();assert.equal(f.$('startWave').dataset.auto,'15');
 f.G.t+=14.9;f.updAutoWave();assert.equal(f.G.wave,1);assert.equal(f.$('startWave').dataset.auto,'1');
 f.G.t+=.11;f.updAutoWave();assert.equal(f.G.wave,2);assert.equal(f.$('startWave').dataset.auto,undefined);
 f.endWave();f.updAutoWave();f.toggle('sndAutoWaveInstant',true);f.updAutoWave();assert.equal(f.G.wave,3);
 f.endWave();f.toggle('stAutoWaveInstant',false);f.updAutoWave();f.startWave();f.updAutoWave();assert.equal(f.G.wave,4);
 f.endWave();f.toggle('stAutoWave',false);f.G.t+=300;f.updAutoWave();assert.equal(f.G.wave,4);
});
test('never bypass final settlement, loss, pause, navigation, dungeon or practice',()=>{
 const config={[AUTO]:'1',[INSTANT]:'1'},f=fixture(config,{waves:2,hp:1});
 Object.assign(f.G,{wave:2,phase:'wave'});let clear=0;f.G.onStageClear=()=>{clear++;};f.updAutoWave(f.endWave());assert.equal(clear,1);
 assert.equal(f.G.wave,2);assert.equal(f.G.phase,'build'); // defensive cap even while final result callback leaves phase unchanged
 for(const state of [{phase:'over'},{coreHp:0},{paused:true},{navigating:true},{practice:true},{dungeon:true}]){
  const x=fixture(config);Object.assign(x.G,{wave:1},state);x.updAutoWave();assert.equal(x.G.wave,1);assert.equal(x.$('startWave').dataset.auto,undefined);
 }
 const x=fixture(config);Object.assign(x.G,{wave:1,paused:true});x.updAutoWave();x.G.paused=false;x.updAutoWave();assert.equal(x.G.wave,2);
});

function hardPair({hard=true,mobile=false,party=true,reversed=false,practice=false,stage={hard,hp:1,waves:3}}={}){
 const f=fixture({[AUTO]:'1',[INSTANT]:'1'},stage,mobile);const left=Object.assign(f.hero,{hp:5,max:100,ch:'left',atkT:.2,skillCd:2});
 const right={hp:7,max:80,dead:0,ch:'right',atkT:.7,skillCd:4,hardHold:true,path:[]};
 Object.assign(f.G,{heroes:party?[left,right]:[left],hardParty:party?{}:null,phase:'wave',wave:1,practice});
 if(reversed)f.setControlled(right);
 return {...f,left,right};
}
test('PC Hard heals both living heroes with either hero controlled; only the controlled hero cheers',()=>{
 for(const reversed of [false,true]){
  const f=hardPair({reversed});const lead=reversed?f.right:f.left,partner=reversed?f.left:f.right;
  const partnerOrders={atkT:partner.atkT,skillCd:partner.skillCd,hardHold:partner.hardHold,path:partner.path};
  f.updAutoWave(f.endWave());f.updAutoWave();
  assert.equal(f.left.hp,100);assert.equal(f.right.hp,80);
  assert.equal(f.G.wave,2);assert.equal(f.G.phase,'wave');assert.equal(f.G.gold,31);
  assert.equal(f.cheers.length,1);assert.deepEqual(f.cheers[0].slice(0,2),[lead.ch,'Cheer']);assert.equal(lead.atkT,1.5);
  for(const [k,v] of Object.entries(partnerOrders))assert.equal(partner[k],v);
 }
});
test('PC Hard never revives a fallen hero, including the controlled hero; final result sees the recovery',()=>{
 for(const who of ['left','right','both']){
  const f=hardPair(); f.G.wave=3;
  const fallen=[...(who!=='right'?[f.left]:[]),...(who!=='left'?[f.right]:[])];
  for(const h of fallen)Object.assign(h,{hp:0,dead:2.75});
  let visits=0;
  f.G.onStageClear=()=>{visits++;for(const h of [f.left,f.right]){
   assert.equal(h.hp,fallen.includes(h)?0:h.max);assert.equal(h.dead,fallen.includes(h)?2.75:0);
  }};
  f.updAutoWave(f.endWave());assert.equal(visits,1);assert.equal(f.G.wave,3);
  assert.equal(f.cheers.length,fallen.includes(f.left)?0:1);
 }
});
test('mobile Hard, Normal, challenge, solo Hard and practice keep the previous recovery',()=>{
 for(const options of [{mobile:true},{hard:false},{stage:null},{party:false},{practice:true}]){
  const f=hardPair(options);
  f.endWave();
  assert.equal(f.right.hp,7);assert.equal(f.left.hp,options.practice?5:100);
  assert.equal(f.cheers.length,options.practice?0:1);
 }
 const stale=hardPair();stale.G.heroes=[stale.right,{...stale.right}];
 stale.endWave();assert.equal(stale.right.hp,7);
});
