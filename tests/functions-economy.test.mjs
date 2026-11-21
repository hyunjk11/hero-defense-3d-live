import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {packSave} from '../src/account/storage.js';
import {STAGES} from '../src/data/stages.js';
import {waveBoss} from '../src/core/roster.js';
import {dungeonItems} from '../server/dungeon.mjs';
import * as GR from '../src/data/growth.js';
import * as SX from '../src/account/steel.js';
const now=1800000000000,iso=new Date(now).toISOString(),user={id:'economy-a',email:'a@example.invalid'};
const rng=(n=123)=>()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
function fixture(save=P.empty(),more={}){return new MemoryStore({hd3d_progress:[{user_id:user.id,data:packSave(save),merged:true,updated_at:iso}],...more});}
const saved=db=>P.clean(db.tables.hd3d_progress[0].data);
const rpc=(db,name,args={},o={})=>runEconomyOperation(db,user,{kind:'rpc',name:'hd3d_'+name,args},{now,random:rng(),...o});
const query=(db,save,stamp=iso,u=user)=>runEconomyOperation(db,u,{kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:stamp},values:{data:packSave(save),merged:true},returning:true},{now});
const funded=()=>{const s=P.empty();s.souls=100000;s.mat={steel:10000,crystal:1000,essence:100};return s;};
const receiptCount=db=>(db.tables.hd3d_growth_investments||[]).length;
function run(db,{token='normal-test',stage='1-1',wave=1,won=false,mode='campaign',hero='mage'}={}){
 db.tables.hd3d_growth_runs=[{id:user.id+'~'+token,user_id:user.id,token,stage,hero,mode,completed:wave,won,done:true,started_at:new Date(now-100000).toISOString(),repeat:!!saved(db).st[stage]}];return token;
}
const settle=(db,token,wave=1,kills=11,stars=0,bosses=[],extra={})=>rpc(db,'normal_settle',{p_token:token,p_wave:wave,p_kills:kills,p_stars:stars,p_drops:[],p_bossKills:bosses,...extra});

test('fresh save cannot import money, stages, equipment, codex or guest progress',async()=>{
 for(const edit of [s=>s.souls=777777,s=>s.st={'10-6':3},s=>s.mat.steel=99,s=>s.heroLv.mage.atk=10,s=>s.inv=[E.makeItem('armor',null,4,rng())]]){
  const s=P.empty();edit(s);const db=new MemoryStore();await assert.rejects(runEconomyOperation(db,user,{kind:'query',table:'hd3d_progress',action:'insert',values:{user_id:user.id,data:s,merged:true}},{now}),e=>e.code==='ECONOMY_ACTION_REQUIRED');assert(!db.tables.hd3d_progress);
 }
 const db=new MemoryStore();await runEconomyOperation(db,user,{kind:'query',table:'hd3d_progress',action:'insert',values:{user_id:user.id,data:P.empty(),merged:true}},{now});assert.equal(saved(db).souls,0);
});
test('generic save rejects every protected economy family and foreign identity',async()=>{
 const db=fixture(funded()),before=structuredClone(db.tables);
 const edits=[s=>s.souls++,s=>s.mat.steel++,s=>s.mat.crystal++,s=>s.mat.essence++,s=>s.heroLv.mage.hp++,s=>s.st={'1-1':3},s=>s.starRw++,s=>s.stats.runs++,s=>s.bestWave=9,s=>s.mailLog=[1],s=>s.inv=[E.makeItem('armor',null,4,rng())],s=>s.chests=[E.chestOf(E.makeItem('armor',null,4,rng()),'chest')],s=>s.adv.mage={b:'frost',n:1},s=>s.hardRewardSeq=1,s=>s.storX=1,s=>s.codexRw=['1:all']];
 for(const edit of edits){const s=saved(db);edit(s);await assert.rejects(query(db,s),e=>e.code==='ECONOMY_ACTION_REQUIRED');assert.deepEqual(db.tables,before);}
 await assert.rejects(query(db,saved(db),iso,{id:'b'}),e=>e.code==='42501');assert.deepEqual(db.tables,before);
});
test('cosmetics work; submitted growth cache is ignored; training uses exact price and CAS',async()=>{
 const db=fixture(funded()),s=saved(db);s.nick='fixture';s.settings.audio={bgm:.2,sfx:.5,bgmOn:false,sfxOn:true};s.growth={version:1,earned:999999,balance:999999};
 await query(db,s);assert.equal(saved(db).nick,'fixture');assert.equal(saved(db).growth,undefined);
 const stamp=db.tables.hd3d_progress[0].updated_at,before=saved(db),[next,ok]=P.buyPerm(before,'mage','hp');assert(ok);
 const out=await Promise.all([query(db,next,stamp),query(db,next,stamp)]);assert.equal(out.filter(r=>r.data.length).length,1);assert.equal(saved(db).souls,before.souls-P.permCost('hp',0));assert.equal(saved(db).heroLv.mage.hp,1);
 const paid=P.buyPerm(saved(db),'fighter','hp')[0];await assert.rejects(query(db,paid,db.tables.hd3d_progress[0].updated_at));
});
test('debounced training batch pays every increment; price forgery and refunds are rejected',async()=>{
 const db=fixture(funded());let next=saved(db);for(const [h,k] of [['mage','hp'],['mage','hp'],['mage','atk'],['warrior','hp']])next=P.buyPerm(next,h,k)[0];
 const forged=structuredClone(next);forged.souls++;await assert.rejects(query(db,forged));await query(db,next);assert.deepEqual(saved(db),next);
 const revert=P.empty();revert.souls=funded().souls;await assert.rejects(query(db,revert,db.tables.hd3d_progress[0].updated_at));
});
test('normal partial return is atomic, idempotent, bounded and preserves original reward formula',async()=>{
 const db=fixture(),t=run(db),r=await settle(db,t);assert.equal(r.data.souls,P.reward(1,11));assert.equal(saved(db).souls,11);assert.equal(saved(db).stats.runs,1);
 const before=structuredClone(db.tables);const results=await Promise.all([settle(db,t),settle(db,t)]);assert(results.every(r=>r.data.already));assert.deepEqual(db.tables,before);
 await assert.rejects(settle(db,t,1,12));assert.equal((await rpc(db,'normal_status',{p_token:t})).data.souls,11);
 await assert.rejects(rpc(db,'normal_status',{p_token:'other-run'}));
 const bad=fixture(),bt=run(bad);await assert.rejects(settle(bad,bt,1,1000000));assert.equal(saved(bad).souls,0);assert.equal(receiptCount(bad),0);
});
test('normal completion: server draws all loot, client legendary objects have no authority',async()=>{
 const originalNow=Date.now;Date.now=()=>now;
 try{const stage=STAGES['1-1'],wave=stage.waves,bosses=Array.from({length:wave},(_,i)=>i+1).filter(w=>waveBoss(stage,w));
  const a=fixture(),b=fixture();run(a,{wave,won:true});run(b,{wave,won:true});
  const first=await settle(a,'normal-test',wave,100,3,bosses),second=await settle(b,'normal-test',wave,100,3,bosses,{p_drops:[{g:4,m:['atk',999999],id:'forged'}]});
  assert.deepEqual(first,second);assert.deepEqual(saved(a),saved(b));assert(!JSON.stringify(saved(a)).includes('forged'));assert.equal(saved(a).st['1-1'],3);assert.equal(first.data.first,true);
  const r=rng(),drops=[];for(const w of bosses)if(r()<E.BOSS_DROP)drops.push(E.randomItem('mage',E.bossOdds(w),r,undefined,1));
  const [base]=P.applyRun(P.empty(),{wave,kills:100,drops,hero:'mage',stage:true,ch:1,bossKills:bosses},r);const [expected]=P.applyStage(base,'1-1',3,'mage',r);
  assert.deepEqual(saved(a),P.clean(expected));
 }finally{Date.now=originalNow;}
});
test('zero waves, wrong mode, premature finish, invalid boss and stage claims cannot grant money',async()=>{
 for(const config of [{wave:0,kills:1},{wave:3,kills:1},{wave:1,kills:1,bosses:[1]},{wave:1,kills:1,stars:3},{wave:1,kills:1,mode:'challenge'},{wave:1,kills:1,stage:'hard-1-1'}]){
  const db=fixture();run(db,{wave:config.wave===0?0:1,mode:config.mode,stage:config.stage});await assert.rejects(settle(db,'normal-test',config.wave,config.kills,config.stars||0,config.bosses||[]));assert.equal(saved(db).souls,0);
 }
 const db=fixture();run(db,{wave:0});assert.equal((await settle(db,'normal-test',0,0)).data.souls,0);
});
test('challenge rewards preserve open-chapter pool, waves, essence and retry receipt',async()=>{
 const db=fixture(),wave=50,token=run(db,{stage:null,wave,mode:'challenge'}),bosses=Array.from({length:wave},(_,i)=>i+1).filter(w=>waveBoss(null,w));
 const args={p_token:token,p_wave:wave,p_kills:1000,p_stars:0,p_drops:[],p_bossKills:bosses};const r=await rpc(db,'challenge_settle',args);
 assert.equal(r.data.kind,'challenge');assert.equal(saved(db).bestWave,50);assert(saved(db).chests.length>=10);assert(saved(db).chests.every(c=>c.it.c===1));
 const before=structuredClone(db.tables);assert.equal((await rpc(db,'challenge_settle',args)).data.already,true);assert.deepEqual(db.tables,before);
});
test('chest-cap automatic dismantle remains atomic and gives no false owned gear',async()=>{
 const s=funded();s.chests=Array.from({length:200},(_,i)=>{const it=E.makeItem('armor',null,0,rng(i));it.id='full-'+i;return E.chestOf(it,'chest');});
 const db=fixture(s),wave=STAGES['1-1'].waves,t=run(db,{wave,won:true}),out=await settle(db,t,wave,100,3);
 assert.equal(saved(db).chests.length,200);assert(out.data.loot.every(l=>l.auto));assert(saved(db).mat.steel>s.mat.steel);assert.deepEqual(saved(db).codex,s.codex);
});
test('gear open, codex, store/take, equip/unequip and dismantle preserve server-owned item',async()=>{
 const s=funded(),it=E.makeItem('weapon','mage',2,rng(),1);s.chests=[E.chestOf(it,'chest')];const db=fixture(s);let n=0;
 const act=(action,more={})=>rpc(db,'gear_action',{p_id:'gear-test-'+(++n),p_action:action,...more});
 assert((await act('open',{p_item:s.chests[0].id})).data.ok);assert.equal(saved(db).inv.length,1);assert(Object.keys(saved(db).codex).length);
 assert((await act('equip',{p_item:it.id,p_hero:'mage'})).data.ok);assert(!(await act('store',{p_item:it.id})).data.ok);
 assert((await act('unequip',{p_hero:'mage',p_slot:'weapon'})).data.ok);assert((await act('store',{p_item:it.id})).data.ok);assert.equal(saved(db).inv.length,0);
 assert((await act('take',{p_item:it.id})).data.ok);const before=saved(db).mat.steel;assert((await act('dismantle',{p_item:it.id})).data.ok);assert(saved(db).mat.steel>before);assert.equal(saved(db).inv.length,0);
});
test('enhancement keeps all ten levels, server RNG failure and exact debit; receipt prevents redraw',async()=>{
 const s=funded(),it=E.makeItem('weapon','mage',2,rng());s.inv=[it];const db=fixture(s);
 for(let i=0;i<10;i++){const before=saved(db),cost=E.enhCost(before.inv[0]),a={p_id:'enhance-'+i,p_action:'enhance',p_item:it.id};assert.equal((await rpc(db,'gear_action',a,{random:()=>0})).data.reason,'ok');assert.equal(saved(db).inv[0].e,i+1);assert.equal(saved(db).souls,before.souls-cost.souls);const paid=saved(db);assert((await rpc(db,'gear_action',a,{random:()=>.99})).data.already);assert.deepEqual(saved(db),paid);}
 assert.equal((await rpc(db,'gear_action',{p_id:'enhance-max',p_action:'enhance',p_item:it.id})).data.reason,'max');
 const f=funded();f.inv=[{...it,e:2}];const d=fixture(f);assert.equal((await rpc(d,'gear_action',{p_id:'enhance-fail',p_action:'enhance',p_item:it.id},{random:()=>.99})).data.reason,'fail');assert.equal(saved(d).inv[0].e,2);assert(saved(d).souls<f.souls);
});
test('craft, reroll and apply use server choices, locked chapter/hero and replay are rejected',async()=>{
 const db=fixture(funded()),a={p_id:'craft-test',p_action:'craft',p_recipe:'master',p_slot:'weapon',p_hero:'mage',p_ch:0};const r=await rpc(db,'gear_action',a);assert(r.data.ok);assert.equal(saved(db).inv[0].g,r.data.it.g);
 const before=saved(db);assert((await rpc(db,'gear_action',a)).data.already);assert.deepEqual(saved(db),before);
 await assert.rejects(rpc(db,'gear_action',{...a,p_recipe:'basic'}));await assert.rejects(rpc(db,'gear_action',{...a,p_id:'craft-locked',p_ch:9}));await assert.rejects(rpc(db,'gear_action',{...a,p_id:'craft-unowned',p_hero:'fighter'}));
 const roll=await rpc(db,'gear_action',{p_id:'reroll-test',p_action:'reroll',p_item:r.data.it.id});assert(roll.data.ok);
 const apply=await rpc(db,'gear_action',{p_id:'apply-reroll-test',p_action:'reroll_apply',p_item:r.data.it.id,p_source:'reroll-test'});assert(apply.data.ok);assert.deepEqual(saved(db).inv[0].sub,roll.data.sub);
 await assert.rejects(rpc(db,'gear_action',{p_id:'apply-invented',p_action:'reroll_apply',p_item:r.data.it.id,p_source:'invented'}));
});
test('craft identity collision aborts without price loss, chest loss or paid receipt',async()=>{
 const real=Date.now;Date.now=()=>now;
 try{const s=funded(),it=E.randomItem('mage',E.RECIPES[0].odds,()=>.1,'weapon');s.chests=[E.chestOf(it,'chest')];const db=fixture(s),before=structuredClone(db.tables);
 await assert.rejects(rpc(db,'gear_action',{p_id:'collision-test',p_action:'craft',p_recipe:'basic',p_slot:'weapon',p_hero:'mage',p_ch:0},{random:()=>.1}),e=>e.code==='ITEM_ID_COLLISION');assert.deepEqual(db.tables,before);
 }finally{Date.now=real;}
});
test('mail money/items/hero/medals commit together, preserve caps and cannot double claim',async()=>{
 const s=funded();s.souls=1e9-100;const m={id:1,user_id:user.id,claimed:false,reward:{souls:100,medals:10,hero:'fighter',items:[{k:'gear',s:'armor',g:0,c:1}]}},db=fixture(s,{hd3d_mail:[m]});
 const out=await Promise.all([rpc(db,'claim_mail',{p_mail_id:1}),rpc(db,'claim_mail',{p_mail_id:1})]);assert(out.every(r=>r.data.serverSaved));assert.equal(saved(db).souls,1e9);assert.equal(saved(db).chests.length,1);assert.equal(db.tables.hd3d_dungeon_wallet[0].medals,10);assert.equal(db.tables.hd3d_owned.length,1);assert.equal(out.filter(r=>r.data.already).length,1);
 const before=structuredClone(db.tables);await assert.rejects(runEconomyOperation(db,{id:'b'},{kind:'rpc',name:'hd3d_claim_mail',args:{p_mail_id:1}},{now}));assert.deepEqual(db.tables,before);
});
test('committed normal response lost then concurrent retry grants exactly once',async()=>{
 const db=fixture();run(db);let lost=true;const transport={transaction:async(fn,o)=>{const r=await db.transaction(fn,o);if(lost){lost=false;throw Error('simulated response loss');}return r;}};
 await assert.rejects(settle(transport,'normal-test'));assert.equal(saved(db).souls,11);const out=await Promise.all([settle(transport,'normal-test'),settle(transport,'normal-test')]);assert(out.every(r=>r.data.already));assert.equal(saved(db).souls,11);assert.equal(saved(db).stats.runs,1);
});
test('research, barricade and daily exchange use original exact server prices and caps',async()=>{
 const db=fixture(funded()),act=(id,action,extra={})=>rpc(db,'gear_action',{p_id:id,p_action:action,...extra});
 const before=saved(db),cost=GR.resCost('atk',0);assert((await act('research-test','research',{p_type:'arrow',p_stat:'atk'})).data.ok);assert.equal(saved(db).research.arrow.atk,1);assert.equal(saved(db).souls,before.souls-cost.souls);
 const steel=saved(db).mat.steel;assert((await act('bar-test','bar')).data.ok);assert.equal(saved(db).barLv,1);assert.equal(saved(db).mat.steel,steel-SX.barCost(0));
 const s=saved(db);assert((await act('exchange-test','exchange',{p_count:15})).data.ok);assert.equal(saved(db).souls,s.souls+15*SX.XCH.souls);assert.equal(saved(db).mat.steel,s.mat.steel-15*SX.XCH.steel);
 assert.equal((await act('exchange-over','exchange',{p_count:1})).data.reason,'cap');const paid=saved(db);assert((await act('exchange-test','exchange',{p_count:15})).data.already);assert.deepEqual(saved(db),paid);
});
test('barricade Lv.10 saves continue to Lv.20 with exact steel prices and replay protection',async()=>{
 const base=funded();base.barLv=10;const db=fixture(base);
 const act=(id)=>rpc(db,'gear_action',{p_id:id,p_action:'bar'});
 for(let lv=10;lv<20;lv++){
  const before=saved(db),id='bar-extension-'+lv;
  assert.equal(before.barLv,lv);
  const out=await Promise.all([act(id),act(id)]);
  assert(out.every(r=>r.data.ok));assert.equal(out.filter(r=>r.data.already).length,1);
  assert.equal(db.tables.hd3d_progress[0].data.barLv,lv+1);
  assert.equal(saved(db).mat.steel,before.mat.steel-(40+20*lv));
 }
 const after=saved(db),rows=structuredClone(db.tables.hd3d_progress);
 assert.equal(after.barLv,20);assert.equal(after.mat.steel,base.mat.steel-3300);
 assert.equal(after.souls,base.souls);assert.equal(after.mat.crystal,base.mat.crystal);assert.equal(after.mat.essence,base.mat.essence);
 assert.equal((await act('bar-over-cap')).data.ok,false);
 const stale={...after,barLv:10};
 await assert.rejects(query(db,stale,rows[0].updated_at),e=>e.code==='ECONOMY_ACTION_REQUIRED');
 assert.deepEqual(db.tables.hd3d_progress,rows);
 const poor=funded();poor.barLv=10;poor.mat.steel=239;
 const low=fixture(poor);
 assert.equal((await rpc(low,'gear_action',{p_id:'bar-too-poor',p_action:'bar'})).data.ok,false);
 assert.equal(saved(low).barLv,10);assert.equal(saved(low).mat.steel,239);
});
test('dungeon purchase receipt debits once and its mail credits server save once',async()=>{
 const [item,def]=Object.entries(dungeonItems).find(([,d])=>d.reward?.souls),db=fixture(P.empty(),{hd3d_dungeon_wallet:[{user_id:user.id,medals:1000,earned:1000,spent:0,titles:[],uniques:[],uq_pity:0}]});
 const a={p_id:'dungeon-purchase',p_item:item},out=await Promise.all([rpc(db,'dungeon_buy',a),rpc(db,'dungeon_buy',a)]);assert(out.every(r=>r.data.ok));assert.equal(db.tables.hd3d_dungeon_wallet[0].medals,1000-def.price);assert.equal(db.tables.hd3d_mail.length,1);
 const claim=await rpc(db,'claim_mail',{p_mail_id:out[0].data.mail});assert(claim.data.serverSaved);assert.equal(saved(db).souls,def.reward.souls);await rpc(db,'claim_mail',{p_mail_id:out[0].data.mail});assert.equal(saved(db).souls,def.reward.souls);
 await assert.rejects(rpc(db,'dungeon_buy',{...a,p_item:'invented'}));
});
test('mail overflow defers all balances, gear, ownership and claimed state until room exists',async()=>{
 const s=funded();s.souls=1e9-1;s.mat.steel=1e7-1;
 const mail={id:21,user_id:user.id,claimed:false,reward:{souls:100,steel:100,medals:10,hero:'fighter',items:[{k:'gear',s:'armor',g:0,c:1}]}},db=fixture(s,{hd3d_mail:[mail]}),before=structuredClone(db.tables);
 for(let i=0;i<2;i++){const r=await rpc(db,'claim_mail',{p_mail_id:21});assert.equal(r.data.deferred,true);assert.deepEqual(r.data.limits,['souls','steel']);assert.deepEqual(db.tables,before);}
 const room=saved(db);room.souls-=100;room.mat.steel-=100;db.tables.hd3d_progress[0].data=packSave(room);
 const r=await rpc(db,'claim_mail',{p_mail_id:21});assert(r.data.ok);assert.equal(saved(db).souls,1e9-1);assert.equal(saved(db).mat.steel,1e7-1);assert.equal(saved(db).chests.length,1);assert.equal(db.tables.hd3d_owned.length,1);assert.equal(db.tables.hd3d_dungeon_wallet[0].medals,10);
 const paid=structuredClone(db.tables);assert((await rpc(db,'claim_mail',{p_mail_id:21})).data.already);assert.deepEqual(db.tables,paid);
});
test('mail material and medal caps include automatic dismantle yields and are atomic',async()=>{
 for(const key of ['steel','crystal','essence']){const s=funded();s.mat[key]=1e7;const db=fixture(s,{hd3d_mail:[{id:22,user_id:user.id,claimed:false,reward:{[key]:1}}]}),before=structuredClone(db.tables);assert((await rpc(db,'claim_mail',{p_mail_id:22})).data.deferred);assert.deepEqual(db.tables,before);}
 const s=funded();s.mat.steel=1e7;s.chests=Array.from({length:200},(_,i)=>{const it=E.makeItem('armor',null,0,rng(i));it.id='capacity-'+i;return E.chestOf(it,'chest');});
 const db=fixture(s,{hd3d_mail:[{id:23,user_id:user.id,claimed:false,reward:{items:[{k:'gear',s:'armor',g:0,c:1}]}}]}),before=structuredClone(db.tables);assert((await rpc(db,'claim_mail',{p_mail_id:23})).data.deferred);assert.deepEqual(db.tables,before);
 const medals=fixture(funded(),{hd3d_mail:[{id:24,user_id:user.id,claimed:false,reward:{medals:1}}],hd3d_dungeon_wallet:[{user_id:user.id,medals:1000000,earned:1000000,spent:0}]});const mb=structuredClone(medals.tables);assert((await rpc(medals,'claim_mail',{p_mail_id:24})).data.deferred);assert.deepEqual(medals.tables,mb);
});
test('generated duplicate rewards cannot masquerade as full-capacity dismantling',async()=>{
 const old=Date.now;Date.now=()=>now;
 try{const db=fixture(),t=run(db,{stage:null,wave:10,mode:'challenge'}),before=structuredClone(db.tables),args={p_token:t,p_wave:10,p_kills:20,p_stars:0,p_drops:[],p_bossKills:[]};
 await assert.rejects(rpc(db,'challenge_settle',args,{random:()=>.1}),e=>e.code==='ITEM_ID_COLLISION');assert.deepEqual(db.tables,before);
 const out=await rpc(db,'challenge_settle',args);assert(out.data.ok);assert.equal(saved(db).chests.length,2);assert(out.data.loot.every(x=>!x.auto));assert.equal(saved(db).mat.steel,0);
 }finally{Date.now=old;}
});
test('normal settlement accepts the complete growth token length range',async()=>{
 for(const length of [8,64,65,70,80]){const db=fixture(),token='x'.repeat(length);assert((await rpc(db,'growth_start',{p_id:token,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'})).data.ok);
 assert((await rpc(db,'growth_progress',{p_token:token,p_completed:1,p_win:false,p_finish:true},{now:now+10000})).data.ok);
 const args={p_token:token,p_wave:1,p_kills:3,p_stars:0,p_drops:[],p_bossKills:[]};assert((await rpc(db,'normal_settle',args,{now:now+10000})).data.ok);assert.equal(saved(db).souls,9);assert((await rpc(db,'normal_settle',args,{now:now+10000})).data.already);
 }
});
test('consumable economy capacity failures preserve the original item, chest and paid receipt',async()=>{
 const s=funded();s.mat.steel=1e7;const it=E.makeItem('armor',null,0,rng());s.inv=[it];
 const db=fixture(s),before=structuredClone(db.tables),a={p_id:'capacity-dismantle',p_action:'dismantle',p_item:it.id};
 for(let i=0;i<2;i++){const r=await rpc(db,'gear_action',a);assert.equal(r.data.reason,'balance_limit');assert.equal(r.data.ok,false);assert.deepEqual(db.tables,before);}
 const room=saved(db);room.mat.steel-=2;db.tables.hd3d_progress[0].data=packSave(room);assert((await rpc(db,'gear_action',a)).data.ok);assert.equal(saved(db).inv.length,0);assert.equal(saved(db).mat.steel,1e7);
 const chestSave=funded();chestSave.souls=1e9;chestSave.chests=[E.chestOf(it,'chest')];const cb=fixture(chestSave),old=structuredClone(cb.tables);
 assert.equal((await rpc(cb,'gear_action',{p_id:'capacity-open',p_action:'open',p_item:chestSave.chests[0].id})).data.reason,'balance_limit');assert.deepEqual(cb.tables,old);
 const ex=fixture({...funded(),souls:1e9}),eb=structuredClone(ex.tables);assert.equal((await rpc(ex,'gear_action',{p_id:'capacity-exchange',p_action:'exchange',p_count:1})).data.reason,'balance_limit');assert.deepEqual(ex.tables,eb);
});
