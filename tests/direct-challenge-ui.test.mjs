// Product result handlers with a minimal DOM, not browser/pixel verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../src/ui/result.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function setup(fail=false){
 const elements=new Map(),memory=new Map(),calls=[];const el=id=>{if(!elements.has(id))elements.set(id,{classList:{add(){},remove(){}},disabled:false,textContent:'',innerHTML:''});return elements.get(id);};
 const G={xpRun:{token:'challenge-ui-token',mode:'challenge',stage:null},wave:21,completedWaves:20,stats:{kills:{grunt:200}},hero:{cls:'mage'},runDrops:[],runBossKills:[5,10,20],phase:'wave',endStatsShow:x=>calls.push(['stats',x])};
 const context={URLSearchParams,location:{search:'?challenge=1&run=1'},G,STAGE:null,Acc:{A:{user:{id:'test'}},sessionId:()=>1,SAVE_WAIT_MESSAGE:'pending'},HG:{onGrowth(){},HG:{rewardXP:{},hardRewards:{}}},directGearEnabled:()=>true,
  runDirectNormal:async input=>{calls.push(['settle',structuredClone(input)]);if(fail)throw Error('lost response');return {ok:true,kind:'challenge',souls:234,best:true,loot:[{chest:true},{src:'essence',essence:1}]};},
  Snd:{play(){},setMusic(){}},ST:{starsFor:()=>0},$:el,go:(x,delay)=>calls.push(['go',x,delay]),sessionStorage:{setItem:(k,v)=>memory.set(k,v)},setTimeout,alert:()=>assert.fail('Unexpected alert'),document:{getElementById:el}};
 vm.createContext(context);vm.runInContext(code,context);return {context,G,el,memory,calls};
}
for(const reason of ['retreat','defeat']){const a=setup();vm.runInContext(`onRunEnd('${reason}')`,a.context);await vm.runInContext('directReturnJob',a.context);await Promise.resolve();
 const input=a.calls.find(x=>x[0]==='settle')[1];assert.equal(input.challenge,true);assert.equal(input.args.p_stars,0);assert.deepEqual(input.args.p_bossKills,[5,10,20]);assert.equal(input.checkpoint.completed,20);assert.equal(input.checkpoint.win,false);
 const last=JSON.parse(a.memory.get('hd3d_live_lastRun'));assert.equal(last.best,true);assert.equal(last.stage,undefined);assert.equal(last.loot.at(-1).essence,1);assert(a.G.runSaved);assert.equal(a.el('overTown').disabled,false);assert.equal(a.calls.filter(x=>x[0]==='go').length,reason==='retreat'?1:0);
}
console.log('PASS actual challenge result handlers use existing result/town flow and retain best/essence data');
const a=setup(true);vm.runInContext("onRunEnd('retreat')",a.context);await vm.runInContext('directReturnJob',a.context);assert.equal(a.G.runSaved,false);assert.equal(a.calls.filter(x=>x[0]==='go').length,0);assert.equal(a.el('overTown').disabled,false);assert.equal(a.el('overReward').textContent,'lost response');assert.equal(a.memory.size,0);
console.log('PASS unknown settlement failure stays in existing result view with retry, without marking saved');
