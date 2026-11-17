import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function storage(data={}) { const m=new Map(Object.entries(data)); return {get length(){return m.size},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}; }
const local=storage({save:'original',reward:'5'}),session=storage({snapshot:'original'});
const ctx={window:{localStorage:local,sessionStorage:session},location:{search:'?practice=1'},URLSearchParams};
vm.runInNewContext(read('src/practice-storage.js'),ctx);
assert.equal(ctx.window.practiceStorageReady,true);
ctx.window.localStorage.setItem('save','changed');ctx.window.localStorage.removeItem('reward');ctx.window.sessionStorage.clear();
assert.equal(local.getItem('save'),'original');assert.equal(local.getItem('reward'),'5');assert.equal(session.getItem('snapshot'),'original');
assert.equal(ctx.window.localStorage.getItem('save'),'changed');
const again={window:{localStorage:local,sessionStorage:session},location:{search:'?practice=1&stage=H10-6&dungeon=1'},URLSearchParams};
vm.runInNewContext(read('src/practice-storage.js'),again);assert.equal(again.window.localStorage.getItem('save'),'original');
const normal={window:{localStorage:local,sessionStorage:session},location:{search:'?town=1'},URLSearchParams};
vm.runInNewContext(read('src/practice-storage.js'),normal);assert.equal(normal.window.localStorage,local);
const nav=read('src/core/nav.js').replaceAll('export ','');
const nctx={URLSearchParams};vm.createContext(nctx);vm.runInContext(nav+';globalThis.navQuery=navQuery;',nctx);
assert.equal(new URLSearchParams(nctx.navQuery('?practice=1&stage=1-1',{town:1})).has('practice'),false);
assert.equal(new URLSearchParams(nctx.navQuery('?stage=1-1&run=1',{practice:true})).get('practice'),'1');
assert.equal(new URLSearchParams(nctx.navQuery('?stage=1-1&run=1',{practice:true})).has('stage'),false);
const firebase=read('src/account/firebase-client.js');assert(firebase.indexOf("get('practice')")<firebase.indexOf('const sdk ='));
const flow=read('src/ui/flow.js');assert(flow.indexOf("void startPractice()")<flow.indexOf('const resultInput='));
const practice=read('src/ui/practice.js');assert(!practice.includes('Acc.update'));assert(!practice.includes('startRun('));assert(!practice.includes('checkpoint('));assert(!practice.includes('autoLogin('));
assert.match(read('src/core/waves.js'),/function endWave\(\) \{ if \(G.practice\) return/);
assert.match(read('src/ui/result.js'),/export function onRunEnd\(reason\) \{\s*if \(G.practice/);
// Exercise active timer, spawn cap, 30-second terminal state, repeated finish, and no-state invalid entry.
let src=practice.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{id,textContent:'',classList:{values:new Set(),add(k){this.values.add(k)},remove(k){this.values.delete(k)},contains(k){return this.values.has(k)}},style:{}});return nodes.get(id);};
const G={practice:true,phase:'build',hero:{},enemies:[],stats:{kills:{golem:2}},spawnEnemy(){G.spawns=(G.spawns||0)+1;}};
const rctx={CORE:[22,7],tileX:x=>x,tileZ:z=>z,G,$:node,document:{createElement:()=>({style:{}}),body:{appendChild(){}}},Object,Math,Set,JSON,CLASSES:{mage:{}},isHidden:()=>false,startHardParty:()=>{},go:()=>{},reload:()=>{}};
vm.createContext(rctx);vm.runInContext(src+';run={party:["mage"]};globalThis.tick=updatePractice;globalThis.finish=finish;',rctx);
rctx.tick(.05);
assert.equal(node('phase').textContent,'연습 중 · 무보상');
assert.equal(node('startWave').disabled,true);
assert.equal(node('startWave').classList.contains('hidden'),true);
assert.equal(node('wavePrev').classList.contains('hidden'),true);
for(let i=0;i<600;i++)rctx.tick(.05);
assert.equal(G.phase,'over');assert.equal(node('phase').textContent,'연습 종료');assert.equal(node('startWave').disabled,true);assert(G.spawns>0);assert.equal(G.wave,1);const count=G.spawns;rctx.finish();rctx.tick(1);assert.equal(G.spawns,count);
console.log('practice isolation, URL precedence, API boundary, timer and repeated exit: passed');
// Execute production reward guards rather than just checking their spelling.
let rewardWrites=0, storageWrites=0;
const guards={G:{practice:true,phase:'wave'},location:{search:'?practice=1'},URLSearchParams,
  Acc:{update(){rewardWrites++},flush(){rewardWrites++}},HG:{checkpoint(){rewardWrites++}},
  localStorage:{setItem(){storageWrites++}},setTimeout(){rewardWrites++}};
vm.createContext(guards);
const waves=read('src/core/waves.js');
for(const name of ['startWave','endWave','gameOver']) {
 const start=waves.indexOf('function '+name+'(');let open=waves.indexOf('{',start),depth=1,i=open+1;
 // Function bodies have template literals, but their interpolation braces are balanced.
 for(;depth&&i<waves.length;i++){if(waves[i]==='{')depth++;if(waves[i]==='}')depth--;}
 vm.runInContext(waves.slice(start,i)+`;globalThis.${name}=${name};`,guards);
}
guards.G.endPractice=()=>{};
for(let i=0;i<3;i++){guards.startWave();guards.endWave();guards.gameOver();}
const result=read('src/ui/result.js');
for(const name of ['onRunEnd']){
 const start=result.indexOf('export function '+name+'(')+7;let open=result.indexOf('{',start),depth=1,i=open+1;
 for(;depth&&i<result.length;i++){if(result[i]==='{')depth++;if(result[i]==='}')depth--;}
 vm.runInContext(result.slice(start,i)+`;globalThis.${name}=${name};`,guards);
 guards.onRunEnd('clear');guards.onRunEnd('retreat');guards.onRunEnd('defeat');
 guards.G.practice=false;guards.onRunEnd('clear');
}
assert.equal(rewardWrites,0);assert.equal(storageWrites,0);
console.log('production wave/end/retreat guards: zero reward and storage writes');

// Production snapshot builder must preserve selected trees for legacy and current advancement records.
const AD = await import('../src/data/advance.js');
const {treeBuild} = await import('../src/data/skill-tree.js');
const saves = ['flame', {b:'flame',n:1}].map(adv => ({hero:'mage',heroLv:{mage:{hp:3,atk:4}},adv:{mage:adv},growth:{trees:{mage:{flame:{active:1,presets:[{15:'wide'},{15:'dense'}]}}}},research:{}}));
const outputs=[];
for (const save of saves) {
  const before=JSON.stringify(save), mem=storage();
  const c={HG:{viewSave:()=>save,level:()=>20,available:()=>true},E:{bonus:()=>({}),legendOf:()=>null,equippedItems:()=>[]},AD,SX:{barLv:()=>0,barMul:()=>1},treeBuild,readPartner:()=>{throw Error('Practice must not read a partner preference');},sessionStorage:mem};
  vm.createContext(c);vm.runInContext(src+';globalThis.prepare=preparePractice;',c);c.prepare();
  const snapshot=JSON.parse(mem.getItem('hd3d_live_practice_snapshot_v1'));
  assert.deepEqual(snapshot.party,['mage']);assert.deepEqual(Object.keys(snapshot.loadouts),['mage']);
  assert.equal(snapshot.loadouts.mage.heroTree.branch,'flame');
  assert.equal(snapshot.loadouts.mage.heroTree.preset,1);
  assert.equal(snapshot.loadouts.mage.heroTree.choices[15],'dense');
  assert.equal(JSON.stringify(save),before);outputs.push(snapshot);
}
assert.deepEqual(outputs[0],outputs[1]);
console.log('legacy/current advancement snapshots retain identical active tree choices');

// Settings mount must precede practice's select/input module dependency graph.
const main=read('src/main.js');
assert(main.indexOf("import './ui/settings.js'")<main.indexOf("import { updatePractice }"));

// A retry from the previous two-hero release is also solo, without mutating its stored snapshot.
const legacy={party:['mage','archer'],loadouts:{mage:{heroLevel:20},archer:{heroLevel:10}},growthEnabled:true};
const legacyCtx={CLASSES:{mage:{},archer:{}},isHidden:()=>false};
vm.createContext(legacyCtx);vm.runInContext(src+';globalThis.solo=soloRun;',legacyCtx);
const beforeLegacy=JSON.stringify(legacy),one=legacyCtx.solo(legacy);
assert.deepEqual(Array.from(one.party),['mage']);assert.deepEqual(Object.keys(one.loadouts),['mage']);assert.equal(JSON.stringify(legacy),beforeLegacy);
assert.equal(legacyCtx.solo({party:['missing'],loadouts:{missing:{}}}),null);
assert(!practice.includes('startHardParty'));assert(!practice.includes('readPartner'));
// The production clock uses real active-frame time, not capped simulation time or speed multipliers.
const clockG={practice:true,phase:'build',hero:{},enemies:[],stats:{kills:{}},spawnEnemy(){}};
const clockContext={...rctx,G:clockG};vm.createContext(clockContext);vm.runInContext(src+';run={party:["mage"]};globalThis.tick=updatePractice;',clockContext);
clockContext.tick(.05,1);assert.equal(node('practiceSeconds').textContent,'29');
clockContext.tick(.05,0);assert.equal(node('practiceSeconds').textContent,'29');
clockContext.tick(.05,4);assert.equal(node('practiceSeconds').textContent,'25');
clockContext.tick(.05,25);assert.equal(clockG.phase,'over');assert.match(node('practicePanel').innerHTML,/id="practiceSeconds">0/);
assert.match(main,/step\(dt, i === 0 \? raw : 0\)/);assert.match(main,/updatePractice\(dt, practiceClockDt\)/);
assert.match(read('style.css'),/#practicePanel\{position:fixed;top:/);
assert.match(read('style.css'),/#practiceSeconds\{font-size:36px/);
console.log('solo snapshots, legacy retry, visible countdown and real-time speed-independent clock: passed');

assert.match(read('style.css'),/body\.practiceRun #camTop\{top:calc\(164px/);
