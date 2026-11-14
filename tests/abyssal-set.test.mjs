import assert from 'node:assert/strict';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import * as RI from '../src/account/rewarditems.js';
import {ABYSSAL,abyssalSpec,abyssalRoll,MORVIA} from '../src/data/boss-sets.js';
import {setStatuses,setsForItems} from '../src/account/set-status.js';
import {abyssalStrike} from '../src/data/abyssal-set.js';

import {packItem,unpackItem} from '../src/account/storpack.js';
globalThis.location={search:''};const {card}=await import('../src/ui/itemview.js');const {setCard}=await import('../src/ui/setview.js');
const save=P.empty();
for(const s of ['weapon','armor','acc']){const spec=abyssalSpec(s,'mage');assert.ok(RI.validItem(spec));const it=E.makeItem(s,'mage',4,RI.seeded(s),'abyssal');save.inv.push(it);E.equip(save,'mage',it.id);assert.equal(it.set,'abyssal');assert.ok(it.n);assert.deepEqual(E.cleanItem(unpackItem(packItem(it)),P.HEROES),E.cleanItem(it,P.HEROES));assert.match(card(it),/별의 공명/);}
assert.equal(ABYSSAL.grade,4);assert.equal(MORVIA.grade,3);
assert.equal(abyssalRoll('mage',()=>0).s,'weapon');assert.equal(abyssalRoll('mage',()=>.5).s,'armor');assert.equal(abyssalRoll('mage',()=>.999).s,'acc');
assert.ok(!RI.validItem({...abyssalSpec('armor'),g:3}));assert.ok(!RI.validItem({...abyssalSpec('weapon','mage'),h:'mechanic'}));
const state=setStatuses(save,'mage').find(s=>s.key==='abyssal');assert.equal(state.count,3);assert.ok(state.tiers.every(t=>t.active));assert.match(setCard(state),/별의 공명/);
const hero={equippedSets:setsForItems(save.inv,'mage'),dead:0};
const e=(x,dead=0)=>({dead,E:{fly:false},g:{position:{x,z:0}}});const enemies=[e(0),e(1),e(2),e(2.3),e(8),e(0,1)];
for(let i=0;i<4;i++)assert.deepEqual(abyssalStrike(hero,enemies[0],enemies,0),[]);
assert.deepEqual(abyssalStrike(hero,enemies[0],enemies,0),enemies.slice(0,3));
for(let i=0;i<9;i++)assert.equal(abyssalStrike(hero,enemies[0],enemies,1).length,0);
assert.equal(abyssalStrike(hero,enemies[0],enemies,3).length,3);
assert.equal(abyssalStrike(hero,{...enemies[0]},enemies,6).length,0,'unregistered targets excluded');
hero.dead=1;assert.equal(abyssalStrike(hero,enemies[0],enemies,6).length,0);assert.equal(hero.abyssalState,null);
E.unequip(save,'mage','armor');hero.dead=0;hero.equippedSets=setsForItems(E.equippedItems(save,'mage'),'mage');assert.equal(abyssalStrike(hero,enemies[0],enemies,6).length,0);
const r={items:[abyssalSpec('armor')]};const mailed=P.applyMail(P.empty(),901,r)[0];assert.equal(mailed.chests[0].it.set,'abyssal');assert.deepEqual(P.applyMail(mailed,901,r)[0],P.clean(mailed));E.openChests(mailed,1);assert.equal(mailed.inv[0].set,'abyssal');
console.log('abyssal set: 3 slots, validation, storage, mail replay, active UI, bounded 5-hit proc and cooldown passed');

const {fixture}=await import('./support/advance-e-runtime.mjs');
for(const cls of ['warrior','mage','archer','gunner','fighter']){
 const f=fixture(cls,null);f.hero.equippedSets=[{key:'abyssal',tiers:[{pieces:3,active:true}]}];const t=f.target(0,2);f.target(1,2);f.target(1.5,2);f.target(1.8,2);
 for(let i=0;i<5;i++)f.api.legendProc(t,{mode:'melee'});
 assert.equal(f.hits.length,3,cls+' maximum 3 targets');assert.equal(f.G.legendN.abyssalResonance,1);assert.ok(f.hits.every(h=>h.loss===100));
 f.api.legendProc(t,{mode:'melee'});assert.equal(f.hits.length,3);assert.equal(f.FX.length,0,'no persistent FX timers');
}
console.log('abyssal live combat module: five hero classes apply exact additional damage without proc recursion');
