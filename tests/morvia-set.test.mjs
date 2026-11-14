import assert from 'node:assert/strict';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import * as RI from '../src/account/rewarditems.js';
import { packItem, unpackItem } from '../src/account/storpack.js';
import { MORVIA, MORVIA_SHOP, MORVIA_HEROES, morviaRoll, morviaSpec, canDropMorvia } from '../src/data/boss-sets.js';
import { morviaIcon } from '../src/ui/morvia-icons.js';
globalThis.location = { search: '' };
const { card } = await import('../src/ui/itemview.js');
const mk=(s,h='mage')=>E.makeItem(s,h,3,RI.seeded(s+h),MORVIA.key);
assert.equal(morviaRoll('mage',()=>.3),null); assert.equal(morviaRoll('mage',()=>.999),null);
for(const [i,s] of ['weapon','armor','acc'].entries()){let n=0;assert.deepEqual(morviaRoll('mage',()=>n++ ? (i+.1)/3 : .2999),morviaSpec(s,'mage'));}
const eligibility={dungeon:true,spire:null,floor:4,type:'dg_lich',entry:{mode:'ranked'},over:false};
assert.ok(canDropMorvia(eligibility)); assert.ok(canDropMorvia({...eligibility,entry:{mode:'local'}}));
assert.ok(!canDropMorvia({...eligibility,entry:{mode:'practice',why:'guest'}}));
for(const change of [{floor:3},{type:'boss'},{spire:{}},{dungeon:false},{over:true},{entry:{mode:'practice',why:'reload'}},{entry:{mode:'practice',why:'error'}}])assert.ok(!canDropMorvia({...eligibility,...change}));
assert.equal(MORVIA_SHOP.length,7);
for(const row of MORVIA_SHOP){const spec=row.reward.items[0];assert.ok(RI.validItem(spec));const item=mk(spec.s,spec.h);assert.equal(item.n,row.n);assert.equal(item.set,'morvia');assert.ok(!item.c&&!item.uq&&!item.u);assert.equal(item.sub.length,2);assert.ok(morviaIcon(item));assert.match(card(item),/던전 5층/);assert.deepEqual(E.cleanItem(unpackItem(packItem(item)),P.HEROES),E.cleanItem(item,P.HEROES));}
assert.ok(!RI.validItem({...morviaSpec('weapon','mage'),h:'mechanic'}));
for(const change of [{set:'bad'},{g:4},{c:5},{s:'armor',h:'mage'}])assert.ok(!RI.validItem({...morviaSpec('weapon','mage'),...change}));
const old=E.makeItem('armor',undefined,3,RI.seeded('old'),6);assert.equal(JSON.parse(packItem(old)).length,11);
assert.deepEqual(E.cleanItem(unpackItem(packItem(old)),P.HEROES),E.cleanItem(old,P.HEROES));
let save=P.empty();save.inv=['weapon','armor','acc'].map(s=>mk(s));for(const it of save.inv)E.equip(save,'mage',it.id);
const base={};for(const it of save.inv)for(const[k,v]of Object.entries(E.itemStats(it)))base[k]=(base[k]||0)+v;
assert.equal(E.bonus(save,'mage').hp,base.hp+8);assert.equal(E.bonus(save,'mage').skill,base.skill+12);
E.unequip(save,'mage','weapon');assert.equal(E.setBonuses(save,'mage').length,1);
E.unequip(save,'mage','armor');assert.equal(E.setBonuses(save,'mage').length,0);
// Mail replay, clean/save reload, chest opening and full-bag retention.
const reward={items:[morviaSpec('weapon','mage')]};let applied;
[save,applied]=P.applyMail(P.empty(),1234,reward);assert.ok(applied);assert.equal(save.chests[0].it.set,'morvia');
assert.deepEqual(P.applyMail(save,1234,reward)[0],P.clean(save));
assert.deepEqual(P.applyMail(P.empty(),1234,reward)[0].chests,save.chests);
save=P.clean(JSON.parse(JSON.stringify(save))); const chest=save.chests[0];
E.openChests(save,1,[chest.id]);assert.equal(save.inv[0].set,'morvia');assert.equal(save.inv[0].n,'모르비아의 영혼홀');assert.equal(save.chests.length,0);
assert.ok(!Object.keys(save.codex).length,'boss set must not complete a chapter codex');
const full=P.empty();full.inv=Array.from({length:E.CAP},(_,i)=>({...old,id:'full'+i}));let filled=P.applyMail(full,1234,reward)[0];E.openChests(filled,Infinity,filled.chests.map(x=>x.id));assert.equal(filled.chests.length,1);assert.equal(filled.chests[0].it.set,'morvia');
assert.equal(RI.catalog().filter(x=>x.spec.set==='morvia').length,7);
for(const h of MORVIA_HEROES)assert.ok(E.canEquip(mk('weapon',h),h));
console.log('morvia: roll boundaries, eligibility, 7 items, mail replay, storage compatibility, set stats, chest/full bag passed');
