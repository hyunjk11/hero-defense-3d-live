import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/data/hero-growth.js';

globalThis.location=new URL('https://hyunjk11.github.io/hero-defense-3d-live/?mobileApp=1');
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
globalThis.addEventListener=()=>{};
globalThis.document={addEventListener(){},visibilityState:'visible'};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_k,fn)=>fn()}},configurable:true});
const A=await import('../src/account/account.js'),C=await import('../src/account/hero-growth.js');

test('the same Pages build keeps Android starts and checkpoints on the existing Hard contract',async()=>{
 const calls=[],wallet=H.initialGrowth();
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='hd3d_growth_status')return {data:{ok:true,version:1,features:{hard:1,hardParty:1,hardFirstBonus:1},growth:wallet}};
  if(name==='hd3d_growth_start')return {data:{ok:true,token:args.p_id,repeat:false,party:[args.p_hero,args.p_partner],loadouts:{[args.p_hero]:{},[args.p_partner]:{}}}};
  throw Error('No memory-only progress available');
 }};
 Object.assign(A.A,{user:{id:'mobile-qa'},mode:'account',sb,hydrated:true,tables:'ok',sync:'saved',banned:false,conflict:null});
 for(const fn of A.A.listeners)fn();
 const run=await C.startRun('hard-1-1','mage');
 assert.ok(run);
 assert.equal(Object.hasOwn(calls.find(x=>x.name==='hd3d_growth_start').args,'p_hardFirstBonus'),false);
 assert.equal(Object.hasOwn(run,'hardFirstBonus'),false);
 assert.equal(await C.checkpoint(run,10,true,true,3,10,[5,10]),true);
 const out=JSON.parse(store.get('hd3d_live_growth_v1_mobile-qa_outbox')).rewards[run.token];
 assert.equal(Object.hasOwn(out,'p_bossKills'),false);
});
