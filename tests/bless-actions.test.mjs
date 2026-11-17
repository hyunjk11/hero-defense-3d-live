import assert from 'node:assert/strict';
import { jointBlessing,rescueBlessing } from '../src/data/bless-actions.js';
import { BLESS_BY,blessChoices } from '../src/data/dungeon.js';
import { heroEffects } from '../src/ui/hero-effects.js';
import { autoBlessChoice } from '../src/dungeon/auto.js';
const hero=(hp=20,x=0)=>({hp,max:100,dead:0,cls:'mage',g:{position:{x,z:0}}});
let h=[hero(),hero(95,3),hero(20,5),{...hero(),dead:2}],s={};
assert.equal(jointBlessing({},h,0,s),false);
assert.equal(jointBlessing({rally:1},h,0,s),true);assert.equal(h[0].blessHasteUntil,6);assert.equal(h[3].blessHasteUntil,undefined);
assert.equal(jointBlessing({rally:99},h,1,s),false);assert.equal(h[0].blessHasteUntil,6);
assert.equal(jointBlessing({rally:1},h,12,s),true);assert.equal(h[0].blessHasteUntil,18);
assert.equal(rescueBlessing({},h,0,s).length,0);
assert.equal(rescueBlessing({rescue:1},h,0,s).length,2);assert.equal(h[0].hp,28);assert.equal(h[1].hp,100);assert.equal(h[2].hp,20);assert.equal(h[3].hp,20);
assert.equal(rescueBlessing({rescue:1},h,11,s).length,0);
assert.equal(rescueBlessing({rescue:99},h,12,s,.5).length,1);assert.equal(h[0].hp,32);
assert.equal(rescueBlessing({rescue:1},[hero(100)],99,{}).length,0);
const many=Array.from({length:10},()=>hero());assert.equal(rescueBlessing({rescue:1},many,0,{}).length,4);
assert.equal(many[4].hp,20);
assert.equal(BLESS_BY.rally.max,1);assert.equal(BLESS_BY.rescue.max,1);
assert.ok(['rally','rescue'].includes(autoBlessChoice(['rally','rescue'],{},[hero()])));
for(let i=0;i<20;i++){const ch=blessChoices({rally:1,rescue:1},['caster']);assert.ok(!ch.includes('rally'));assert.ok(!ch.includes('rescue'));}
console.log('PASS dungeon actions: shared cooldown, expiry, death, radius, cap, no chains, auto choice');

const active=heroEffects(h[0],{now:13,dungeon:true,dungeonMods:{}}).find(x=>x.id==='bless-rally');
assert.equal(active.time,5);
assert.ok(!heroEffects(h[0],{now:18,dungeon:true,dungeonMods:{}}).some(x=>x.id==='bless-rally'));
assert.ok(!heroEffects(h[0],{now:13}).some(x=>x.id==='bless-rally'));
