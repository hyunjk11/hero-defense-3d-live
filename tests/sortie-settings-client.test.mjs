import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGrowth } from '../src/data/hero-growth.js';
const storage = () => { const m = new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}; };
globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.addEventListener=()=>{};
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={hostname:'localhost',search:''};
let tail=Promise.resolve();Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_key,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}}}});
const A=await import('../src/account/account.js'), H=await import('../src/account/hero-growth.js'), T=await import('../src/account/repeat-target.js'), P=await import('../src/account/sortie-party.js'), B=await import('../src/account/hard-party.js');
const wallet=initialGrowth(), calls=[], receipts=new Set();let lose=false, fail=false, conflict=false, loseEntry=false, partner='archer';
const sb={serverEconomy:true,rpc:async(name,args)=>{
 calls.push([name,structuredClone(args)]);
 const ack=(ok=true)=>({data:{ok,version:1,features:{sortieSettings:1,repeatTarget:1},growth:structuredClone(wallet),battlePartner:partner}});
 if(name.endsWith('_status'))return ack();
 if(name==='hd3d_dungeon_start')return {data:{ok:true,token:crypto.randomUUID(),floors_limit:10}};
 if(name==='hd3d_spire_start'){if(loseEntry){loseEntry=false;throw Error('lost entry');}return {data:{ok:true,token:crypto.randomUUID(),request:args.p_id,from:args.p_from}};}
 if(name.endsWith('_start'))return {data:{ok:true,token:args.p_id,repeat:true,target:args.p_target,growth:structuredClone(wallet)}};
 assert.equal(name,'hd3d_growth_sortie_settings');
 if(fail)throw Error('offline');
 if(!receipts.has(args.p_id)){
  if(conflict || wallet.rev!==args.p_revision)return ack(false);
  receipts.add(args.p_id);wallet.rev++;
  const settings=wallet.sortieSettings ||= {};
  if(args.p_kind==='repeat')(settings.repeatTarget ||= {})[args.p_chapter]=args.p_value;
  else settings[args.p_kind]=args.p_value;
 }
 if(lose){lose=false;throw Error('response lost after commit');}
 return ack();
}};
function account(id){Object.assign(A.A,{user:{id},mode:'account',sb,hydrated:true,tables:'ok',sync:'saved',banned:false,conflict:null});for(const f of A.A.listeners)f();}
test('online values are server-only; chapter overrides, clear, party separation and conflict refresh',async()=>{
 A.playGuest();P.writeSortieParty('dungeon',['mage']);P.writeSortieParty('spire',['mage']);T.writeTarget('1-1','mage');
 account('sortie-fixture');localStorage.setItem('hd3d_live_repeat_target_v1_sortie-fixture_1','fighter');await H.refresh();
 assert.equal(P.readSortieParty('dungeon'),null);assert.equal(P.readSortieParty('spire'),null);assert.equal(T.readTarget('1-1'),null);assert.equal(B.readPartner('mage'),'archer');
 assert.equal(await T.writeTarget('1-1','armor'),true);assert.equal(T.readTarget('hard-1-1'),'armor');assert.equal(T.readTarget('2-1'),null);
 assert.equal(await T.writeTarget('1-2',''),true);assert.equal(wallet.sortieSettings.repeatTarget['1'],null);assert.equal(T.readTarget('1-1'),null);
 assert.equal(await P.writeSortieParty('dungeon',['archer','mage']),true);assert.deepEqual(P.readSortieParty('dungeon'),['archer','mage']);
 assert.equal(P.readSortieParty('spire'),null);assert.deepEqual(P.rankParty('spire'),P.rankParty('dungeon'));
 assert.equal(await P.writeSortieParty('spire',['warrior']),true);assert.deepEqual(P.readSortieParty('spire'),['warrior']);
 conflict=true;assert.equal(await T.writeTarget('1-1','acc'),false);conflict=false;assert.equal(H.pendingSortieSettings(),false);assert.equal(T.readTarget('1-1'),null);
 assert.deepEqual(P.readPracticeParty('dungeon'),['mage']);assert.equal(localStorage.getItem('hd3d_live_repeat_target_v1_sortie-fixture_1'),'fighter');
});
test('same ID recovers a lost preference receipt; unresolved selection blocks new runs',async()=>{
 account('sortie-fixture');await H.refresh();lose=true;
 assert.equal(await T.writeTarget('1-1','acc'),false);assert.equal(H.pendingSortieSettings(),true);
 fail=true;const before=calls.filter(([name])=>name.endsWith('_start')).length;assert.equal(await H.startRun('1-1','mage'),null);
 assert.equal(calls.filter(([name])=>name.endsWith('_start')).length,before);
 fail=false;const run=await H.startRun('1-1','mage');assert.equal(run.target,'acc');
 const attempts=calls.filter(([n,a])=>n.endsWith('_sortie_settings')&&a.p_value==='acc'&&a.p_kind==='repeat').slice(-3);
 assert.equal(attempts.length,3);assert.deepEqual(attempts.map(([,a])=>a.p_id),Array(3).fill(attempts[0][1].p_id));assert.equal(H.pendingSortieSettings(),false);
 assert.equal(await T.writeTarget('1-1','armor'),true);assert.equal(run.target,'acc');
});
test('ranked Dungeon freezes the confirmed party and direct Spire resumes the original party',async()=>{
 account('sortie-fixture');await H.refresh();sb.atomicGear=true;
 const D=await import('../src/account/dungeon.js'),S=await import('../src/account/spire.js');
 const d=P.rankParty('dungeon');
 assert.equal((await D.dgStart()).mode,'ranked');
 assert.equal(await P.writeSortieParty('dungeon',['mage']),true);
 assert.deepEqual(D.takeEntry().party,d);
 const sp=P.rankParty('spire');loseEntry=true;
 assert.equal((await S.spStart(1)).blocked,true);
 assert.equal(await P.writeSortieParty('spire',['mage']),true);
 assert.equal((await S.spStart(1)).mode,'ranked');
 assert.deepEqual(S.takeEntry(1).party,sp);
 const attempts=calls.filter(([name])=>name==='hd3d_spire_start');
 assert.equal(attempts.length,2);assert.deepEqual(attempts[0][1],attempts[1][1]);
 sb.atomicGear=false;
});
