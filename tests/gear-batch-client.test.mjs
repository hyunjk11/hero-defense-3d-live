import assert from 'node:assert/strict';
import {FirestoreStore} from '../server/firestore.mjs';
import {FirestoreTransport} from './support/firestore-transport.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {packSave} from '../src/account/storage.js';
import {CLOUD} from '../src/config/cloud.js';
const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.addEventListener=()=>{};globalThis.location={hostname:'localhost',search:''};
let user={id:'batch-client-a',email:'a@example.invalid'},now=1800000000000,reads=0,rpcs=0,lost=false,pause=null,wrongSnapshot=false;
const data=P.empty();data.nick='QA';for(let i=0;i<12;i++){const it=E.makeItem('armor',null,0,()=>.4,1);it.id='client-item-'+i;data.chests.push(E.chestOf(it,'chest'));}
const db=new FirestoreTransport({hd3d_progress:['batch-client-a','batch-client-b'].map(uid=>({user_id:uid,data:packSave(data),merged:true,updated_at:new Date(now).toISOString()})),hd3d_profiles:['batch-client-a','batch-client-b'].map(id=>({id,nickname:'QA'}))}),store=new FirestoreStore(db.request);
const client={atomicGear:true,serverEconomy:true,auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user}}),signOut:async()=>({})},
 from(table){let action='select',values,filters={},returning=false;const q={select(){returning=action!=='select';return q;},eq(k,v){filters[k]=v;return q;},update(v){action='update';values=v;return q;},insert(v){action='insert';values=v;return q;},upsert:async()=>({}),
 maybeSingle:async()=>{reads++;return {data:structuredClone(db.rows(table).find(r=>(r.user_id||r.id)===user.id)||null)};},
 then(a,b){return runEconomyOperation(store,user,{kind:'query',table,action,values,filters,returning},{now:++now}).then(a,b);}};return q;},
 async rpc(name,args){rpcs++;const owner=user;const r=await runEconomyOperation(store,owner,{kind:'rpc',name,args},{now:++now});if(pause){const p=pause;pause=null;p.started();await p.wait;}if(lost){lost=false;return {error:{code:'NETWORK_ERROR',message:'lost after commit'}};}if(wrongSnapshot&&r.data.snapshot){wrongSnapshot=false;r.data.snapshot.progress.user_id='other';}return r;}
};
globalThis.window={__hd3dCloudMock:()=>client};const Acc=await import('../src/account/account.js');await Acc.signIn(user.email,'unused');const Gear=await import('../src/account/direct-gear-client.js');
const cmds=(start,n)=>Array.from({length:n},(_,k)=>({p_action:'open',p_item:'cclient-item-'+(start+k)}));
reads=0;rpcs=0;await Gear.runDirectGear(cmds(0,10));assert.equal(rpcs,1);assert.equal(reads,0);assert.equal(Acc.load().inv.length,10);assert.equal(Acc.load().chests.length,2);assert.equal(Acc.serverSaveState(),null);console.log('PASS ten chests one RPC and zero follow-up reads; actual account reconciliation');
lost=true;await assert.rejects(Gear.runDirectGear(cmds(10,1)),/lost/);assert.equal(Gear.pendingGear().index,0);assert.equal(Acc.load().inv.length,10);assert.equal(P.clean(db.rows('hd3d_progress')[0].data).inv.length,11);await Gear.runDirectGear();assert.equal(Acc.load().inv.length,11);assert.equal(db.rows('hd3d_growth_investments').length,11);console.log('PASS unknown committed response recovers original receipt without duplicate');
reads=0;wrongSnapshot=true;await Gear.runDirectGear([{p_action:'equip',p_item:'client-item-0',p_hero:'mage'}]);assert.equal(reads,2);assert.equal(Acc.load().eq.mage.armor,'client-item-0');console.log('PASS foreign snapshot rejected; authoritative reload fallback');
let release,started;const begun=new Promise(r=>started=r);pause={started,wait:new Promise(r=>release=r)};const late=Gear.runDirectGear(cmds(11,1));await begun;assert.throws(()=>Acc.update(s=>s));await assert.rejects(Gear.runDirectGear(cmds(11,1)));await Acc.signOut();user={id:'batch-client-b',email:'b@example.invalid'};await Acc.signIn(user.email,'unused');release();await assert.rejects(late);assert.equal(Acc.load().inv.length,0);assert.equal(Acc.serverSaveState(),null);console.log('PASS repeat clicks and late response cannot change another account');
await Acc.signOut();user={id:'batch-client-a',email:'a@example.invalid'};await Acc.signIn(user.email,'unused');for(let i=0;i<100&&Gear.pendingGear();i++)await new Promise(r=>setTimeout(r,1));assert.equal(Gear.pendingGear(),null);assert.equal(Acc.load().inv.length,12);console.log('PASS original account reconnect recovers pending batch');
// A forged/old snapshot outside the current job must not be adopted.
assert.equal(await Acc.acceptEconomySnapshot({progress:db.rows('hd3d_progress')[0]},null),false);
// Mixed unsupported actions keep their old path. Missing endpoint alone permits
// fallback, whereas lost responses above did not replay single actions.
const oldRpc=client.rpc;let oldCalls=[];client.rpc=async(name,args)=>{oldCalls.push(name);if(name==='hd3d_gear_batch')return {error:{code:'PGRST202',message:'unsupported operation'}};return oldRpc(name,args);};
await Gear.runDirectGear([{p_action:'unequip',p_hero:'mage',p_slot:'armor'}]);assert.deepEqual(oldCalls,['hd3d_gear_batch','hd3d_gear_action']);assert(!Acc.load().eq.mage.armor);console.log('PASS old deployment fallback only after explicit unsupported-operation');
await Acc.signOut();
