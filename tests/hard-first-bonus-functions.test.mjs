import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import {runOperation} from '../server/operations.mjs';
import {HARD_STAGES,hardReward} from '../src/data/hard.js';
import {waveBoss} from '../src/core/roster.js';
import * as H from '../src/data/hero-growth.js';
import * as P from '../src/account/progress.js';

const user={id:'hard-first-bonus-qa',email:'qa@example.invalid'},stage='hard-3-1',s=HARD_STAGES[stage];
const bossWaves=Array.from({length:s.waves},(_,i)=>i+1).filter(n=>waveBoss(s,n));
function setup({stars={'hard-2-4':3},capacity=0}={}){
 let now=Date.parse('2026-11-20T01:00:00Z');
 const save=P.clean({...P.empty(),st:{'10-6':3}});
 for(let i=0;i<capacity;i++)save.chests.push({id:'cf'+i,src:'chest',it:{id:'f'+i,s:'armor',g:0,n:'QA',e:0,m:['hp',50],sub:[]},souls:0});
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[{...H.initialGrowth(save),user_id:user.id,hard:{version:1,st:stars}}]});
 const rpc=(name,args={},options={},legacy=false)=>(legacy?runOperation:runEconomyOperation)(db,user,{kind:'rpc',name:'hd3d_growth_'+name,args},{now,random:()=>0,...options}).then(r=>r.data);
 return {db,rpc,save:()=>P.clean(db.tables.hd3d_progress[0].data),tick:()=>{now+=120000;},
   start:(id,args={})=>rpc('start',{p_mode:'campaign',p_stage:stage,p_hero:'mage',p_id:id,p_hardFirstBonus:1,...args}),
   end:(id,args={},options)=>rpc('progress',{p_token:id,p_completed:s.waves,p_win:true,p_finish:true,p_stars:2,p_bossKills:bossWaves,p_kills:24,...args},options)};
}

test('only Functions advertises, and opt-in start is immutable and replayable',async()=>{
 const f=setup();
 assert.equal((await f.rpc('status')).features.hardFirstBonus,1);
 assert.equal((await f.rpc('status',{}, {},true)).features.hardFirstBonus,undefined);
 assert.equal((await f.start('invalid-1',{p_hardFirstBonus:'1'})).reason,'invalid');
 assert.equal((await f.start('invalid-2',{p_stage:'1-1'})).reason,'invalid');
 const a=await f.start("start-opt-in");assert.equal(a.hardFirstBonus,1,JSON.stringify(a));
 assert.equal((await f.start('start-opt-in')).hardFirstBonus,1);
 assert.equal((await f.start('start-opt-in',{p_hardFirstBonus:undefined})).reason,'id_reused');
 assert.equal((await f.start('old-start',{p_hardFirstBonus:undefined})).hardFirstBonus,undefined);
 assert.equal((await f.start('old-start')).reason,'id_reused');
});

test('valid actual boss kills roll independently after unchanged base RNG, one Hard star boundary, no acknowledged duplicates',async()=>{
 const f=setup();
 await f.start('first-run');f.tick();
 const baseN=Math.floor(s.waves/5)+1;
 // Base consumes two draws per five-wave box and one for the final guaranteed epic.
 const draws=[...Array.from({length:2*(baseN-1)+1},(_,i)=>i/11),.49,0,0,.50,0,0];
 let i=0;
 const expected=hardReward(s,s.waves,true,true,'mage',()=>draws[i++]);i=0;
 const valid=bossWaves.slice(0,2);
 const r=await f.end('first-run',{p_bossKills:valid},{random:()=>draws[i++]??1-.001});
 assert.equal(r.hardSaved,true);assert.equal(r.hardReward.chests,baseN+2);
 const mail=f.db.tables.hd3d_mail[0].reward;
 assert.equal(mail.souls,expected.souls);assert.deepEqual(mail.items.slice(0,baseN),expected.items);
 assert.equal(mail.items[baseN-1].g,3);assert.ok(mail.items.every(x=>x.c===3&&x.g>=1));
 const before=structuredClone(f.db.tables);
 assert.equal((await f.end('first-run')).already,true);assert.deepEqual(f.db.tables,before);
});

test('invalid boss metadata rolls no rewards; missed boundary yields no payout or backlog; old/mobile and repeat contracts unchanged',async()=>{
 const f=setup({stars:{'hard-2-4':2,'hard-2-5':3,'hard-2-6':3,'hard-2-3':3}});
 await f.start('elig-first');f.tick();
 for(const bad of [null,1,[1],[bossWaves[0],bossWaves[0]],[s.waves,5],[s.waves+1]]){
   assert.equal((await f.end('elig-first',{p_bossKills:bad})).reason,'invalid');assert.equal(f.save().chests.length,0);
 }
 // Starts at 11, ends 13: no retroactive star boxes at 5 or 10.
 const n0=Math.floor(s.waves/5)+1;
 assert.equal((await f.end('elig-first',{p_bossKills:[]})).hardReward.chests,n0);
 assert.equal((await f.start('repeat-run')).hardFirstBonus,undefined);f.tick();
 assert.equal((await f.end('repeat-run')).hardReward.chests,Math.floor(s.waves/5)+2);
 const mobile=setup();
 assert.equal((await mobile.start('mobile-run',{p_hardFirstBonus:undefined})).hardFirstBonus,undefined); mobile.tick();
 assert.equal((await mobile.end('mobile-run')).hardReward.chests,n0);
});

test('full chest capacity opens no extra slots and auto-dismantles bonus once',async()=>{
 const f=setup({capacity:200});
 assert.equal(f.save().chests.length,200);
 await f.start('full-run');f.tick();
 const r=await f.end('full-run');
 assert.equal(f.save().chests.length,200);
 assert.equal(r.hardReward.chests,0);
 assert.ok(r.hardReward.steel>0||r.hardReward.crystal>0);
 const before=structuredClone(f.db.tables);
 assert.equal((await f.end('full-run')).already,true);
 assert.deepEqual(f.db.tables,before);
});

test('parallel first departures settle bonus at most once; write failures roll back reward and Hard stars',async()=>{
 const f=setup();
 await f.start('parallel-one');await f.start('parallel-two');f.tick();
 const tx=f.db.transaction.bind(f.db);
 f.db.transaction=fn=>tx(async t=>{
  const put=t.put.bind(t);
  t.put=async(name,row)=>{
   if(name==='hd3d_growth_runs'&&row.done)throw Error('Injected final write failure');
   return put(name,row);
  };
  return fn(t);
 });
 const before=structuredClone(f.db.tables);
 await assert.rejects(f.end('parallel-one'),/Injected/);
 assert.deepEqual(f.db.tables,before);
 f.db.transaction=tx;
 const [a,b]=await Promise.all([f.end('parallel-one'),f.end('parallel-two')]);
 const base=Math.floor(s.waves/5);
 assert.equal(a.hardReward.chests,base+2+bossWaves.length);
 assert.equal(b.hardReward.chests,base);
 assert.equal(f.db.tables.hd3d_growth_wallet[0].hard.st[stage],2);
 assert.equal(f.db.tables.hd3d_mail.length,2);
});
