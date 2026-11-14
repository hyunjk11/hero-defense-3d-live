import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/data/hero-growth.js';
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
globalThis.localStorage=storage;globalThis.sessionStorage={...storage};globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
let tail=Promise.resolve();Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_k,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}}},configurable:true});
const A=await import('../src/account/account.js'),C=await import('../src/account/hero-growth.js'),P=await import('../src/account/hard-party.js'),S=await import('../src/account/shop.js');
const wallet=H.initialGrowth(),calls=[];let feature=1,lose=false,hold=null,reached,release,bad=false;
const sb={rpc:async(name,args)=>{
 if(name==='hd3d_my_status')return{data:{admin:false,banned:false}};
 calls.push({name,args:structuredClone(args)});
 if(hold===name){reached();await new Promise(r=>release=r);}
 if(name==='hd3d_growth_status')return{data:{ok:true,version:1,features:{hard:1,hardParty:feature},growth:wallet}};
 if(name==='hd3d_growth_start'){
  if(lose){lose=false;throw Error('response lost');}
  return{data:{ok:true,token:args.p_id,growth:wallet,party:bad?['mage','mage']:[args.p_hero,args.p_partner],loadouts:{[args.p_hero]:{heroLevel:10},[args.p_partner]:{heroLevel:20}}}};
 }
 throw Error(name);
}};
const login=id=>{Object.assign(A.A,{user:{id},mode:'account',sb,hydrated:true,tables:'ok',sync:'saved',banned:false,conflict:null});for(const f of A.A.listeners)f();S.S.ownedUid=id;S.S.owned=['hero_fighter'];};
test('partner preference is owned, distinct and account isolated; full storage cannot fake a choice',()=>{
 login('party-client-a');assert.ok(!P.partners('mage').includes('mage'));assert.ok(P.partners('mage').includes('fighter'));assert.ok(!P.partners('mage').includes('gunner'));
 assert.equal(P.writePartner('mage','fighter'),true);login('party-client-b');assert.equal(P.readPartner('mage'),'archer');P.writePartner('mage','warrior');login('party-client-a');assert.equal(P.readPartner('mage'),'fighter');
 const old=storage.setItem;storage.setItem=()=>{throw Error('full');};assert.equal(P.writePartner('mage','warrior'),false);storage.setItem=old;assert.equal(P.readPartner('mage'),'fighter');assert.equal(P.writePartner('mage','mage'),false);
});
test('start retry preserves exact two-hero request and acknowledged frozen loadouts',async()=>{
 login('party-client-a');lose=true;const from=calls.length,r=await C.startRun('hard-1-1','mage'),starts=calls.slice(from).filter(x=>x.name==='hd3d_growth_start');
 assert.ok(r);assert.equal(starts.length,2);assert.deepEqual(starts[0],starts[1]);assert.deepEqual(r.party,['mage','fighter']);P.writePartner('mage','warrior');assert.deepEqual(r.party,['mage','fighter']);assert.equal(r.loadouts.fighter.heroLevel,20);
});
test('old server and malformed party replies fail closed without starting a local party',async()=>{
 feature=0;const n=calls.filter(x=>x.name==='hd3d_growth_start').length;assert.equal(await C.startRun('hard-1-1','mage'),null);assert.equal(calls.filter(x=>x.name==='hd3d_growth_start').length,n);
 feature=1;bad=true;assert.equal(await C.startRun('hard-1-1','mage'),null);bad=false;
});
test('late A status or start response cannot start a battle or update B growth',async()=>{
 for(const name of ['hd3d_growth_status','hd3d_growth_start']){
  login('party-client-a');hold=name;const seen=new Promise(r=>reached=r),run=C.startRun('hard-1-1','mage');await seen;login('party-client-b');release();hold=null;
  assert.equal(await run,null);assert.equal(C.HG.growth,null);assert.equal(C.HG.owner,'party-client-b');
 }
});
