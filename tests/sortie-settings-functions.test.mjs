import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import {runOperation} from '../server/operations.mjs';
import {initialGrowth,cleanGrowth} from '../src/data/hero-growth.js';
import {packSave} from '../src/account/storage.js';
import {empty,clean} from '../src/account/progress.js';
import {loadoutStamp} from '../src/account/loadouts.js';
const now=Date.parse('2026-11-21T05:00:00Z'),iso=new Date(now).toISOString();
const a={id:'sortie-a',email:'a@example.invalid'},b={id:'sortie-b',email:'b@example.invalid'};
function fixture(){
 const s=empty();Object.assign(s,{souls:1000,mat:{steel:5,crystal:4},st:{'10-6':1}});
 const wallet={...initialGrowth(s),user_id:a.id,awakening:{mage:0},awakeningSkill:{mage:false}};
 const db=new MemoryStore({hd3d_progress:[a,b].map(u=>({user_id:u.id,data:packSave(s),merged:true,updated_at:iso})),hd3d_growth_wallet:[wallet],hd3d_owned:[{id:a.id+'~hero_fighter',user_id:a.id,item:'hero_fighter'},{id:a.id+'~hero_mechanic',user_id:a.id,item:'hero_mechanic'}]});
 const rpc=(name,args={},u=a,legacy=false)=>(legacy?runOperation:runEconomyOperation)(db,u,{kind:'rpc',name:'hd3d_'+name,args},{now}).then(r=>r.data);
 const change=(id,kind,value,revision,extra={},u=a)=>rpc('growth_sortie_settings',{p_id:id,p_kind:kind,p_value:value,p_revision:revision,...extra},u);
 const row=()=>db.tables.hd3d_progress.find(x=>x.user_id===a.id);
 const save=()=>clean(row().data),w=()=>db.tables.hd3d_growth_wallet.find(x=>x.user_id===a.id);
 const generic=(data,stamp=row().updated_at)=>runEconomyOperation(db,a,{kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:a.id,updated_at:stamp},values:{data:packSave(data),merged:true},returning:true},{now}).then(r=>r.data);
 return {db,rpc,change,row,save,w,generic};
}
test('separate selections, per-chapter explicit None, scoped status and unchanged resources/awakening',async()=>{
 const f=fixture(),before=structuredClone(f.row()),w=structuredClone(f.w());
 assert.equal((await f.rpc('growth_status')).features.sortieSettings,1);
 assert.equal((await f.rpc('growth_status')).battlePartner,null);
 assert.equal((await f.rpc('growth_status',{},a,true)).features.sortieSettings,undefined);
 await f.change('repeat-chap-one','repeat','gunner',0,{p_chapter:1});
 await f.change('repeat-chap-two','repeat',null,1,{p_chapter:2});
 await f.change('dungeon-party-new','dungeon',['warrior','fighter'],2);
 await f.change('spire-party-new','spire',['mage','archer'],3);
 const status=await f.rpc('growth_status');
 assert.deepEqual(status.growth.sortieSettings,{repeatTarget:{1:'gunner',2:null},dungeon:['warrior','fighter'],spire:['mage','archer']});
 const other=await f.rpc('growth_status',{},b);assert.equal(other.growth.sortieSettings,undefined);assert.equal(other.battlePartner,null);
 assert.deepEqual(f.row(),before);
 for(const k of ['balance','xp','spent','earned','awakening','awakeningSkill'])assert.deepEqual(f.w()[k],w[k]);
 const legacyStart=await f.rpc('growth_start',{p_id:'legacy-hard-run',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage',p_partyVersion:1,p_partner:'warrior'});
 assert.ok(legacyStart.ok);assert.deepEqual(legacyStart.party,['mage','warrior']);
});
test('same-ID replay returns current canonical values, CAS conflict cannot clobber a newer device',async()=>{
 const f=fixture();
 const hard=(id,partner,rev)=>f.change(id,'hard',partner,rev,{p_main:'mage'});
 assert.equal((await hard('pc-first-equip','warrior',0)).battlePartner,'warrior');
 assert.equal((await hard('mobile-new-equip','archer',1)).battlePartner,'archer');
 const replay=await hard('pc-first-equip','warrior',0);
 assert.equal(replay.already,true);assert.equal(replay.battlePartner,'archer');assert.equal(replay.growth.rev,2);
 const stale=await hard('pc-stale-equip','fighter',1);assert.equal(stale.reason,'conflict');assert.equal(stale.battlePartner,'archer');assert.equal(stale.growth.rev,2);
 assert.equal((await hard('pc-first-equip','fighter',0)).reason,'id_reused');
 assert.equal((await f.rpc('growth_status')).battlePartner,'archer');
 assert.equal(f.w().sortieSettings,undefined);
 assert.equal((await hard('explicit-clear-hard',null,2)).battlePartner,null);
 assert.ok(!Object.hasOwn(f.save(),'battlePartner'));
});
test('hard selection uses preset canonical field and neither cached nor old generic saves can overwrite it',async()=>{
 const f=fixture(),old=f.save(),stamp=f.row().updated_at;
 const preset=(op,id)=>f.rpc('gear_action',{p_action:op,p_id:id,p_count:0,p_hero:'mage',p_partner:'archer',p_expected:loadoutStamp(f.save(),f.w().rev)});
 assert.ok((await preset('preset_save','preset-snapshot')).ok);
 const slots=structuredClone(f.save().battlePresets);
 assert.ok((await f.change('direct-hard-choice','hard','warrior',f.w().rev,{p_main:'mage'})).ok);
 assert.deepEqual(await f.generic(old,stamp),[]);
 const omitted=f.save();delete omitted.battlePartner;await f.generic(omitted);
 assert.equal(f.save().battlePartner,'warrior');assert.deepEqual(f.save().battlePresets,slots);
 const forged=f.save();forged.battlePartner='fighter';await assert.rejects(f.generic(forged),{code:'ECONOMY_ACTION_REQUIRED'});
 assert.ok((await preset('preset_apply','preset-apply-after-change')).ok);
 assert.equal((await f.rpc('growth_status')).battlePartner,'archer');
});
test('rejects invalid, malformed, unowned, hidden and duplicated preferences',async()=>{
 const f=fixture();
 for(const [kind,value,extra] of [['repeat','invalid',{p_chapter:1}],['repeat',undefined,{p_chapter:1}],['repeat','mage',{p_chapter:11}],['dungeon',[],{}],['dungeon',['archer','archer'],{}],['spire',['mechanic'],{}],['hard','mage',{p_main:'mage'}]]){
  assert.equal((await f.change('invalid-request',kind,value,0,extra)).reason,'invalid');
 }
 for(const [kind,value,extra] of [['dungeon',['gunner'],{}],['hard','gunner',{p_main:'mage'}]])assert.equal((await f.change('unowned-request',kind,value,0,extra)).reason,'hero');
 assert.equal(f.w().rev,0);
 assert.deepEqual(cleanGrowth({...f.w(),sortieSettings:{repeatTarget:{1:null,2:'mage',3:{},11:'armor'},dungeon:['mage','mage'],spire:['archer']}}).sortieSettings,{repeatTarget:{1:null,2:'mage'},spire:['archer']});
});
test('failure at receipt rolls back Hard progress and wallet revision atomically',async()=>{
 const f=fixture(),before=structuredClone(f.db.tables),tx=f.db.transaction.bind(f.db);
 f.db.transaction=fn=>tx(async t=>{
  const put=t.put.bind(t);
  t.put=async(name,row)=>{if(name==='hd3d_growth_investments')throw Error('Injected receipt failure');return put(name,row);};
  return fn(t);
 });
 await assert.rejects(f.change('rollback-hard-pref','hard','archer',0,{p_main:'mage'}),/Injected/);
 assert.deepEqual(f.db.tables,before);
});
