import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {packSave} from '../src/account/storage.js';
import {initialGrowth,totalXP} from '../src/data/hero-growth.js';
import {treeBuild,treeOptions} from '../src/data/skill-tree.js';
import {loadoutStamp} from '../src/account/loadouts.js';
globalThis.location={search:''};
const {comparisonHtml}=await import('../src/ui/itemview.js');
const now=1800000000000,iso=new Date(now).toISOString(),user={id:'preset-a',email:'test@example.invalid'};
let n=0;
const item=(slot='armor',h='mage',ch=1)=>({...E.makeItem(slot,h,3,()=>.4,ch),id:'test-item-'+(++n)});
function fixture(){const s=P.empty();s.souls=12345;s.mat={steel:123,crystal:12};s.inv=[item(),item('weapon'),item('weapon','archer'),item('acc')];s.eq.mage={armor:s.inv[0].id,weapon:s.inv[1].id};s.eq.archer={weapon:s.inv[2].id};return new MemoryStore({hd3d_progress:[{user_id:user.id,data:packSave(s),merged:true,updated_at:iso}]});}
const saved=db=>P.clean(db.tables.hd3d_progress[0].data);
const rpc=(db,name,args={},u=user)=>runEconomyOperation(db,u,{kind:'rpc',name:'hd3d_'+name,args},{now});
const action=(db,p_action,extra={})=>rpc(db,'gear_action',{p_action,p_id:'test-action-'+(++n),...extra});
const rev=db=>db.tables.hd3d_growth_wallet?.[0]?.rev||0;
const preset=(db,p_action,extra={})=>action(db,p_action,{p_count:0,p_hero:'mage',p_partner:'archer',p_expected:loadoutStamp(saved(db),rev(db)),...extra});
const generic=(db,data,stamp=db.tables.hd3d_progress[0].updated_at)=>runEconomyOperation(db,user,{kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:stamp},values:{data:packSave(data),merged:true},returning:true},{now});

test('lock survives storage packing/cleaning and guards local, single and old batch dismantles',async()=>{
 const db=fixture(),id=saved(db).inv[3].id;assert((await action(db,'lock',{p_item:id,p_locked:true})).data.ok);
 const s=saved(db);assert(E.isLocked(s,id));assert.equal(E.dismantle(structuredClone(s),[id])[2],0);
 assert.equal((await action(db,'dismantle',{p_item:id})).data.ok,false);
 const batch=await rpc(db,'gear_batch',{commands:[{p_id:'old-batch-123',p_action:'dismantle',p_item:id}]});assert.equal(batch.data.results[0].ok,false);
 assert((await action(db,'store',{p_item:id})).data.ok);assert(E.isLocked(saved(db),id));assert((await action(db,'take',{p_item:id})).data.ok);
 assert.deepEqual(saved(db).mat,s.mat);assert.equal(saved(db).souls,s.souls);
 assert((await action(db,'lock',{p_item:id,p_locked:false})).data.ok);assert((await action(db,'dismantle',{p_item:id})).data.ok);
});
test('unknown lock, malformed args and another account cannot change an item',async()=>{
 const db=fixture(),before=saved(db);assert.equal((await action(db,'lock',{p_item:'missing',p_locked:true})).data.ok,false);
 await assert.rejects(action(db,'lock',{p_item:before.inv[0].id,p_locked:'yes'}));
 await assert.rejects(rpc(db,'gear_action',{p_id:'foreign-lock-1',p_action:'lock',p_item:before.inv[0].id,p_locked:true},{id:'other'}));assert.deepEqual(saved(db),before);
});
test('old generic saves preserve new preferences; explicit forged changes rejected',async()=>{
 const db=fixture(),old=saved(db);await action(db,'lock',{p_item:old.inv[3].id,p_locked:true});await preset(db,'preset_save');
 old.nick='old client';await generic(db,old);assert(E.isLocked(saved(db),old.inv[3].id));assert(saved(db).battlePresets[0]);
 const bad=saved(db);bad.lockedGear=[];await assert.rejects(generic(db,bad),e=>e.code==='ECONOMY_ACTION_REQUIRED');
 const bad2=saved(db);bad2.battlePresets=[];await assert.rejects(generic(db,bad2),e=>e.code==='ECONOMY_ACTION_REQUIRED');
});
test('preset restores both heroes gear and partner atomically without changing rewards',async()=>{
 const db=fixture(),before=saved(db);assert((await preset(db,'preset_save')).data.ok);
 await action(db,'unequip',{p_hero:'mage',p_slot:'armor'});await action(db,'equip',{p_hero:'mage',p_item:before.inv[3].id});
 const changed=saved(db),out=await preset(db,'preset_apply');assert(out.data.ok);const s=saved(db);
 assert.deepEqual(s.eq.mage,before.eq.mage);assert.deepEqual(s.eq.archer,before.eq.archer);assert.equal(s.battlePartner,'archer');assert.equal(s.hero,'mage');
 for(const k of ['souls','mat','inv','chests','stats','st','codex'])assert.deepEqual(s[k],changed[k]);
});
test('missing/stored/other-hero equipment and changed advancement never partially apply',async()=>{
 for(const kind of ['missing','stored','in_use','advancement']){
  const db=fixture();await preset(db,'preset_save');const row=db.tables.hd3d_progress[0],s=P.clean(row.data),id=s.eq.mage.armor;
  delete s.eq.mage.armor;
  if(kind==='missing')s.inv=s.inv.filter(it=>it.id!==id);
  if(kind==='stored'){s.stor.push(s.inv.find(it=>it.id===id));s.inv=s.inv.filter(it=>it.id!==id);}
  if(kind==='in_use')s.eq.warrior.armor=id;
  if(kind==='advancement')s.adv.mage={b:'flame',n:1};
  row.data=packSave(s);const before=structuredClone(db.tables);const r=await preset(db,'preset_apply');assert.equal(r.data.ok,false);assert.equal(r.data.reason,kind==='stored'?'missing':kind);assert.deepEqual(db.tables,before);
 }
});
test('preset conflict/replay and stale old tab saves do not overwrite newer changes',async()=>{
 const db=fixture();await preset(db,'preset_save');const stale=saved(db),stamp=db.tables.hd3d_progress[0].updated_at,expected=loadoutStamp(stale,rev(db));
 await action(db,'unequip',{p_hero:'mage',p_slot:'armor'});assert.equal((await preset(db,'preset_apply',{p_expected:expected})).data.reason,'conflict');
 const args={p_action:'preset_apply',p_id:'same-request-123',p_count:0,p_expected:loadoutStamp(saved(db),rev(db))};assert((await rpc(db,'gear_action',args)).data.ok);
 const wrev=rev(db);await action(db,'unequip',{p_hero:'mage',p_slot:'armor'});assert((await rpc(db,'gear_action',args)).data.already);assert.equal(rev(db),wrev);assert.equal(saved(db).eq.mage.armor,undefined);
 assert.deepEqual((await generic(db,stale,stamp)).data,[]);
 await assert.rejects(rpc(db,'gear_action',{...args,p_count:1}));
});
test('preset validates ownership, distinct partner and bounded slots',async()=>{
 const db=fixture();assert.equal((await preset(db,'preset_save',{p_partner:'mage'})).data.reason,'hero');assert.equal((await preset(db,'preset_save',{p_partner:'fighter'})).data.reason,'hero');
 await assert.rejects(preset(db,'preset_save',{p_count:2}));assert.equal((await preset(db,'preset_apply')).data.reason,'empty');
});
test('set comparison includes gained and lost thresholds and full hero stat delta',()=>{
 const s=P.empty(),a=item('armor','mage','morvia'),b=item('acc','mage','morvia'),c=item('weapon','mage','morvia'),other=item('weapon','mage',2);s.inv=[a,b,c,other];s.eq.mage={armor:a.id,acc:b.id};
 const x=E.compareEquipped(s,'mage',c);assert(x.gained.some(b=>b.pieces===3));assert.match(comparisonHtml(s,'mage',c),/활성화:/);
 E.equip(s,'mage',c.id);const y=E.compareEquipped(s,'mage',other);assert(y.lost.some(b=>b.pieces===3));assert.match(comparisonHtml(s,'mage',other),/해제:/);
 const after=structuredClone(s);E.equip(after,'mage',other.id);for(const k of Object.keys(y.delta))assert.equal(y.delta[k],Math.round(((E.bonus(after,'mage')[k]||0)-(E.bonus(s,'mage')[k]||0))*10)/10);
 assert.equal(E.compareEquipped(s,'archer',c),null);
});

test('both heroes exact tree choices restore in one transaction and revision conflicts stop all changes',async()=>{
 const db=fixture(),s=saved(db);s.adv.mage={b:'flame',n:1};s.adv.archer={b:'wind',n:1};db.tables.hd3d_progress[0].data=packSave(s);
 const w={user_id:user.id,...initialGrowth(s)},choice=treeOptions('mage','flame',15)[0].id,other=treeOptions('mage','flame',15)[1].id,arch=treeOptions('archer','wind',20)[0].id;
 w.xp.mage=totalXP(30);w.xp.archer=totalXP(30);w.trees={mage:{flame:{active:1,presets:[{}, {15:choice}]}},archer:{wind:{active:0,presets:[{20:arch},{}]}}};db.tables.hd3d_growth_wallet=[w];
 await preset(db,'preset_save');const expected=loadoutStamp(saved(db),rev(db));
 db.tables.hd3d_growth_wallet[0].trees.mage.flame.presets[1]={15:other};db.tables.hd3d_growth_wallet[0].rev++;
 assert.equal((await preset(db,'preset_apply',{p_expected:expected})).data.reason,'conflict');
 assert((await preset(db,'preset_apply')).data.ok);const next=db.tables.hd3d_growth_wallet[0];
 assert.deepEqual(treeBuild(next.trees,'mage','flame',30).choices,{15:choice});assert.deepEqual(treeBuild(next.trees,'archer','wind',30).choices,{20:arch});assert.equal(next.trees.mage.flame.active,1);
 // Loss of a required level refuses gear and tree changes together.
 next.xp.mage=0;const before=structuredClone(db.tables);assert.equal((await preset(db,'preset_apply')).data.reason,'tree');assert.deepEqual(db.tables,before);
});
test('concurrent applies with the same revision commit once; other account cannot use preset',async()=>{
 const db=fixture();await preset(db,'preset_save');const expected=loadoutStamp(saved(db),rev(db));
 const rs=await Promise.all([preset(db,'preset_apply',{p_expected:expected}),preset(db,'preset_apply',{p_expected:expected})]);assert.equal(rs.filter(x=>x.data.ok).length,1);assert.equal(rs.filter(x=>x.data.reason==='conflict').length,1);
 await assert.rejects(rpc(db,'gear_action',{p_action:'preset_apply',p_id:'foreign-preset-1',p_count:0,p_expected:expected},{id:'other'}));
});
