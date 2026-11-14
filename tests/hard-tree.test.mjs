import test from 'node:test';
import assert from 'node:assert/strict';
import {treeOptions,treeBuild,treeMods,changeTree,cleanTrees,basicTreeMul,treeCooldown} from '../src/data/skill-tree.js';
import {HARD_STAGES,hardUnlocked,hardReward,hardXP,eliteQueue,hardEnemy,pulseStep} from '../src/data/hard.js';
import {STAGES} from '../src/data/stages.js';
import {ETYPES} from '../src/data/monsters.js';
import {ADV} from '../src/data/advance.js';
import {MemoryStore} from '../server/memory-store.mjs';
import {execute} from '../server/operations.mjs';
import * as H from '../src/data/hero-growth.js';
import * as P from '../src/account/progress.js';
import {CHEST_CAP,makeItem,addChests} from '../src/account/equip.js';
const heroes=['archer','mage','warrior','gunner','fighter'],now=Date.parse('2026-10-29T00:00:00Z'),user={id:'tree-test-a',email:'test@example.invalid'};
function fixture(level=20,open=true){
 const save={...P.empty(),souls:987,st:open?{'10-6':3}:{},adv:Object.fromEntries(heroes.map(h=>[h,{b:Object.keys(ADV[h])[0],n:1}]))};
 const wallet={...H.initialGrowth(save),user_id:user.id};for(const h of heroes)wallet.xp[h]=H.totalXP(level);
 const store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,updated_at:new Date(now).toISOString(),merged:true}],hd3d_growth_wallet:[wallet],hd3d_owned:['gunner','fighter'].map(h=>({user_id:user.id,item:'hero_'+h}))});
 const run=(operation,t=now,u=user)=>store.transaction(tx=>execute(tx,u,operation,{now:t}));
 return{store,run,rpc:async(n,args={},t=now,u=user)=>(await run({kind:'rpc',name:'hd3d_growth_'+n,args},t,u)).data};
}
test('all five heroes and ten actual branches have two choices in all released tiers',()=>{
 for(const h of heroes)for(const b of Object.keys(ADV[h])){
  for(const tier of [15,20,30,40,50]){assert.equal(treeOptions(h,b,tier).length,2);for(const o of treeOptions(h,b,tier)){assert.ok(o.n&&o.d);assert.equal(changeTree({},h,b,tier-1,0,tier,o.id),null);const t=changeTree({},h,b,tier,0,tier,o.id);assert.equal(treeBuild(t,h,b,tier).choices[tier],o.id);assert.equal(treeBuild(t,h,b,tier-1).choices[tier],undefined);}}
  for(const tier of [30,40,50])assert.equal(changeTree({},h,b,50,0,tier,'heavy'),null);
 }assert.deepEqual(cleanTrees({mechanic:{armor:{}}}),{});
});
test('presets and branch choices persist independently; level and advancement invalidate active effects',()=>{
 let t=changeTree({},'mage','flame',50,0,15,'wide');t=changeTree(t,'mage','flame',50,1,15,'dense');
 const frozen=treeBuild(t,'mage','flame',50);t=changeTree(t,'mage','flame',50,1,null,null);
 assert.equal(treeMods(frozen).basic,.92);assert.equal(treeMods(treeBuild(t,'mage','flame',50)).basic,1.18);
 assert.deepEqual(treeBuild(t,'mage','frost',50).choices,{});assert.deepEqual(treeBuild(t,'mage',null,50).choices,{});
 assert.deepEqual(cleanTrees(JSON.parse(JSON.stringify(t))),t);assert.equal(treeMods(treeBuild(t,'mage','flame',14)).basic,1);
});
test('conditional attacks, chain caps and Q modifiers remain separate from raw skill damage',()=>{
 for(const [h,b,choice,mode,want] of [['fighter','tiger','close','melee',1.15],['fighter','dragon','close','ranged',.92],['mage','flame','dense','ranged',1.18]]){const build=treeBuild(changeTree({},h,b,20,0,15,choice),h,b,20);assert.equal(basicTreeMul({tree:build},{E:{}},mode),want);assert.equal(treeMods(build).qMul,1);}
 const h={tree:treeBuild(changeTree({},'gunner','duel',20,0,15,'stack'),'gunner','duel',20)},t={E:{}};
 assert.equal(basicTreeMul(h,t),.96);for(const v of [1.04,1.08,1.12,1.16,1.16])assert.equal(basicTreeMul(h,t),v);assert.equal(basicTreeMul(h,{E:{}}),.96);
});
test('hard uses separate stable IDs, normal layout/waves; only chapters one to four are released',()=>{
 assert.equal(Object.keys(STAGES).length,60);assert.equal(Object.keys(HARD_STAGES).length,30);
 for(const s of Object.values(HARD_STAGES)){assert.equal(s.waves,STAGES[s.normalId].waves);assert.deepEqual(s.spawns,STAGES[s.normalId].spawns);assert.deepEqual(s.core,STAGES[s.normalId].core);assert.equal(hardUnlocked({st:{}},s.id),false);}
 assert.equal(hardUnlocked({st:{'10-6':3}},'hard-1-1'),true);assert.equal(hardUnlocked({st:{'10-6':3}},'hard-1-2'),false);assert.equal(hardUnlocked({st:{'10-6':3},growth:{hard:{st:{'hard-1-1':1}}}},'hard-1-2'),true);
 assert.equal(hardUnlocked({st:{'10-6':3}},'hard-2-1'),false);
});
test('elite replacements obey per-wave and simultaneous cap; summoned enemies have no farming gold',()=>{
 const q=Array(200).fill('grunt');for(let w=1;w<20;w++){const flags=eliteQueue(q,w,ETYPES);assert.equal(flags.length,q.length);assert.ok(flags.filter(Boolean).length<=4);}
 const b=ETYPES.grunt,clone=structuredClone(b);assert.equal(hardEnemy(b,true,false,1).hardElite,true);assert.equal(hardEnemy(b,true,false,2).hardElite,false);assert.equal(hardEnemy(b,true,true,0).gold,0);assert.deepEqual(b,clone);
 for(const def of Object.values(ETYPES)){const h=hardEnemy(def,true,false,0);assert.ok(Number.isFinite(h.dps)&&h.dps>=0,def.n);assert.equal(h.dps,def.dps*1.12);}
});
test('pulse telegraphs fixed center, permits dodge and stun interruption, boss follow-up remains bounded',()=>{
 const e={g:{position:{x:0,z:0}},hardCd:0},p={x:2,z:2};assert.equal(pulseStep(e,.01,p,true).kind,'warn');p.x=8;assert.equal(pulseStep(e,1.21,p,true).p.x,2);assert.equal(pulseStep(e,1.5,p,true).kind,'warn');e.stunT=.1;assert.equal(pulseStep(e,.01,p,true),null);assert.equal(e.hardCast,null);assert.equal(e.hardFollow,false);e.dead=true;assert.equal(pulseStep(e,100,p),null);
});
test('server validates levels, branch, ownership, revision and duplicate request bodies',async()=>{
 const f=fixture(14),a={p_id:'tree-choice-001',p_revision:0,p_hero:'mage',p_branch:'flame',p_preset:0,p_tier:15,p_choice:'wide'};
 assert.equal((await f.rpc('build',a)).reason,'locked');f.store.tables.hd3d_growth_wallet[0].xp.mage=H.totalXP(15);
 assert.equal((await f.rpc('build',{...a,p_branch:'frost'})).reason,'advancement');const r=await f.rpc('build',a);assert.equal(r.ok,true);assert.equal((await f.rpc('build',a)).already,true);assert.equal((await f.rpc('build',{...a,p_choice:'dense'})).reason,'id_reused');
 assert.equal((await f.rpc('build',{...a,p_id:'tree-choice-002'})).reason,'conflict');assert.equal((await f.rpc('build',{...a,p_id:'tree-choice-003',p_revision:1,p_tier:20,p_choice:'wide'})).reason,'locked');
 const b=await f.rpc('status',{},now,{id:'tree-test-b',email:'b@example.invalid'});assert.equal(b.growth.trees,undefined);
});
test('run snapshots do not change when a later preset is saved',async()=>{
 const f=fixture();const a={p_id:'tree-frozen-001',p_revision:0,p_hero:'mage',p_branch:'flame',p_preset:0,p_tier:15,p_choice:'wide'};await f.rpc('build',a);
 const run=await f.rpc('start',{p_id:'hard-frozen-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});assert.equal(run.build.choices[15],'wide');
 await f.rpc('build',{...a,p_id:'tree-frozen-002',p_revision:1,p_choice:'dense'});
 assert.equal((await f.rpc('start',{p_id:'hard-frozen-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'})).build.choices[15],'wide');
});
test('server denies hard unlock bypass and other user tokens; no normal progress is fabricated',async()=>{
 const f=fixture(20,false);assert.equal((await f.rpc('start',{p_id:'hard-locked-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'})).reason,'locked');
 const g=fixture();assert.equal((await g.rpc('start',{p_id:'hard-locked-002',p_mode:'campaign',p_stage:'hard-1-2',p_hero:'mage'})).reason,'locked');await g.rpc('start',{p_id:'hard-locked-003',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});
 assert.equal((await g.rpc('progress',{p_token:'hard-locked-003',p_completed:10,p_win:true,p_finish:true},now+100000,{id:'other',email:'o@example.invalid'})).reason,'bad_token');
 assert.deepEqual(g.store.tables.hd3d_progress[0].data.st,{'10-6':3});
});
test('first clear: progress, XP and assets commit once despite concurrent retry or lost local storage',async()=>{
 const f=fixture(),s=HARD_STAGES['hard-1-1'];await f.rpc('start',{p_id:'hard-award-001',p_mode:'campaign',p_stage:s.id,p_hero:'mage'});
 const a={p_token:'hard-award-001',p_completed:10,p_win:true,p_finish:true,p_stars:3};const results=await Promise.all([f.rpc('progress',a,now+60000),f.rpc('progress',a,now+60000)]);
 for(const r of results){assert.equal(r.ok,true);assert.equal(r.xp,600);assert.equal(r.growth.hard.st[s.id],3);assert.equal(r.hardSaved,true);}
 const saved=structuredClone(f.store.tables.hd3d_progress[0]);assert.equal(saved.data.souls,987+hardReward(s,10,true,true,'mage').souls);assert.equal(saved.data.chests.length,3);assert.equal(saved.data.hardRewardSeq,1);assert.equal(f.store.tables.hd3d_mail.length,1);assert.equal(f.store.tables.hd3d_mail[0].claimed,true);
 // New client with no local journal replays only the authoritative result.
 await f.rpc('progress',a,now+70000);assert.deepEqual(f.store.tables.hd3d_progress[0],saved);
 // Even after the bounded client mail log disappears, legacy claim retries get no payable payload.
 const claim=await f.run({kind:'rpc',name:'hd3d_claim_mail',args:{p_mail_id:f.store.tables.hd3d_mail[0].id}},now+70500);assert.equal(claim.data.reward,null);assert.equal(claim.data.serverSaved,true);
 const wipedLog={...saved.data,mailLog:[]};assert.equal(P.applyMail(wipedLog,claim.data.id,claim.data.reward)[0].souls,saved.data.souls);
 const stale={...saved.data,souls:987};delete stale.hardRewardSeq;
 const q=await f.run({kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:saved.updated_at},values:{data:stale,merged:true},returning:true},now+71000);assert.deepEqual(q.data,[]);assert.deepEqual(f.store.tables.hd3d_progress[0],saved);
 assert.equal((await f.rpc('start',{p_id:'hard-award-002',p_mode:'campaign',p_stage:'hard-1-2',p_hero:'mage'})).ok,true);
});
test('legitimate replay and partial retreat pay separately; summoned kills cannot affect rewards',async()=>{
 const f=fixture();for(const [id,n,win] of [['hard-repeat-001',10,true],['hard-repeat-002',10,true],['hard-repeat-003',4,false]]){await f.rpc('start',{p_id:id,p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});const r=await f.rpc('progress',{p_token:id,p_completed:n,p_win:win,p_finish:true,kills:999999},now+100000);assert.equal(r.xp,win?id.endsWith('001')?600:400:120);}
 assert.equal(f.store.tables.hd3d_growth_wallet[0].earned,1120);assert.equal(f.store.tables.hd3d_progress[0].data.hardRewardSeq,3);assert.equal(f.store.tables.hd3d_progress[0].data.souls,987+560+320+56);
});
test('hard award transaction failure rolls back mail, progress, XP and receipt together',async()=>{
 const f=fixture();await f.rpc('start',{p_id:'hard-rollback-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});const before=structuredClone(f.store.tables);
 await assert.rejects(f.store.transaction(async tx=>{const put=tx.put.bind(tx);tx.put=async(t,r)=>{if(t==='hd3d_progress')throw Error('test commit failure');return put(t,r);};return execute(tx,user,{kind:'rpc',name:'hd3d_growth_progress',args:{p_token:'hard-rollback-001',p_completed:10,p_win:true,p_finish:true}},{now:now+60000});}),/test commit failure/);
 assert.deepEqual(f.store.tables,before);
});

test('distinct concurrent first clears award the first bonus once, preserving every run and investment',async()=>{
 const f=fixture();f.store.tables.hd3d_growth_wallet[0].balance=10000;
 const base=structuredClone(f.store.tables.hd3d_progress[0].data);base.unknownFuture={keep:true};f.store.tables.hd3d_progress[0].data=base;
 for(const id of ['hard-concurrent-001','hard-concurrent-002'])await f.rpc('start',{p_id:id,p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});
 const result=await Promise.all(['hard-concurrent-001','hard-concurrent-002'].map(id=>f.rpc('progress',{p_token:id,p_completed:10,p_win:true,p_finish:true},now+100000)));
 assert.deepEqual(result.map(r=>r.xp).sort(),[400,600]);const w=f.store.tables.hd3d_growth_wallet[0];assert.equal(w.earned,1000);assert.equal(w.balance,11000);
 const [invest,late]=await Promise.all([f.rpc('invest',{p_id:'hard-invest-001',p_hero:'mage',p_level:21,p_revision:w.rev},now+101000),f.rpc('progress',{p_token:'hard-concurrent-001',p_completed:10,p_win:true,p_finish:true},now+101000)]);
 assert.equal(invest.ok,true);assert.equal(late.ok,true);assert.equal(f.store.tables.hd3d_growth_wallet[0].balance,11000-H.nextXP(20));
 const saved=f.store.tables.hd3d_progress[0].data;assert.deepEqual(saved.unknownFuture,{keep:true});for(const k of ['st','eq','inv','stor','heroLv','adv','research'])assert.deepEqual(saved[k],base[k],k);assert.equal(saved.souls,987+560+320);assert.equal(saved.chests.length,5);
});

test('out of order wave acknowledgements cannot reduce XP or duplicate a final reward',async()=>{
 const f=fixture();await f.rpc('start',{p_id:'hard-order-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});
 const a={p_token:'hard-order-001',p_completed:6,p_win:false,p_finish:false};await f.rpc('progress',a,now+50000);
 assert.equal((await f.rpc('progress',{...a,p_completed:2},now+51000)).xp,180);assert.equal(f.store.tables.hd3d_progress[0].data.souls,987);
 await f.rpc('progress',{...a,p_completed:10,p_win:true,p_finish:true},now+60000);const before=structuredClone(f.store.tables);
 await f.rpc('progress',{...a,p_completed:3,p_finish:true},now+61000);assert.deepEqual(f.store.tables,before);
});

test('tree cooldown stops at the new cap without worsening existing dungeon reductions',()=>{
 assert.equal(treeCooldown(10,20,.88),8.8);assert.equal(treeCooldown(8,20,.88),8);assert.equal(treeCooldown(4,20,.88),4);assert.ok(Math.abs(treeCooldown(10,20,1.12)-11.2)<1e-10);
});

test('full chest storage converts hard rewards once and reports actual results',async()=>{
 const f=fixture(),save=f.store.tables.hd3d_progress[0].data;
 for(let i=0;i<CHEST_CAP;i++){const it=makeItem('weapon','mage',3,()=>.5,10);it.id='full-'+i;addChests(save,[{it,src:'chest'}]);}
 const before=structuredClone(save);await f.rpc('start',{p_id:'hard-full-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});
 const a={p_token:'hard-full-001',p_completed:10,p_win:true,p_finish:true};const r=await f.rpc('progress',a,now+60000);assert.equal(r.hardReward.chests,0);assert.ok(r.hardReward.steel>0);const after=structuredClone(f.store.tables.hd3d_progress[0].data);assert.deepEqual(after.chests,before.chests);assert.equal(after.mat.steel-before.mat.steel,r.hardReward.steel);
 await f.rpc('progress',a,now+61000);assert.deepEqual(f.store.tables.hd3d_progress[0].data,after);
});
