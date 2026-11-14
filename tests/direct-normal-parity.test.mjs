import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {STAGES} from '../src/data/stages.js';
import {seeded} from '../src/account/rewarditems.js';
import {normalPlan,normalChest} from '../src/account/direct-normal.js';
const originalNow=Date.now;Date.now=()=>1793790000000;
let cases=0;
try{
 for(const stage of Object.values(STAGES))for(const repeat of [false,true]){
  const before=P.empty();before.st=Object.fromEntries(Object.keys(STAGES).map(k=>[k,3]));if(!repeat)delete before.st[stage.id];before.starRw=Math.floor(Object.values(before.st).reduce((a,b)=>a+b,0)/5);
  const kills=123,wave=stage.waves,hero='mage',target=repeat?'gunner':null,r1=seeded(stage.id+repeat),r2=seeded(stage.id+repeat);
  const [oldRun]=P.applyRun(before,{wave,kills,hero,stage:true,ch:stage.ch,repeatTarget:target,repeatStage:stage.id,repeatWin:true},r1);
  const [oldSave]=P.applyStage(oldRun,stage.id,3,hero,r1);
  const run={stage:stage.id,hero,mode:'campaign',done:true,won:true,completed:wave,repeat,target};
  const {save,result}=normalPlan(before,run,{wave,kills,stars:3,drops:[]});
  for(let i=0;i<result.total;i++)E.addChests(save,[normalChest(result,run,i,r2)]);
  for(const k of ['souls','stats','st','hq','starRw','mat','chests'])assert.deepEqual(save[k],oldSave[k],stage.id+' '+repeat+' '+k);
  cases++;
 }
 console.log('PASS '+cases+' ordinary first/repeat stages match v34 reward amounts, item draws, quests, stars and target hero');
 for(const wave of [0,1,4,5,9,10]){
  const before=P.empty(),run={stage:'1-1',hero:'mage',mode:'campaign',done:true,won:false,completed:wave,repeat:false,target:null},kills=wave?40:0,r1=seeded('partial'+wave),r2=seeded('partial'+wave);
  const [oldSave]=P.applyRun(before,{wave,kills,hero:'mage',stage:true,ch:1},r1),{save,result}=normalPlan(before,run,{wave,kills,stars:0,drops:[]});for(let i=0;i<result.total;i++)E.addChests(save,[normalChest(result,run,i,r2)]);
  for(const k of ['souls','stats','st','hq','starRw','mat','chests'])assert.deepEqual(save[k],oldSave[k]);
 }
 console.log('PASS six partial-return boundaries preserve original reward and unopened chest outcomes');
}finally{Date.now=originalNow;}
