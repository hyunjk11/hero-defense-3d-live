import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/data/hero-growth.js';
import * as P from '../src/account/progress.js';
import { STAGES } from '../src/data/stages.js';
import { MemoryStore } from '../server/memory-store.mjs';
import { execute } from '../server/operations.mjs';
const now=Date.parse('2026-10-27T00:00:00Z'),user={id:'growth-a',email:'a@example.invalid'},other={id:'growth-b',email:'b@example.invalid'};
const stages=Object.fromEntries(Object.values(STAGES).filter(s=>s.ch<=4).map(s=>[s.id,2]));
function fixture(){const store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:{...P.empty(),st:stages,souls:987},updated_at:new Date(now).toISOString()}]});return{store,rpc:(name,args={},u=user,t=now)=>store.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_'+name,args},{now:t})).then(r=>r.data),mode:(name,args,t)=>store.transaction(tx=>execute(tx,user,{kind:'rpc',name:'hd3d_'+name,args},{now:t??now})).then(r=>r.data)};}
test('level thresholds and focus are bounded; purchases never heal or reset timers',()=>{
  assert.deepEqual([1,10,20,30,50].map(H.totalXP),[0,2340,8740,19140,51940]);
  for(let l=2;l<=50;l++){assert.equal(H.levelOf(H.totalXP(l)-1),l-1);assert.equal(H.levelOf(H.totalXP(l)),l);}
  assert.equal(H.levelOf(Infinity),1);assert.equal(H.levelOf(1e9),50);
  const s={growthEnabled:true,phase:'wave',gold:528,focus:0,hp:20,skillCd:7,dead:5};
  for(let i=0;i<H.FOCUS_MAX;i++)assert.equal(H.buyFocus(s),true);assert.equal(s.gold,0);assert.equal(H.buyFocus({...s,gold:1e6}),false);
  assert.deepEqual([s.hp,s.skillCd,s.dead],[20,7,5]);assert.equal(H.buyFocus({...s,focus:0,gold:500,paused:true}),false);
});
test('completed segments, rounding, migration and ordinary save fields',()=>{
  assert.equal(H.campaignXP('5-1',13,true,false),312);assert.equal(H.campaignXP('5-1',13,true,true),468);
  assert.equal(H.campaignXP('5-1',2,false,true),36);assert.equal(H.campaignXP(null,5),60);
  assert.equal(H.dungeonXP(5,true),300);assert.equal(H.dungeonXP(3,false),120);assert.equal(H.spireXP(6,10),40);
  const old={...P.empty(),v:3,st:stages,souls:987,heroLv:{mage:{hp:8,atk:8}},adv:{mage:{b:'flame',n:1}},stor:[]};
  const g=H.initialGrowth(old);assert.equal(g.balance,8528);assert.deepEqual(g.legacyAdv,['mage']);
  const s=P.clean(old);assert.equal(s.v,4);assert.equal(s.souls,987);assert.equal(s.heroLv.mage.atk,8);assert.deepEqual(P.clean(s),s);
});
test('server migration once, investment concurrency, retries and account isolation',async()=>{
  const f=fixture(),g=(await f.rpc('status')).growth;assert.equal(g.balance,8528);
  const args={p_id:'invest-00000001',p_hero:'mage',p_level:19,p_revision:g.rev};
  const r=await Promise.all([f.rpc('invest',args),f.rpc('invest',{...args,p_id:'invest-00000002',p_hero:'warrior'})]);
  assert.equal(r[0].ok,true);assert.equal(r[1].reason,'conflict');assert.equal(r[0].growth.balance,608);
  assert.equal((await f.rpc('invest',args)).already,true);assert.equal((await f.rpc('invest',{...args,p_level:20})).reason,'id_reused');
  assert.equal((await f.rpc('status',{},other)).growth.balance,0);assert.equal((await f.rpc('invest',{...args,p_id:'paid-00000001',p_hero:'fighter',p_revision:1})).reason,'invalid');
  assert.equal((await f.rpc('invest',{p_id:'poor-00000001',p_hero:'mage',p_level:50,p_revision:1})).reason,'poor');
  assert.equal((await f.rpc('status')).growth.granted,8528);assert.equal(f.store.tables.hd3d_progress[0].data.souls,987);
});
test('campaign checkpoints, loss/retry, first bonus once and legitimate repeats',async()=>{
  const f=fixture();const start=async id=>f.rpc('start',{p_id:id,p_mode:'campaign',p_stage:'5-1',p_hero:'mage'});
  assert.equal((await start('run-00000001')).ok,true);
  let args={p_token:'run-00000001',p_completed:3,p_win:false,p_finish:false};
  assert.equal((await f.rpc('progress',args)).reason,'too_fast');
  let a=await f.rpc('progress',args,user,now+10000);assert.equal(a.xp,54);
  assert.equal((await f.rpc('progress',args,user,now+11000)).growth.earned,54);
  args={...args,p_completed:13,p_win:true,p_finish:true};a=await f.rpc('progress',args,user,now+60000);assert.equal(a.xp,468);
  assert.equal((await f.rpc('progress',args,user,now+61000)).growth.earned,468);
  await start('run-00000002');a=await f.rpc('progress',{...args,p_token:'run-00000002'},user,now+120000);assert.equal(a.xp,312);assert.equal(a.growth.earned,780);
  assert.equal((await f.rpc('progress',args,other,now+60000)).reason,'bad_token');
});
test('dungeon and spire use their validated existing runs, not client XP amounts',async()=>{
  const f=fixture();await f.rpc('status');const d=await f.mode('dungeon_start',{p_growth:1});
  const args={p_token:d.token,p_floors:5,p_win:true};const a=await f.mode('dungeon_finish',args,now+100000);
  assert.equal(a.xp,300);assert.equal((await f.mode('dungeon_finish',args,now+110000)).xp,300);
  const s=await f.mode('spire_start',{p_from:1,p_growth:1});const p=await f.mode('spire_ping',{p_token:s.token,p_floor:5},now+140000);assert.equal(p.xp,40);
  const q=await f.mode('spire_finish',{p_token:s.token,p_top:5},now+150000);assert.equal(q.xp,40);assert.equal((await f.rpc('status')).growth.earned,340);
});
test('transaction failures roll back debit and receipt together',async()=>{
  const f=fixture();const before=await f.rpc('status');
  await assert.rejects(f.store.transaction(async tx=>{const put=tx.put.bind(tx);tx.put=async(t,r)=>{if(t==='hd3d_growth_investments')throw new Error('disk failure');return put(t,r);};return execute(tx,user,{kind:'rpc',name:'hd3d_growth_invest',args:{p_id:'fail-00000001',p_hero:'mage',p_level:10,p_revision:0}},{now});}),/disk failure/);
  assert.deepEqual((await f.rpc('status')).growth,before.growth);
});
test('old v3 saves cannot overwrite XP or repeat migration; new advancement needs server level',async()=>{
 const f=fixture();await f.rpc('status');await f.rpc('invest',{p_id:'old-client-test',p_hero:'mage',p_level:10,p_revision:0});
 const before=(await f.rpc('status')).growth,old=f.store.tables.hd3d_progress[0];
 const data={...old.data,v:3,souls:1234,growth:{version:1,balance:999999,xp:{mage:51940}}};
 const query=d=>f.store.transaction(tx=>execute(tx,user,{kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:f.store.tables.hd3d_progress[0].updated_at},values:{data:d,merged:true},returning:true,columns:'updated_at'},{now:now+1000}));
 await query(data);assert.equal(f.store.tables.hd3d_progress[0].data.souls,1234);assert.ok(!('growth' in f.store.tables.hd3d_progress[0].data));assert.deepEqual((await f.rpc('status')).growth,before);
 await assert.rejects(query({...data,adv:{archer:{b:'sniper',n:1}}}),/level 10/i);
 await query({...data,adv:{mage:{b:'flame',n:1}}});assert.deepEqual((await f.rpc('status')).growth,before);
});
test('exact max-level cost, one XP short, invalid numbers and repeated max-level purchases',async()=>{
 assert.equal(H.nextXP(49),2020);const f=fixture();await f.rpc('status');const w=f.store.tables.hd3d_growth_wallet[0];w.xp.mage=H.totalXP(49);w.balance=2019;
 let a={p_id:'max-boundary-1',p_hero:'mage',p_level:50,p_revision:0};assert.equal((await f.rpc('invest',a)).reason,'poor');
 f.store.tables.hd3d_growth_wallet[0].balance=2020;let r=await f.rpc('invest',a);assert.equal(r.ok,true);assert.equal(r.growth.balance,0);assert.equal(r.growth.xp.mage,51940);
 assert.equal((await f.rpc('invest',a)).already,true);a={...a,p_id:'max-boundary-2',p_revision:1};assert.equal((await f.rpc('invest',a)).reason,'max');
 for(const n of [NaN,Infinity,-1,0,1.5,51,'50',null])assert.equal((await f.rpc('invest',{...a,p_id:'bad-number-'+String(n),p_level:n})).ok,false);
 assert.equal((await f.rpc('status')).growth.balance,0);
});
test('concurrent first migration, reward and investments never lose or duplicate economy',async()=>{
 const f=fixture();await Promise.all([f.rpc('status'),f.rpc('status')]);
 await f.rpc('start',{p_id:'parallel-run-1',p_mode:'campaign',p_stage:'5-1',p_hero:'mage'});
 const payload={p_token:'parallel-run-1',p_completed:13,p_win:true,p_finish:true};
 const [a,b,clear]=await Promise.all([f.rpc('invest',{p_id:'parallel-invest1',p_hero:'mage',p_level:19,p_revision:0}),f.rpc('invest',{p_id:'parallel-invest2',p_hero:'archer',p_level:19,p_revision:0}),f.rpc('progress',payload,user,now+60000)]);
 assert.equal(a.ok,true);assert.equal(b.ok,false);assert.equal(clear.growth.balance,1076);
 const responses=await Promise.all([f.rpc('progress',payload,user,now+61000),f.rpc('progress',payload,user,now+61000),f.rpc('progress',{...payload,p_completed:3,p_win:false,p_finish:false},user,now+61000)]);
 for(const r of responses){assert.equal(r.xp,468);assert.equal(r.growth.earned,468);assert.equal(r.growth.spent,7920);assert.equal(r.growth.granted,8528);}
});
test('mode receipts are distinct and spire final-response loss can replay safely',async()=>{
 const f=fixture(),token='22222222-2222-4222-8222-222222222222';await f.rpc('status');
 await f.rpc('start',{p_id:token,p_mode:'challenge',p_hero:'mage'});await f.mode('dungeon_start',{p_growth:1});await f.mode('spire_start',{p_from:1,p_growth:1});
 f.store.tables.hd3d_dungeon_runs[0].token=token;f.store.tables.hd3d_spire_runs[0].token=token;
 await f.rpc('progress',{p_token:token,p_completed:5,p_win:false,p_finish:true},user,now+100000);
 await f.mode('dungeon_finish',{p_token:token,p_floors:3,p_win:false},now+100000);
 const args={p_token:token,p_top:5};const s=await f.mode('spire_finish',args,now+140000);assert.equal(s.xp,40);
 const r=await Promise.all([f.mode('spire_finish',args,now+141000),f.mode('spire_finish',args,now+141000)]);for(const x of r){assert.equal(x.ok,true);assert.equal(x.already,true);assert.equal(x.xp,40);}
 assert.equal((await f.rpc('status')).growth.earned,60+120+40);
});
test('dungeon/spire segment checkpoints, duplicates and partial retreat pay only completed floors',async()=>{
 const f=fixture();await f.rpc('status');const d=await f.mode('dungeon_start',{p_growth:1});
 assert.equal((await f.mode('dungeon_ping',{p_token:d.token,p_floors:1},now+1000)).reason,'too_fast');
 const p=await f.mode('dungeon_ping',{p_token:d.token,p_floors:2},now+50000);assert.equal(p.xp,80);
 assert.equal((await f.mode('dungeon_ping',{p_token:d.token,p_floors:1},now+60000)).xp,80);
 assert.equal((await f.mode('dungeon_finish',{p_token:d.token,p_floors:2,p_win:false},now+61000)).xp,80);
 const s=await f.mode('spire_start',{p_from:1,p_growth:1});
 assert.equal((await f.mode('spire_ping',{p_token:s.token,p_floor:1},now+30000)).xp,8);
 assert.equal((await f.mode('spire_ping',{p_token:s.token,p_floor:1},now+31000)).xp,8);
 assert.equal((await f.mode('spire_finish',{p_token:s.token,p_top:1},now+32000)).xp,8);
 assert.equal((await f.mode('spire_ping',{p_token:s.token,p_floor:1},now+33000)).ok,true);
 assert.equal((await f.rpc('status')).growth.earned,88);
});
