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
const src=practice.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
const G={practiceSandbox:true,phase:'build',hero:{},enemies:[],spawnQ:[]};
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='practicePreset'?'normal':'1',classList:{toggle(){}}});return nodes.get(id);};
const rctx={G,$:node,document:{body:{classList:{toggle(){}}}},getStage:()=>null,
  practiceWave:()=>({queue:['grunt'],elites:null,hp:1}),pendingSpawns:()=>false,select:()=>{}};
vm.createContext(rctx);vm.runInContext(src+';this.tick=updatePractice;this.start=startSandboxWave;',rctx);
for(let i=0;i<3000;i++)rctx.tick();
assert.equal(G.phase,'build');assert.deepEqual(G.spawnQ,[]);
G.paused=true;rctx.start();assert.equal(G.phase,'build');G.paused=false;
rctx.start();assert.equal(G.phase,'wave');assert.deepEqual(G.spawnQ,['grunt']);
rctx.start();assert.equal(G.spawnQ.length,1);
G.spawnQ=[];G.enemies=[{}];rctx.tick();assert.equal(G.phase,'wave');
G.enemies=[];rctx.tick();assert.equal(G.phase,'build');rctx.start();assert.equal(G.phase,'wave');
assert.doesNotMatch(practice,/practiceClock|practiceSeconds|30초|soloRun/);
// Native online alias survives both directions without leaking a combat flag.
assert.equal(new URLSearchParams(nctx.navQuery('?town=1&mobileApp=1',{practice:true})).get('mobileApp'),'1');
assert.equal(new URLSearchParams(nctx.navQuery('?practice=1&mobileApp=1',{town:1})).get('mobileApp'),'1');
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
const {VISIBLE_HEROES,DEFAULT_HERO} = await import('../src/data/heroes.js');
const {treeBuild} = await import('../src/data/skill-tree.js');
const saves = ['flame', {b:'flame',n:1}].map(adv => ({hero:'mage',heroLv:{mage:{hp:3,atk:4}},adv:{mage:adv},growth:{trees:{mage:{flame:{active:1,presets:[{15:'wide'},{15:'dense'}]}}}},research:{}}));
const outputs=[];
for (const save of saves) {
  const before=JSON.stringify(save), mem=storage();
  const c={VISIBLE_HEROES,DEFAULT_HERO,awakeningLevel:()=>null,beamAttackBonus:()=>0,HG:{viewSave:()=>save,level:()=>20,available:()=>true,awakeningSkill:()=>false},E:{bonus:()=>({}),legendOf:()=>null,equippedItems:()=>[]},AD,SX:{barLv:()=>0,barMul:()=>1},treeBuild,readPartner:()=>{throw Error('Practice must not read a partner preference');},sessionStorage:mem};
  vm.createContext(c);vm.runInContext(src+';globalThis.prepare=preparePractice;',c);c.prepare();
  const snapshot=JSON.parse(mem.getItem('hd3d_live_practice_snapshot_v1'));
  assert.deepEqual(snapshot.party,['mage',...VISIBLE_HEROES.filter(x=>x!=='mage')]);assert.deepEqual(Object.keys(snapshot.loadouts),snapshot.party);
  assert.equal(snapshot.loadouts.mage.heroTree.branch,'flame');
  assert.equal(snapshot.loadouts.mage.heroTree.preset,1);
  assert.equal(snapshot.loadouts.mage.heroTree.choices[15],'dense');
  assert.equal(JSON.stringify(save),before);outputs.push(snapshot);
}
assert.deepEqual(outputs[0],outputs[1]);
console.log('legacy/current advancement snapshots retain identical active tree choices');

// Settings mount must precede practice's select/input module dependency graph.
const main=read('src/main.js');
assert(main.indexOf("import './ui/settings.js'")<main.indexOf("import { updatePractice,"));

const legacy={party:['mage','archer'],loadouts:{mage:{heroLevel:20},archer:{heroLevel:10}}};
const legacyCtx=vm.createContext({VISIBLE_HEROES});vm.runInContext(src+';this.validate=valid;',legacyCtx);
assert.equal(legacyCtx.validate(legacy),false);
assert.equal(legacyCtx.validate(outputs[0]),true);
assert(!practice.includes('startHardParty'));assert(!practice.includes('readPartner'));
