import assert from 'node:assert/strict';
import {challengeInput,challengePlan,challengeView} from '../src/account/direct-challenge.js';
import {empty,applyRun} from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {authorityOf,authoritativeSave} from '../src/account/direct-authority.js';
const run={token:'challenge-test-token',mode:'challenge',done:true,won:false,hero:'mage',completed:20};
const args=(wave,kills=10,drops=[])=>({p_token:run.token,p_wave:wave,p_kills:kills,p_stars:0,p_drops:drops,p_bossKills:Array.from({length:Math.floor(wave/5)},(_,i)=>(i+1)*5)});
for(const wave of [1,4,5,19,20,21,50,55,4995,10000]){
 const s=empty(),a=args(wave),r={...run,completed:Math.min(wave,9999)},input=challengeInput(a),actual=challengePlan(s,r,input,()=>0),[expected]=applyRun(s,{wave,kills:a.p_kills,drops:[],hero:'mage',stage:false,ch:'open',bossKills:a.p_bossKills},()=>0);
 if(wave===0){/* Zero-wave kills must be zero; covered below instead. */continue;}
 assert.equal(actual.save.souls,expected.souls);assert.equal(actual.save.bestWave,expected.bestWave);assert.deepEqual(actual.save.stats,expected.stats);assert.equal(actual.save.mat.essence||0,expected.mat.essence||0);assert.equal(actual.result.base,Math.floor(wave/5));
}
console.log('PASS original challenge formula, highest wave, 15% essence opportunities and existing 999 boss cap');
const s=empty();s.st['1-6']=3;s.unknown={keep:true};const drops=Array.from({length:11},(_,i)=>{const it=E.makeItem('armor',null,2,()=>.4,i%2+1);it.id='d'+i;return it;});
const result=challengePlan(s,{...run,completed:55},challengeInput(args(55,400,drops)),()=>.9);assert.equal(result.result.drops,11);assert.deepEqual(result.result.unlock,s.st);assert.deepEqual(result.save.unknown,s.unknown);assert.equal(result.result.total,22);assert.equal(challengeView({...result.result,stored:2000}).loot.length,2000);
console.log('PASS more than ten drops, open chapter pool and bounded summary preserve actual reward counts');
for(const bad of [()=>challengeInput({...args(20),p_bossKills:[5,5,10]}),()=>challengeInput({...args(20),p_wave:10001}),()=>challengePlan(s,run,challengeInput(args(20,10,[E.makeItem('armor',null,2,()=>.4,3)])),()=>0),()=>challengePlan(s,{...run,mode:'campaign'},challengeInput(args(20)),()=>0),()=>challengePlan(s,{...run,completed:0},challengeInput(args(0)),()=>0)])assert.throws(bad);
console.log('PASS invalid boss sequence, range, locked chapter, wrong mode and zero-wave kill claims rejected');
for(const original of [empty(),{...empty(),bestWave:123},{legacy:{keep:1}}]){const a=authorityOf(original);assert.deepEqual(authoritativeSave({},a),Object.fromEntries(Object.entries(original).filter(([k])=>!['hero','settings','nick'].includes(k))));}
console.log('PASS bestWave typed roundtrip retains value and absence without changing unknown save data');
