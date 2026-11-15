import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {execute} from '../server/operations.mjs';
import * as P from '../src/account/progress.js';
import * as H from '../src/data/hero-growth.js';
import {HARD_STAGES} from '../src/data/hard.js';
import {VISIBLE_HEROES} from '../src/data/heroes.js';
import {ADV} from '../src/data/advance.js';
const user={id:'party-a',email:'party-a@example.invalid'},other={id:'party-b',email:'party-b@example.invalid'};
function fixture(){let now=1800000000000;const data=P.empty();data.st={'10-6':3,'1-1':3};data.souls=1000;
 const w={...H.initialGrowth(data),user_id:user.id,hard:{version:1,st:Object.fromEntries(Object.keys(HARD_STAGES).map(id=>[id,3]))}};
 for(const [i,h]of VISIBLE_HEROES.entries()){data.heroLv[h]={hp:i+1,atk:i+2};data.adv[h]={b:Object.keys(ADV[h])[0],n:1};w.xp[h]=H.totalXP(10+i*5);}
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[w],hd3d_owned:['fighter','gunner'].map(h=>({user_id:user.id,item:'hero_'+h}))});
 const call=(name,args={},who=user)=>db.transaction(tx=>execute(tx,who,{kind:'rpc',name:'hd3d_growth_'+name,args},{now,random:()=>.1})).then(r=>r.data);
 const start=(id,main='mage',partner='warrior',stage='hard-1-1',extra={})=>call('start',{p_id:id,p_mode:'campaign',p_stage:stage,p_hero:main,p_partyVersion:1,p_partner:partner,...extra});
 const end=(id,stage='hard-1-1',extra={})=>call('progress',{p_token:id,p_completed:HARD_STAGES[stage].waves,p_win:true,p_finish:true,p_stars:3,p_kills:11,...extra});
 return {db,call,start,end,tick:()=>now+=180000,save:()=>db.tables.hd3d_progress[0].data};}

test('all 20 distinct owned public pairs receive server-derived separate loadouts',async()=>{
 const f=fixture();assert.equal((await f.call('status')).features.hardParty,1);
 for(const main of VISIBLE_HEROES)for(const sub of VISIBLE_HEROES){if(main===sub)continue;
  const r=await f.start(`pair-${main}-${sub}`,main,sub);assert.equal(r.ok,true);assert.deepEqual(r.party,[main,sub]);
  for(const h of r.party){assert.equal(r.loadouts[h].heroLevel,H.levelOf(f.db.tables.hd3d_growth_wallet[0].xp[h]));assert.deepEqual(r.loadouts[h].perm,f.save().heroLv[h]);assert.equal(r.loadouts[h].adv.h,h);}
  assert.notDeepEqual(r.loadouts[main],r.loadouts[sub]);
 }
});
test('partner, mode, future hard stage and ownership cannot be forged',async()=>{
 const f=fixture();for(const [i,p] of ['mage','mechanic','missing',null,{},['warrior']].entries())assert.equal((await f.start('invalid-pair-'+i,'mage',p)).reason,'invalid_party');
 for(const s of ['1-1','hard-7-1',null])assert.equal((await f.start('mode-invalid-'+String(s),'mage','warrior',s)).ok,false);
 assert.equal((await f.start('invalid-version','mage','warrior','hard-1-1',{p_partyVersion:2})).ok,false);
 f.db.tables.hd3d_owned=[];assert.equal((await f.start('unowned-partner','mage','fighter')).ok,false);
 assert.equal((await f.start('unowned-main','fighter','mage')).ok,false);
 assert.equal((await f.call('start',{p_id:'foreign-account',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage',p_partner:'warrior',p_partyVersion:1},other)).reason,'locked');
});
test('replayed/concurrent starts are identical; changes to live growth do not replace frozen loadouts',async()=>{
 const f=fixture(),rs=await Promise.all([f.start('same-request'),f.start('same-request')]);assert.deepEqual(rs[0].party,rs[1].party);assert.deepEqual(rs[0].loadouts,rs[1].loadouts);assert.equal(f.db.tables.hd3d_growth_runs.length,1);
 f.save().heroLv.warrior.atk=30;f.save().adv.warrior.b='berserk';f.db.tables.hd3d_growth_wallet[0].xp.warrior=H.totalXP(50);
 assert.deepEqual((await f.start('same-request')).loadouts,rs[0].loadouts);
 assert.equal((await f.start('same-request','mage','archer')).reason,'id_reused');
 assert.equal((await f.call('start',{p_id:'same-request',p_hero:'mage',p_mode:'campaign',p_stage:'hard-1-1'})).reason,'id_reused');
 const next=await f.start('new-request');assert.equal(next.loadouts.warrior.heroLevel,50);assert.equal(next.loadouts.warrior.adv.k,'berserk');
});
test('two heroes keep one reward receipt: duplicate finish, lost response and separate legitimate run',async()=>{
 const f=fixture();await f.start('finish-pair-one');f.tick();const before=structuredClone(f.save()),rs=await Promise.all([f.end('finish-pair-one'),f.end('finish-pair-one')]);
 assert.ok(rs.every(x=>x.ok));assert.equal(f.save().hardRewardSeq,1);assert.equal(f.save().stats.kills,11);assert.equal(f.save().chests.length,Math.floor(HARD_STAGES['hard-1-1'].waves/5)+2);
 assert.deepEqual(f.save().eq,before.eq);assert.deepEqual(f.save().heroLv,before.heroLv);
 const tables=structuredClone(f.db.tables);assert.equal((await f.end('finish-pair-one')).already,true);assert.deepEqual(f.db.tables,tables);
 await f.start('finish-pair-two');f.tick();await f.end('finish-pair-two');assert.equal(f.save().hardRewardSeq,2);
 assert.equal((await f.call('progress',{p_token:'finish-pair-one',p_completed:1,p_win:false,p_finish:true},other)).reason,'bad_token');
});
test('legacy one-hero sessions and ordinary stages remain valid and cannot be upgraded on replay',async()=>{
 const f=fixture();for(const [i,stage]of ['1-1','hard-1-1'].entries()){const a={p_id:'legacy-party-'+i,p_hero:'mage',p_mode:'campaign',p_stage:stage};const r=await f.call('start',a);assert.equal(r.ok,true);assert.equal(r.party,undefined);assert.equal((await f.call('start',a)).ok,true);assert.equal((await f.start(a.p_id)).ok,false);}
 f.tick();assert.equal((await f.end('legacy-party-1')).ok,true);
});
test('partial and failed returns keep existing reward rules; commit failure does not lose or duplicate rewards',async()=>{
 const f=fixture();await f.start('partial-party');f.tick();const r=await f.end('partial-party','hard-1-1',{p_completed:1,p_win:false});assert.equal(r.ok,true);assert.equal(r.hardReward.chests,0);
 await f.start('atomic-party');f.tick();const before=structuredClone(f.db.tables);
 await assert.rejects(f.db.transaction(async tx=>{await execute(tx,user,{kind:'rpc',name:'hd3d_growth_progress',args:{p_token:'atomic-party',p_completed:HARD_STAGES['hard-1-1'].waves,p_win:true,p_finish:true}},{now:1800000360000,random:()=>.1});throw Error('QA commit loss');}));
 assert.deepEqual(f.db.tables,before);await f.end('atomic-party');const after=structuredClone(f.db.tables);await f.end('atomic-party');assert.deepEqual(f.db.tables,after);
});
