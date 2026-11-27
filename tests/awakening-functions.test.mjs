import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import {runOperation} from '../server/operations.mjs';
import * as A from '../src/data/awakening.js';
import * as H from '../src/data/hero-growth.js';
import * as P from '../src/account/progress.js';
const user={id:'awakening-qa',email:'qa@example.invalid'},at=Date.parse('2026-11-20T00:00:00Z');
const branch={mage:'frost',warrior:'paladin',fighter:'dragon'};
function setup({saveEdit=()=>{},walletEdit=()=>{},paid=true}={}){
 const save=P.empty(),w={...H.initialGrowth(save),user_id:user.id};
 Object.assign(save,{st:{'10-6':3},souls:80000,mat:{steel:3000,crystal:3000}});
 for(const [h,b] of Object.entries(branch)){save.adv[h]={b};save.heroLv[h]={atk:15,hp:15};w.xp[h]=H.totalXP(50);}
 w.spent=H.totalXP(50)*3;w.balance=120000;w.earned=w.spent+w.balance;saveEdit(save);walletEdit(w);
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,updated_at:new Date(at).toISOString()}],hd3d_growth_wallet:[w],hd3d_owned:paid?[{id:user.id+'~hero_fighter',user_id:user.id,item:'hero_fighter'}]:[]});
 const rpc=(name,args={},legacy=false)=>(legacy?runOperation:runEconomyOperation)(db,user,{kind:'rpc',name:'hd3d_growth_'+name,args},{now:at}).then(r=>r.data);
 const up=(id,hero,level,rev)=>rpc('awaken',{p_id:id,p_hero:hero,p_level:level,p_revision:rev});
 const launch=(id,hero,extra)=>rpc('start',{p_id:id,p_hero:hero,p_mode:'campaign',p_stage:'hard-1-1',...extra});
 return {db,rpc,up,launch,save:()=>P.clean(db.tables.hd3d_progress[0].data),wallet:()=>db.tables.hd3d_growth_wallet[0]};
}
test('exact branches, curve, base-level independence and cleaned records',()=>{
 assert.deepEqual(A.awakeningMods(50),{dmg:1.3,hp:1.2});
 assert.deepEqual(A.awakeningMods(null),{dmg:1,hp:1});
 for(const [hero,b] of Object.entries(branch))assert.ok(A.awakeningSupported(hero,b)&&A.awakeningSupported(hero,{b})&&A.awakeningSupported(hero,{k:b}));
 const f=setup(),g=f.wallet();assert.equal(A.awakeningQuote(g,f.save(),'mage',0).before,null);
 g.awakening={mage:0,warrior:'40',fighter:51,mechanic:30};assert.deepEqual(H.cleanGrowth(g).awakening,{mage:0});
 assert.deepEqual(A.awakeningQuote(g,f.save(),'mage',50),{ok:true,reason:null,before:0,target:50,xp:103880,souls:45500,steel:375,crystal:35});
});
test('unlock gates: paid ownership, base 50, two perm 15s, exact promotion',async()=>{
 for(const [opt,reason] of [
  [{saveEdit:s=>{delete s.adv.mage;}},'unsupported'], [{saveEdit:s=>{s.adv.mage='flame';}},'unsupported'],
  [{saveEdit:s=>{s.heroLv.mage.hp=14;}},'permanent'], [{saveEdit:s=>{s.heroLv.mage.atk=14;}},'permanent'],
  [{walletEdit:w=>{w.xp.mage=H.totalXP(50)-1;}},'base_level']
 ]){const f=setup(opt);assert.equal((await f.up('gates-test','mage',0,0)).reason,reason);assert.equal(f.wallet().awakening,undefined);}
 const f=setup({paid:false});assert.equal((await f.up('not-owned','fighter',0,0)).reason,'invalid');
 assert.equal((await f.up('not-unlocked','mage',10,0)).reason,'locked');
 assert.equal((await f.rpc('status')).features.awakening,1);assert.equal((await f.rpc('status',{},true)).features.awakening,undefined);
});
test('atomic costs leave base unchanged; stale revisions and receipt idempotence',async()=>{
 const f=setup();assert.equal((await f.up('unlock-mage','mage',0,0)).growth.awakening.mage,0);
 const q=await f.up('upgrade-mage','mage',50,1);assert.equal(q.level,50);assert.equal(q.xp,103880);
 assert.deepEqual(q.resources,{souls:34500,steel:2625,crystal:2965});
 assert.equal(f.wallet().earned+f.wallet().granted-f.wallet().spent,f.wallet().balance);
 assert.equal(f.wallet().xp.mage,H.totalXP(50));
 const before=structuredClone(f.db.tables);
 assert.equal((await f.up('upgrade-mage','mage',50,1)).already,true);assert.deepEqual(f.db.tables,before);
 assert.equal((await f.up('upgrade-mage','mage',49,1)).reason,'id_reused');
 assert.equal((await f.up('new-stale-op','warrior',0,1)).reason,'conflict');
});
test('platform-neutral opt-in snapshots both Hard heroes, absent old client stays unchanged',async()=>{
 const f=setup({walletEdit:w=>{w.awakening={mage:7,fighter:0,warrior:11};}});
 const party={p_partyVersion:1,p_partner:'fighter'},old=await f.launch('legacy-hard','mage',party);
 assert.ok(!Object.hasOwn(old,'awakeningLevel')&&!Object.hasOwn(old.loadouts.fighter,'awakeningLevel'));
 const opts={...party,p_awakeningVersion:1},pc=await f.launch('new-hard-a','mage',opts);
 assert.equal(pc.awakeningLevel,7);assert.equal(pc.loadouts.fighter.awakeningLevel,0);
 f.db.tables.hd3d_progress[0].data.adv.mage={b:'flame'};
 const next=await f.launch('new-hard-b','mage',opts);assert.equal(next.awakeningLevel,null);
 assert.equal(next.loadouts.mage.awakeningLevel,null);assert.equal(next.growth.awakening.mage,7);
 assert.equal((await f.launch('new-hard-a','mage',opts)).awakeningLevel,7);
 assert.equal((await f.launch('new-hard-a','mage',party)).reason,'id_reused');
});
test('poor and failed writes debit nothing',async()=>{
 const f=setup({saveEdit:s=>{s.souls=0;}});assert.ok((await f.up('unlock-poor','mage',0,0)).ok);
 assert.equal((await f.up('try-poor','mage',5,1)).reason,'poor');assert.equal(f.wallet().awakening.mage,0);
 const a=setup();await a.up('unlock-good','mage',0,0);
 const before=structuredClone(a.db.tables),tx=a.db.transaction.bind(a.db);
 a.db.transaction=fn=>tx(async t=>{
  const put=t.put.bind(t);
  t.put=async(name,row)=>{if(name==='hd3d_growth_investments')throw Error('Injected receipt failure');return put(name,row);};
  return fn(t);
 });
 await assert.rejects(a.up('try-good','mage',5,1),/Injected/);assert.deepEqual(a.db.tables,before);
});

const skill=(f,id,hero,on,rev)=>f.rpc('awakening_skill',{p_id:id,p_hero:hero,p_on:on,p_revision:rev});
const skillOpt={p_awakeningVersion:1,p_awakeningSkillVersion:1};
test('E preference defaults on, sanitizes strict booleans and only Functions advertises it',async()=>{
 const f=setup({walletEdit:w=>{w.awakening={mage:0,warrior:4};w.awakeningSkill={mage:false,warrior:'true',archer:true,fighter:true};}});
 const s=await f.rpc('status');
 assert.equal(s.features.awakeningSkill,1);
 assert.deepEqual(s.growth.awakeningSkill,{mage:false,fighter:true});
 assert.equal((await f.rpc('status',{},true)).features.awakeningSkill,undefined);
 assert.equal(A.awakeningSkillOn(s.growth,'warrior'),true);
 assert.equal(A.awakeningSkillOn(s.growth,'mage'),false);
});
test('authenticated toggle validates current supported awakening; receipts and CAS cost nothing',async()=>{
 const f=setup({walletEdit:w=>{w.awakening={mage:0};}});
 assert.equal((await skill(f,'unawakened-warrior','warrior',false,0)).reason,'locked');
 assert.equal((await skill(f,'invalid-pref','mage','false',0)).reason,'invalid');
 assert.equal((await skill(setup({paid:false,walletEdit:w=>{w.awakening={fighter:0};}}),'missing-owner','fighter',false,0)).reason,'invalid');
 const resource=structuredClone(f.db.tables.hd3d_progress[0]),wallet=structuredClone(f.wallet());
 const a=await skill(f,'pc-action','mage',false,0);
 assert.equal(a.growth.awakeningSkill.mage,false);assert.equal(a.growth.rev,1);
 assert.deepEqual(f.db.tables.hd3d_progress[0],resource);
 for(const k of ['balance','spent','earned','granted','xp','awakening'])assert.deepEqual(f.wallet()[k],wallet[k]);
 assert.equal((await skill(f,'mobile-stale','mage',true,0)).growth.awakeningSkill.mage,false);
 const b=await skill(f,'mobile-current','mage',true,1);
 assert.equal(b.growth.awakeningSkill.mage,true);assert.equal(b.growth.rev,2);
 const retry=await skill(f,'pc-action','mage',false,0);
 assert.equal(retry.already,true);assert.equal(retry.growth.awakeningSkill.mage,true);
 assert.equal((await skill(f,'pc-action','mage',true,0)).reason,'id_reused');
 f.db.tables.hd3d_progress[0].data.adv.mage={b:'flame'};
 assert.equal((await skill(f,'wrong-branch','mage',false,2)).reason,'locked');
 assert.equal(f.wallet().awakeningSkill.mage,true);
});
test('marked starts freeze each active E choice per run; unmarked/old replay never gains fields',async()=>{
 const f=setup({walletEdit:w=>{w.awakening={mage:0,fighter:4};w.awakeningSkill={mage:false};}});
 const party={p_partyVersion:1,p_partner:'fighter'};
 assert.equal((await f.launch('bad-marker','mage',{p_awakeningSkillVersion:1})).reason,'invalid');
 const old=await f.launch('old-before-skill','mage',{...party,p_awakeningVersion:1});
 assert.ok(!Object.hasOwn(old,'awakeningUseE')&&!Object.hasOwn(old.loadouts.fighter,'awakeningUseE'));
 const prior=structuredClone(f.db.tables.hd3d_growth_runs[0]);
 const oldRetry=await f.launch('old-before-skill','mage',{...party,...skillOpt});
 assert.ok(!Object.hasOwn(oldRetry,'awakeningUseE')&&!Object.hasOwn(oldRetry.loadouts.fighter,'awakeningUseE'));
 assert.deepEqual(f.db.tables.hd3d_growth_runs[0],prior);
 const marked=await f.launch('new-with-skill','mage',{...party,...skillOpt});
 assert.equal(marked.awakeningUseE,false);assert.equal(marked.loadouts.mage.awakeningUseE,false);assert.equal(marked.loadouts.fighter.awakeningUseE,true);
 await skill(f,'switch-mage','mage',true,0);await skill(f,'switch-seoyun','fighter',false,1);
 const replay=await f.launch('new-with-skill','mage',{...party,...skillOpt});
 assert.equal(replay.awakeningUseE,false);assert.equal(replay.loadouts.fighter.awakeningUseE,true);
 const next=await f.launch('next-with-skill','mage',{...party,...skillOpt});
 assert.equal(next.awakeningUseE,true);assert.equal(next.loadouts.fighter.awakeningUseE,false);
 const notAwakened=await f.launch('not-awakened-start','warrior',skillOpt);
 assert.equal(notAwakened.awakeningLevel,null);assert.ok(!Object.hasOwn(notAwakened,'awakeningUseE'));
});
test('failed preference receipt write cannot partially save preference or revision',async()=>{
 const f=setup({walletEdit:w=>{w.awakening={mage:0};}});
 const before=structuredClone(f.db.tables),tx=f.db.transaction.bind(f.db);
 f.db.transaction=fn=>tx(async t=>{
  const put=t.put.bind(t);
  t.put=async(name,row)=>{if(name==='hd3d_growth_investments')throw Error('Injected preference receipt failure');return put(name,row);};return fn(t);
 });
 await assert.rejects(skill(f,'uncommitted-pref','mage',false,0),/Injected/);
 assert.deepEqual(f.db.tables,before);
});


test('Rose ownership, threshold, save, branch gate and immutable PC sortie E preference',async()=>{
 const eligible={saveEdit:s=>{s.adv.gunner={b:'thorn'};s.heroLv.gunner={atk:15,hp:15};},
   walletEdit:w=>{w.xp.gunner=H.totalXP(50);w.spent+=H.totalXP(50);w.earned+=H.totalXP(50);}};
 const giveRose=f=>f.db.tables.hd3d_owned.push({id:user.id+'~hero_gunner',user_id:user.id,item:'hero_gunner'});
 const f=setup(eligible);
 assert.equal((await f.up('rose-not-owned','gunner',0,0)).reason,'invalid');
 giveRose(f);
 f.db.tables.hd3d_progress[0].data.adv.gunner={b:'duel'};
 assert.equal((await f.up('rose-wrong-gate','gunner',0,0)).reason,'unsupported');
 f.db.tables.hd3d_progress[0].data.adv.gunner={b:'thorn'};
 f.db.tables.hd3d_progress[0].data.heroLv.gunner.hp=14;
 assert.equal((await f.up('rose-below-gate','gunner',0,0)).reason,'permanent');
 f.db.tables.hd3d_progress[0].data.heroLv.gunner.hp=15;
 const base=structuredClone(f.wallet().xp);
 const unlock=await f.up('rose-unlock','gunner',0,0);
 assert.equal(unlock.growth.awakening.gunner,0);
 assert.equal((await f.up('rose-unlock','gunner',0,0)).already,true);
 assert.deepEqual(f.wallet().xp,base);
 const up=await f.up('rose-train-five','gunner',5,1);
 assert.equal(up.growth.awakening.gunner,5);
 assert.equal(up.xp,3600);
 assert.deepEqual(up.resources,{souls:77700,steel:2985,crystal:3000});
 assert.deepEqual(f.wallet().xp,base);
 const start=(id,extra={})=>f.rpc('start',{p_id:id,p_hero:'gunner',p_stage:'1-1',p_mode:'campaign',...extra});
 const old=await start('rose-old-before-opt');
 assert.equal(old.awakeningLevel,undefined);
 const first=await start('rose-first-pc',skillOpt);
 assert.equal(first.awakeningLevel,5);assert.equal(first.awakeningUseE,true);
 const hard=await f.launch('rose-hard-partner','mage',{...skillOpt,p_partyVersion:1,p_partner:'gunner'});
 assert.equal(hard.loadouts.gunner.awakeningLevel,5);assert.equal(hard.loadouts.gunner.awakeningUseE,true);
 const pref=await skill(f,'rose-own-choice','gunner',false,2);
 assert.equal(pref.growth.awakeningSkill.gunner,false);
 const next=await start('rose-next-pc',skillOpt);
 assert.equal(next.awakeningLevel,5);assert.equal(next.awakeningUseE,false);
 assert.equal((await start('rose-first-pc',skillOpt)).awakeningUseE,true);
});
