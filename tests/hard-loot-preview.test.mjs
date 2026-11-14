import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])+path.sep):new URL('../',import.meta.url);
const mod=p=>import(new URL(p,root)),P=await mod('src/account/progress.js'),E=await mod('src/account/equip.js');
const {HARD_STAGES,hardReward}=await mod('src/data/hard.js');
const sequence=(...values)=>()=>values.shift()??.5;
test('all 24 hard previews show the same chapter set and grade pool as normal',()=>{
 for(const s of Object.values(HARD_STAGES)){const normal=P.dropPreview(s.normalId,'fighter'),hard=P.dropPreview(s.id,'fighter');assert.ok(hard,s.id);assert.equal(hard.set,normal.set);assert.equal(hard.ch,s.ch);assert.deepEqual(hard.odds.map((n,i)=>n>0?i:null).filter(n=>n!==null),E.obtainableGrades(s.ch));assert.ok(hard.odds[4]>normal.odds[4]);assert.ok(hard.odds[3]+hard.odds[4]>normal.odds[3]+normal.odds[4]);}
});
test('wave boxes use the displayed distribution; the first-clear bonus keeps its epic guarantee',()=>{
 for(const s of Object.values(HARD_STAGES))for(let slot=0;slot<3;slot++){
  const preview=P.dropPreview(s.id,'fighter');assert.ok(preview);let lower=0;
  for(let g=0;g<5;g++){const prob=preview.odds[g];if(!prob)continue;const values=[(slot+.5)/3,lower+prob/2];let i=0;const rw=hardReward(s,s.waves,true,true,'fighter',()=>values[i++%2]);
   assert.equal(rw.items.length,Math.floor(s.waves/5)+1);for(const [j,it] of rw.items.entries()){assert.equal(it.c,s.ch);assert.equal(it.s,E.SLOT_KEYS[slot]);assert.equal(it.g,j===rw.items.length-1?3:g);assert.equal(it.h,slot===0?'fighter':undefined);}lower+=prob;
  }
 }
});

test('first-clear bonus is epic at both RNG extremes and never granted on loss or repeat',()=>{
 for(const s of Object.values(HARD_STAGES))for(const r of [0,.999999]){
  const first=hardReward(s,s.waves,true,true,'fighter',()=>r),repeat=hardReward(s,s.waves,true,false,'fighter',()=>r),loss=hardReward(s,s.waves,false,true,'fighter',()=>r);
  assert.equal(first.items.length,repeat.items.length+1);assert.equal(first.items.at(-1).g,3);
  assert.equal(first.items.at(-1).c,s.ch);assert.deepEqual(first.items.slice(0,-1),repeat.items);
  assert.deepEqual(loss.items,repeat.items);assert.equal(first.souls-repeat.souls,240);
 }
});
test('new normal-set rewards open, register codex and survive cleaning; existing chapter10 gear unchanged',()=>{
 let save=P.empty();const old=E.makeItem('weapon','fighter',4,()=>.4,10);old.id='old-hard-weapon';old.e=7;save.inv.push(old);save.eq.fighter.weapon=old.id;
 const oldClean=structuredClone(P.clean(save).inv[0]);
 const s=HARD_STAGES['hard-2-1'],rw=hardReward(s,5,false,false,'fighter',sequence(.5,.999));
 [save]=P.applyMail(save,601,rw);const item=save.chests[0].it;assert.equal(item.s,'armor');assert.equal(item.c,2);assert.equal(item.g,4);assert.ok(item.n);E.openChests(save);assert.equal(P.codexBits(save,2,'armor')&16,16);
 const round=P.clean(JSON.parse(JSON.stringify(save)));assert.deepEqual(round.inv.find(x=>x.id===old.id),oldClean);assert.equal(round.eq.fighter.weapon,old.id);assert.ok(round.inv.some(x=>x.id===item.id));
 const [retry,applied]=P.applyMail(round,601,rw);assert.equal(applied,false);assert.equal(retry.inv.length,round.inv.length);assert.equal(retry.chests.length,0);
});

test('old hard unopened boxes and warehouse items retain their rolled identities',()=>{
 const save=P.empty();
 const oldBox=E.makeItem('weapon','fighter',3,()=>.3,10);oldBox.id='old-hard-box';
 const oldStored=E.makeItem('weapon','mage',4,()=>.7,10);oldStored.id='old-hard-stored';oldStored.e=5;
 save.stor.push(oldStored);E.addChests(save,[{it:oldBox,src:'chest'}]);
 const before=P.clean(save),round=P.clean(JSON.parse(JSON.stringify(before)));
 assert.deepEqual(round.chests,before.chests);assert.deepEqual(round.stor,before.stor);
 E.openChests(round);
 assert.deepEqual(round.inv.find(it=>it.id===oldBox.id),before.chests[0].it);
 assert.deepEqual(round.stor,before.stor);assert.equal(round.chests.length,0);
 assert.equal(P.codexBits(round,10,'fighter')&8,8);
});
