import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../src/account/equip.js';
import { SET_KEYS, setDefinition, setStatuses, setsForItems } from '../src/account/set-status.js';
import { sortieC, finalStats } from '../src/data/herostats.js';
globalThis.location = { search: '' };
const { setCard, equippedSetsHtml } = await import('../src/ui/setview.js');

let checks = 0;
const seed = () => { let x=42; return () => ((x=x*16807%2147483647)/2147483647); };
for (const key of SET_KEYS) for (let count=0; count<=3; count++) {
  const inv=E.SLOT_KEYS.map((slot,i)=>({...E.makeItem(slot,'mage',key==='morvia'?3:i+1,seed(),key),id:`slot-${i}`}));
  const s={inv,stor:[],eq:{mage:Object.fromEntries(inv.slice(0,count).map(it=>[it.s,it.id]))},codex:{}};
  const before=JSON.stringify(s), state=setStatuses(s,'mage').find(x=>x.key===key);
  assert.equal(state.count,count);
  assert.deepEqual(state.tiers.filter(t=>t.active).map(t=>t.stats),E.setBonuses(s,'mage').map(t=>t.stats));
  const base={...s,inv:inv.map(it=>({...it,c:undefined,set:undefined}))};
  const actual=E.bonus(s,'mage'), ordinary=E.bonus(base,'mage'), delta={};
  for(const t of state.tiers.filter(t=>t.active))for(const[k,v]of Object.entries(t.stats))delta[k]=(delta[k]||0)+v;
  for(const k of new Set([...Object.keys(actual),...Object.keys(ordinary)]))assert.ok(Math.abs((actual[k]||0)-(ordinary[k]||0)-(delta[k]||0))<1e-8);
  const L={perm:{hp:0,atk:0},eq:actual};
  const F=finalStats(sortieC('mage',L),actual,{cls:'mage'});
  if(delta.hp)assert.ok(F.hp>finalStats(sortieC('mage',{...L,eq:ordinary}),ordinary,{cls:'mage'}).hp);
  if(delta.skill)assert.ok(F.skillMul>finalStats(sortieC('mage',{...L,eq:ordinary}),ordinary,{cls:'mage'}).skillMul);
  const html=setCard(state,'시험 영웅');
  assert.equal((html.match(/setTier active/g)||[]).length,state.tiers.filter(t=>t.active).length);
  assert.ok(html.includes(`${count}/3부위 장착`));
  if(!setDefinition(key).bonuses)assert.ok(html.includes('별도 착용 세트 효과 없음'));
  assert.equal(JSON.stringify(s),before,'display cannot mutate collection or gear');
  assert.equal(setStatuses(s,'archer').find(x=>x.key===key).count,0);
  const snapshot=setsForItems(E.equippedItems(s,'mage'),'mage');
  const original=JSON.stringify(snapshot);s.eq.mage={};s.inv.length=0;
  assert.equal(JSON.stringify(snapshot),original,'battle snapshot detached from later equipment changes');
  checks++;
}
{
  const items=E.SLOT_KEYS.map((slot,i)=>({...E.makeItem(slot,'mage',i,seed(),5),id:`mixed-${i}`}));
  const s={inv:items,stor:[],eq:{mage:Object.fromEntries(items.map(x=>[x.s,x.id]))}};
  assert.equal(setStatuses(s,'mage').find(x=>x.key===5).tiers.filter(t=>t.active).length,2,'mixed grades activate');
  s.stor.push(s.inv.pop());assert.equal(setStatuses(s,'mage').find(x=>x.key===5).count,2,'warehouse is not equipped');
  s.inv[0].h='archer';assert.equal(setStatuses(s,'mage').find(x=>x.key===5).count,1,'wrong hero weapon is excluded');
  s.inv[1].uq='retired';assert.equal(setStatuses(s,'mage').find(x=>x.key===5).count,0,'retired uniques are not sets');
  checks+=4;
}
assert.match(equippedSetsHtml([]),/장착한 세트 장비 없음/);
const hostile={...setStatuses({inv:[],eq:{}},'mage')[0],name:'<script>',slots:[{slot:'weapon',item:'" onmouseover="x'}]};
assert.ok(!setCard(hostile,'<img>').includes('<script>'));checks++;
// The battle view must use the spawn snapshot, not a later account read.
assert.match(readFileSync(new URL('../src/ui/stats.js',import.meta.url),'utf8'),/equippedSetsHtml\(h\.equippedSets \|\| \[\]\)/);
console.log(`set-status: ${checks} state/application/ownership checks passed`);
