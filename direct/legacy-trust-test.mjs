// Read-only baseline comparison: original v34 code, isolated MemoryStore only.
// These are limitations of the original contract, not successful new Rules writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {MemoryStore} from '../../upgrade-center-package-check/server/memory-store.mjs';
import {execute} from '../../upgrade-center-package-check/server/operations.mjs';
import {empty} from '../../upgrade-center-package-check/src/account/progress.js';
import * as E from '../../upgrade-center-package-check/src/account/equip.js';
const rows=[],now=Date.parse('2026-11-04T00:00:00Z'),iso=new Date(now).toISOString();
const user={id:'original-trust-fixture',email:'original-trust@example.invalid'};
function fixture(){const save=empty();save.souls=100000;save.mat={steel:10000,crystal:10000};
 const item=E.makeItem('armor',null,4,()=>.4,1);item.id='existing';item.e=5;save.inv=[item];
 const store=new MemoryStore({hd3d_users:[{...user,created_at:iso}],hd3d_profiles:[{id:user.id,nickname:'test',created_at:iso}],
  hd3d_progress:[{user_id:user.id,data:save,merged:true,created_at:iso,updated_at:iso}]});
 return {save,store,async write(data){const old=store.tables.hd3d_progress[0];
  const result=await store.transaction(tx=>execute(tx,user,{kind:'query',table:'hd3d_progress',action:'update',
   filters:{user_id:user.id,updated_at:old.updated_at},values:{data,merged:true},returning:true},{now}));
  assert.equal(result.data.length,1);return result.data[0].data;
 }};
}
{
 const f=fixture(),cost=E.enhCost(f.save.inv[0]),[save,result]=E.enhance(structuredClone(f.save),'existing',()=>0);
 assert.equal(result,'ok');const persisted=await f.write(save);assert.equal(persisted.inv[0].e,6);assert.equal(persisted.souls,f.save.souls-cost.souls);
 rows.push({path:'v34 client enhancement -> original Worker save',outcome:'forced success accepted',from:5,to:6,normalChance:E.ENH_RATE[5],cost});
}
{
 const f=fixture(),[save,result,item]=E.craft(structuredClone(f.save),'master','weapon','mage',()=>.999999);
 assert.equal(result,'ok');assert.equal(item.g,4);const persisted=await f.write(save);assert.equal(persisted.inv.at(-1).g,4);
 rows.push({path:'v34 client crafting -> original Worker save',outcome:'chosen high grade accepted',recipe:'master',grade:4,cost:E.craftCost(E.RECIPES.find(x=>x.k==='master'))});
}
{
 const f=fixture(),[save,result,sub]=E.reroll(structuredClone(f.save),'existing',()=>.999999);assert.equal(result,'ok');
 const paid=await f.write(save),[applied,ok]=E.applySubs(structuredClone(paid),'existing',sub);assert.equal(ok,true);
 const persisted=await f.write(applied);assert.deepEqual(persisted.inv[0].sub,sub);assert.equal(persisted.mat.steel,f.save.mat.steel-E.REROLL_COST[4]);
 rows.push({path:'v34 client reroll -> original Worker save',outcome:'chosen valid high substats accepted',grade:4,steel:E.REROLL_COST[4],sub});
}
{
 const f=fixture(),save=structuredClone(f.save);save.souls+=333333;save.stats.kills+=1000000;save.stats.runs++;
 const persisted=await f.write(save);assert.equal(persisted.souls,f.save.souls+333333);assert.equal(persisted.stats.kills,1000000);
 rows.push({path:'v34 original Worker save, no run or combat',outcome:'333333 soul increment and million kill statistic accepted',scope:'ordinary save contract only; no claim about hard/dungeon server settlement'});
}
await fs.writeFile(new URL('../../direct-firestore-evidence-22/legacy-trust-results.json',import.meta.url),JSON.stringify({scope:'Original v34 MemoryStore; no production or candidate Rules writes',passed:rows.length,rows},null,2));
console.log(JSON.stringify({passed:rows.length,scope:'original v34 in-memory baseline'}));
