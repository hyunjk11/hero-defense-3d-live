import assert from 'node:assert/strict';
import {abyssalIcon} from '../src/ui/abyssal-icons.js';
import * as E from '../src/account/equip.js';
import {packItem,unpackItem} from '../src/account/storpack.js';
globalThis.location={search:''};const {icon,card,tile}=await import('../src/ui/itemview.js');
const seen=new Set();
for(const key of ['warrior','archer','mage','gunner','fighter','armor','acc']){
 const slot=['armor','acc'].includes(key)?key:'weapon';const item=E.makeItem(slot,slot==='weapon'?key:'mage',4,()=>.5,'abyssal');const before=JSON.stringify(item),art=icon(item);assert.match(art,/abyssalItemIcon/);assert.ok(!seen.has(art));seen.add(art);assert.equal(icon(unpackItem(packItem(item))),art);assert.match(card(item),/abyssalItemIcon/);assert.match(tile(item,{eq:{}}),/abyssalItemIcon/);assert.equal(JSON.stringify(item),before);assert.equal(icon({...item,n:'old saved name'}),art);
}
assert.equal(abyssalIcon({set:'morvia',s:'armor'}),null);assert.equal(abyssalIcon({set:'abyssal',s:'weapon',h:'__proto__'}),null);console.log('7 distinct abyssal icons, saved items, inventory/card and immutable presentation passed');
