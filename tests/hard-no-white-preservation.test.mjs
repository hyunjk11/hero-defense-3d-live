import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../server/memory-store.mjs';
import { execute } from '../server/operations.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import * as H from '../src/data/hero-growth.js';
import { HARD_STAGES } from '../src/data/hard.js';
const user={id:'collect-a',email:'a@example.invalid'},other={id:'collect-b',email:'b@example.invalid'};
function fixture(repeat=true){
 let now=1793600000000;const data=P.clean({...P.empty(),souls:1000,st:{'10-6':3,'1-1':3}});
 const wallet={...H.initialGrowth(data),user_id:user.id,hard:{version:1,st:Object.fromEntries(Object.keys(HARD_STAGES).map(id=>[id,3]))}};
 if(!repeat)delete wallet.hard.st['hard-5-1'];
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[wallet]});
 const call=(name,args={},u=user)=>db.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_'+name,args},{now,random:()=>.1})).then(r=>r.data);
 const start=(id,stage='hard-5-1',extra={})=>call('start',{p_id:id,p_mode:'campaign',p_stage:stage,p_hero:'mage',p_target:'gunner',...extra});
 const finish=(id,stage='hard-5-1',extra={})=>call('progress',{p_token:id,p_completed:HARD_STAGES[stage].waves,p_win:true,p_finish:true,p_stars:3,p_kills:11,...extra});
 return {db,call,start,finish,tick:()=>now+=120000,save:()=>db.tables.hd3d_progress[0].data};
}


test('hard3+ new repeat rewards contain no white gear and preserve old white gear/chests/codex/mail',async()=>{
 const f=fixture();const old=E.makeItem('weapon','mage',0,()=>.1,3);old.id='old-white-inv';f.save().inv.push(old);E.addChests(f.save(),[{it:{...old,id:'old-white-box'},src:'chest'}]);f.save().codex={3:{mage:1}};
 f.db.tables.hd3d_mail=[{id:987,user_id:user.id,reward:{items:[{k:'gear',s:'weapon',h:'mage',g:0,c:3}]},claimed:false,revoked:false}];
 const baseline={inv:structuredClone(f.save().inv),chest:structuredClone(f.save().chests[0]),codex:structuredClone(f.save().codex),mail:structuredClone(f.db.tables.hd3d_mail[0])};
 for(const ch of [3,4,5,6]) { const id='no-white-'+ch,stage='hard-'+ch+'-1';const n=f.save().chests.length;assert.equal((await f.start(id,stage)).ok,true);f.tick();const r=await f.finish(id,stage);assert.equal(r.ok,true);const added=f.save().chests.slice(n);assert.ok(added.length>2);assert.ok(added.every(x=>x.it.g>=1));assert.ok(added.slice(-2).every(x=>x.it.g===1));const settled=structuredClone(f.db.tables);assert.equal((await f.finish(id,stage)).already,true);assert.deepEqual(f.db.tables,settled); }
 assert.deepEqual(f.save().inv,baseline.inv);assert.deepEqual(f.save().chests[0],baseline.chest);assert.deepEqual(f.save().codex,baseline.codex);assert.deepEqual(f.db.tables.hd3d_mail[0],baseline.mail);
});
test('hard1 and hard2 still issue original white collection reward under identical RNG',async()=>{for(const ch of [1,2]) {const f=fixture(),stage='hard-'+ch+'-1',id='low-chapter-'+ch;await f.start(id,stage);f.tick();assert.equal((await f.finish(id,stage)).ok,true);assert.ok(f.save().chests.slice(-2).every(x=>x.it.g===0));}});
test('first-clear special chest in hard3+ remains epic; prior white receipt is never rerolled',async()=>{const f=fixture(false);await f.start('first-no-white','hard-5-1');f.tick();const r=await f.finish('first-no-white');assert.equal(r.ok,true);assert.ok(f.save().chests.every(x=>x.it.g>=1));assert.equal(f.save().chests.at(-1).it.g,3);const before=structuredClone(f.db.tables);assert.equal((await f.finish('first-no-white')).already,true);assert.deepEqual(f.db.tables,before);});
