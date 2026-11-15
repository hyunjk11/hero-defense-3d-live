import test from 'node:test';
import assert from 'node:assert/strict';
import { HARD_STAGES, hardReward } from '../src/data/hard.js';
import { COLLECTION_ODDS, collectionOdds, HARD_REWARD_VERSION, collectionCount, optionalCollectionGrade } from '../src/data/hard-collection.js';
import { seeded } from '../src/account/rewarditems.js';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';

test('all 30 hard stages append exactly two on repeat completion, preserving every existing draw',()=>{
 for(const s of Object.values(HARD_STAGES))for(const hero of ['archer','mage','warrior','gunner','fighter'])for(const target of [null,'gunner','armor']){
  const before=hardReward(s,s.waves,true,false,hero,seeded(s.id+hero),target);
  const after=hardReward(s,s.waves,true,false,hero,seeded(s.id+hero),target,2);
  assert.equal(after.souls,before.souls);assert.deepEqual(after.items.slice(0,-2),before.items);
  assert.equal(after.items.length,Math.floor(s.waves/5)+2);
  assert.ok(after.items.slice(-2).every(x=>x.c===s.ch&&x.g<=2&&(x.s!=='weapon'||x.h===hero)));
  if(target==='gunner')assert.equal(after.items[0].h,'gunner');
 }
});

test('every stage/wave boundary: partial, loss, first clear, legacy and future stages never receive extra boxes',()=>{
 for(const s of Object.values(HARD_STAGES))for(let n=0;n<=s.waves+1;n++)for(const win of [true,false])for(const first of [true,false]){
  const a=hardReward(s,n,win,first,'mage',()=>.25,null,1),b=hardReward(s,n,win,first,'mage',()=>.25,null,2);
  const extra=win&&!first&&n===s.waves?2:0;
  assert.deepEqual(b.items?.slice(0,a.items?.length||0)||[],a.items||[]);
  assert.equal((b.items?.length||0)-(a.items?.length||0),extra);
  if(win&&first)assert.equal(b.items.at(-1).g,3);
 }
 assert.equal(collectionCount({hard:true,ch:6,waves:10},10,true,false,2),0);
 assert.equal(collectionCount({hard:false,ch:5,waves:10},10,true,false,2),0);
 for(const v of [undefined,1,3,'2',null])assert.equal(collectionCount(HARD_STAGES['hard-5-1'],HARD_STAGES['hard-5-1'].waves,true,false,v),0);
});

test('additional grade table keeps H1/2 and excludes white from H3+',()=>{
 assert.deepEqual(COLLECTION_ODDS,[50,35,15,0,0]);assert.equal(HARD_REWARD_VERSION,2);
 for(const s of Object.values(HARD_STAGES)){
  const counts=[0,0,0,0,0],base=Math.floor(s.waves/5);
  for(let q=0;q<1000;q++){
   let draw=0;const grade=(q+.5)/1000;
   const rw=hardReward(s,s.waves,true,false,'mage',()=>draw++%2===0?.1:grade,'gunner',2);
   for(const it of rw.items.slice(base)){counts[it.g]++;assert.equal(it.h,'mage');}
  }
  assert.deepEqual(counts,s.ch>=3?[0,1400,600,0,0]:[1000,700,300,0,0]);
 }
 for(const [x,g] of [[0,0],[.499999,0],[.5,1],[.849999,1],[.85,2],[.999999,2]])assert.equal(E.rollGrade(COLLECTION_ODDS,()=>x),g);
});

test('chest capacities 195..200 preserve older boxes and existing rewards before extras; only opened gear registers',()=>{
 const s=HARD_STAGES['hard-5-1'];
 for(const count of [195,196,197,198,199,200]){
  let save=P.empty();for(let i=0;i<count;i++){const it=E.makeItem('armor','mage',3,seeded(i),1);it.id='old-'+i;E.addChests(save,[{it,src:'chest'}]);}
  const old=structuredClone(save.chests),rw=hardReward(s,s.waves,true,false,'mage',()=>.1,'gunner',2);
  const [next,applied,loot]=P.applyMail(save,500,rw);assert.equal(applied,true);assert.deepEqual(next.chests.slice(0,count),old);
  assert.equal(next.chests.length,Math.min(200,count+rw.items.length));assert.equal(P.codexBits(next,5,'mage')&1,0);
  const auto=loot.filter(x=>x.auto),expected=auto.reduce((m,x)=>({steel:m.steel+x.y.steel,crystal:m.crystal+x.y.crystal}),{steel:0,crystal:0});
  assert.equal(next.mat.steel-save.mat.steel,expected.steel);assert.equal(next.mat.crystal-save.mat.crystal,expected.crystal);
  const extraStored=loot.slice(-2).filter(x=>x.chest),ids=extraStored.map(x=>x.chest);
  if(ids.length)E.openChests(next,Infinity,ids);
  assert.equal(!!(P.codexBits(next,5,'mage')&1),false);
  const once=structuredClone(next);assert.equal(P.applyMail(next,500,rw)[1],false);assert.deepEqual(P.applyMail(next,500,rw)[0],P.clean(once));
  assert.deepEqual(P.clean(JSON.parse(JSON.stringify(next))).chests,next.chests);
 }
});

test('optional white collection never expands or revokes existing codex completion/claim conditions',()=>{
 for(const ch of [3,4,5]){
  let s=P.empty();s.codex[ch]=Object.fromEntries(P.codexRows().map(row=>[row,30]));
  const before=P.codexState(s,ch);assert.equal(before.total,28);assert.equal(before.all.done,true);
  [s]=P.claimCodex(s,ch+':all');const claimed=structuredClone(s.codexRw),souls=s.souls;
  const it=E.makeItem('weapon','mage',0,()=>.1,ch);E.codexAdd(s,it);
  const after=P.codexState(s,ch);assert.equal(after.total,28);assert.equal(after.seen,28);assert.equal(after.all.done,true);assert.equal(after.all.got,true);assert.equal(after.rows.find(x=>x.row==='mage').extra,1);
  const [next,rw]=P.claimCodex(s,ch+':all');assert.equal(rw,null);assert.equal(next.souls,souls);assert.deepEqual(next.codexRw,claimed);
  assert.equal(P.codexBits(P.clean(JSON.parse(JSON.stringify(next))),ch,'mage'),31);
  assert.equal(optionalCollectionGrade(ch,0),true);
 }
 assert.equal(optionalCollectionGrade(6,0),false);assert.equal(optionalCollectionGrade(2,0),false);assert.equal(optionalCollectionGrade(5,1),false);
});

test('full inventory blocks opening without losing optional boxes or falsely registering codex',()=>{
 let s=P.empty();for(let i=0;i<E.CAP;i++){const it=E.makeItem('armor','mage',3,seeded(i),1);it.id='inv-'+i;s.inv.push(it);}
 [s]=P.applyMail(s,701,{items:[{k:'gear',s:'weapon',h:'mage',g:0,c:5}]});const box=structuredClone(s.chests),souls=s.souls;
 const [,r]=E.openChests(s);assert.equal(r.opened.length,0);assert.equal(r.blocked,1);assert.deepEqual(s.chests,box);assert.equal(s.souls,souls);assert.equal(P.codexBits(s,5,'mage')&1,0);
});

test('new chapter 3+ reward batches never produce white at every grade interval',()=>{for(const stage of Object.values(HARD_STAGES).filter(s=>s.ch>=3))for(let n=0;n<1000;n++){const rw=hardReward(stage,stage.waves,true,false,'mage',()=>n/1000,null,2);assert.ok(rw.items.every(x=>x.g>0));}for(const ch of [3,4,5,6,7,8,9,10])assert.deepEqual(collectionOdds(ch),[0,70,30,0,0]);});
