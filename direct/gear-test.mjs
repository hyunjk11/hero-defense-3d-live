import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,raw,commit,root} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT,encodeFields} from '../src/account/direct-store.js';
import {makeItem,chestOf,codexAdd} from '../src/account/equip.js';
import {packItem} from '../src/account/storpack.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {codexCatalog} from './catalog.mjs';
await rest(':commit',{writes:codexCatalog().map(update=>({update}))});
const resultsURL=new URL('../../direct-firestore-evidence-22/gear-results.json',import.meta.url);
let serial=0;
const call=(uid,action,item='',extra={},c=client(uid))=>c.rpc('gear_action',{p_id:'gear-test-'+(++serial),p_action:action,p_item:item,...extra});
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
async function fixture(uid,edit=()=>{}) {
  const {save}=await seed(uid);save.mat={steel:5000,crystal:1000};save.souls=5000;
  const it=makeItem('armor',undefined,4,()=>.4,3);it.id='ancientarmor';it.e=5;
  const reward=makeItem('weapon','gunner',0,()=>.4,5);reward.id='whitereward';
  save.inv=[it];codexAdd(save,it);save.chests=[chestOf(reward,'chest')];edit(save);
  const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});
  return save;
}
await test('existing pre-rolled chest opens with exact item, g0 codex and souls once',async()=>{
 const uid='gear-open';const before=await fixture(uid),c=client(uid),args={p_id:'open-repeat-1',p_action:'open',p_item:before.chests[0].id};
 const r=await c.rpc('gear_action',args);assert.equal(r.ok,true);assert.equal(r.opened.length,1);
 const after=await effective(uid);assert.deepEqual(after.inv,[...before.inv,before.chests[0].it]);assert.equal(after.chests.length,0);
 assert.equal(after.souls,before.souls+4);assert.equal(after.stats.souls,4);assert.equal(after.codex[5].gunner,1);
 assert.equal((await c.rpc('gear_action',args)).already,true);assert.deepEqual(await effective(uid),after);
 await assert.rejects(c.rpc('gear_action',{...args,p_item:'different'}));
});
await test('full bag and invalid action leave the unopened chest unchanged',async()=>{
 const uid='gear-full';const before=await fixture(uid,s=>{const it=s.inv[0];s.inv=Array.from({length:40},(_,i)=>({...it,id:'full'+i}));});
 assert.equal((await call(uid,'open',before.chests[0].id)).reason,'full');assert.deepEqual(await effective(uid),before);
 await assert.rejects(call(uid,'create','fake'));assert.deepEqual(await effective(uid),before);
});
await test('two devices open one chest at most once',async()=>{
 const uid='gear-race';const before=await fixture(uid);const rs=await Promise.all([call(uid,'open',before.chests[0].id),call(uid,'open',before.chests[0].id)]);
 assert.equal(rs.filter(r=>r.ok).length,1);const after=await effective(uid);assert.equal(after.souls,5004);assert.equal(after.inv.length,2);
});
await test('commit response loss retries the same receipt without duplicate reward',async()=>{
 const uid='gear-loss';await fixture(uid);let lost=false;const c=client(uid,{fetcher:async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok&&!lost){lost=true;await r.clone().json();throw Error('simulated response lost');}return r;}});
 const a={p_id:'lost-chest-1',p_action:'open',p_item:'cwhitereward'};
 await assert.rejects(c.rpc('gear_action',a),/lost/);assert.equal((await effective(uid)).souls,5004);
 const rs=await Promise.all([client(uid).rpc('gear_action',a),client(uid).rpc('gear_action',a)]);assert.ok(rs.every(r=>r.already));assert.equal((await effective(uid)).inv.length,2);
});
await test('storage moves preserve item stats and packed legacy storage reload',async()=>{
 const uid='gear-store';const before=await fixture(uid);assert.equal((await call(uid,'store','ancientarmor')).ok,true);
 const middle=await effective(uid);assert.deepEqual(middle.stor,[before.inv[0]]);assert.equal(middle.inv.length,0);
 assert.equal((await call(uid,'take','ancientarmor')).ok,true);assert.deepEqual(await effective(uid),before);
 const packed=await fixture('gear-packed',s=>{s.stor=[packItem(s.inv[0])];s.inv=[];});
 assert.deepEqual(await effective('gear-packed'),packed);assert.equal((await call('gear-packed','take','ancientarmor')).ok,true);
 assert.deepEqual((await effective('gear-packed')).inv,[before.inv[0]]);
});
await test('equipped shared armor transfers ownership and cannot be stored or dismantled',async()=>{
 const uid='gear-equipped';await fixture(uid);assert.equal((await call(uid,'equip','ancientarmor',{p_hero:'mage'})).ok,true);
 assert.equal((await call(uid,'store','ancientarmor')).reason,'equipped');assert.equal((await call(uid,'dismantle','ancientarmor')).ok,false);
 assert.equal((await call(uid,'equip','ancientarmor',{p_hero:'fighter'})).ok,true);const middle=await effective(uid);assert.equal(middle.eq.mage.armor,undefined);assert.equal(middle.eq.fighter.armor,'ancientarmor');
 await assert.rejects(call(uid,'equip','ancientarmor',{p_hero:'gunner'}));
 assert.equal((await call(uid,'unequip','',{p_hero:'fighter',p_slot:'armor'})).ok,true);
 assert.equal((await call(uid,'dismantle','ancientarmor')).ok,true);const after=await effective(uid);assert.equal(after.mat.steel,5030);assert.equal(after.mat.crystal,1009);
 assert.equal((await call(uid,'dismantle','ancientarmor')).ok,false);assert.equal(after.codex[3].armor,middle.codex[3].armor);
});
await test('existing unique gear keeps its identity through storage and equip, but cannot be dismantled',async()=>{
 const uid='gear-unique';const before=await fixture(uid,s=>{s.inv[0].uq='legacy-special';s.inv[0].e=0;});
 assert.equal((await call(uid,'store','ancientarmor')).ok,true);assert.equal((await call(uid,'take','ancientarmor')).ok,true);
 assert.deepEqual(await effective(uid),before);assert.equal((await call(uid,'equip','ancientarmor',{p_hero:'mage'})).ok,true);
 assert.equal((await call(uid,'unequip','',{p_hero:'mage',p_slot:'armor'})).ok,true);
 assert.equal((await call(uid,'dismantle','ancientarmor')).ok,false);assert.deepEqual((await effective(uid)).inv,before.inv);
});
await test('storage expansion uses original four prices and cap',async()=>{
 const uid='gear-expand';await fixture(uid);for(const [i,cost]of [120,200,320,480].entries()){
  const before=await effective(uid);assert.equal((await call(uid,'expand','',{p_pay:'steel'})).ok,true);
  const after=await effective(uid);assert.equal(after.storX,i+1);assert.equal(after.mat.steel,before.mat.steel-cost);
 }const before=await effective(uid);assert.equal((await call(uid,'expand','',{p_pay:'souls'})).reason,'max');assert.deepEqual(await effective(uid),before);
 const cash=await fixture('gear-expand-cash');assert.equal((await call('gear-expand-cash','expand','',{p_pay:'souls'})).ok,true);assert.equal((await effective('gear-expand-cash')).souls,cash.souls-500);
});
await test('original successful and failed enhancement spends exact costs through the +10 path',async()=>{
 const uid='gear-enhance';const before=await fixture(uid);const r=await call(uid,'enhance','ancientarmor');
 assert.equal(r.reason,'fail');assert.equal(r.ok,true);const failed=await effective(uid);assert.equal(failed.inv[0].e,5);assert.equal(failed.souls,before.souls-360);assert.equal(failed.mat.steel,before.mat.steel-12);assert.equal(failed.mat.crystal,before.mat.crystal-1);
 const zero=await fixture('gear-zero',s=>s.inv[0].e=0);assert.equal((await call('gear-zero','enhance','ancientarmor')).reason,'ok');
 const after=await effective('gear-zero');assert.equal(after.inv[0].e,1);assert.equal(after.souls,zero.souls-60);assert.equal(after.mat.steel,zero.mat.steel-2);
 assert.equal((await call('gear-zero','enhance','ancientarmor')).reason,'ok');const twice=await effective('gear-zero');assert.equal(twice.inv[0].e,2);assert.equal(twice.souls,after.souls-120);assert.equal(twice.mat.steel,after.mat.steel-4);
});
await test('raw omitted receipt, free item, codex forgery and altered item body are denied atomically',async()=>{
 const uid='gear-forge';await fixture(uid);const p=await get(uid,'progress');
 const proof={op:'gear_open',request:'forge-open',token:'cwhitereward',hero:'',level:0,stat:'',slot:'',pay:'',pos:0};
 const a=structuredClone(p.authority),ch=a.gear.chests[0];a.gear.chests=[];a.gear.inv.push(ch.it);a.gear.bagIds.push(ch.it.id);a.souls+=4;a.gear.stats.souls+=4;a.gear.codex[5]={gunner:1};
 const make=(auth,receipt=true)=>{const w=commit(uid,'progress',uid,{...p,updated_at:'2026-05-01',authority:auth},1);w[1].update.fields.row.mapValue.fields.proof={mapValue:{fields:encodeFields(proof)}};
  if(receipt)w.push({update:raw(uid,'growth_investments',uid+'~gear~forge-open',{id:uid+'~gear~forge-open',user_id:uid,at:'2026-05-01',body:'{}',result:{ok:true,id:'forge-open',action:'open'}},1)});return w;};
 await deniedWrite(uid,make(a,false));
 for(const mutate of [x=>x.souls++,x=>x.gear.codex[5].gunner=31,x=>x.gear.inv[1].body='{"id":"whitereward","m":["atk",999999]}',x=>x.gear.chests.push(ch),x=>x.gear.inv[1].e=10,x=>x.gear.stor.push(ch.it)]){const bad=structuredClone(a);mutate(bad);await deniedWrite(uid,make(bad));}
 assert.equal((await get(uid,'sequences','_revision')).value,0);assert.equal((await effective(uid)).chests.length,1);
});
await test('raw shared equipment duplication, slot injection and free expansion are rejected',async()=>{
 const uid='gear-slot-forge';await fixture(uid,s=>s.eq.mage.armor='ancientarmor');const p=await get(uid,'progress');
 const proof={op:'gear_equip',request:'forge-equip',token:'ancientarmor',hero:'fighter',level:0,stat:'',slot:'',pay:'',pos:0};
 const make=(auth,pr=proof)=>{const w=commit(uid,'progress',uid,{...p,updated_at:'2026-05-01',authority:auth},1);w[1].update.fields.row.mapValue.fields.proof={mapValue:{fields:encodeFields(pr)}};
  w.push({update:raw(uid,'growth_investments',uid+'~gear~'+pr.request,{id:uid+'~gear~'+pr.request,user_id:uid,at:'2026-05-01',body:'{}',result:{ok:true,id:pr.request,action:pr.op.slice(5)}},1)});return w;};
 const duplicate=structuredClone(p.authority);duplicate.gear.eq.fighter.armor='ancientarmor';await deniedWrite(uid,make(duplicate));
 const injected=structuredClone(duplicate);delete injected.gear.eq.mage.armor;injected.gear.eq.fighter.weapon='ancientarmor';await deniedWrite(uid,make(injected));
 const free=structuredClone(p.authority);free.gear.storX++;await deniedWrite(uid,make(free,{...proof,op:'gear_expand',token:'',hero:'',pay:'steel'}));
 assert.deepEqual(await get(uid,'progress'),p);
 assert.equal((await call(uid,'equip','ancientarmor',{p_hero:'fighter'})).ok,true);
 const actual=await effective(uid);assert.equal(actual.eq.mage.armor,undefined);assert.equal(actual.eq.fighter.armor,'ancientarmor');
});
await test('codex claims keep original completion mask and row/chapter rewards exactly once',async()=>{
 const uid='gear-codex';await fixture(uid,s=>{s.codex[3]=Object.fromEntries(['mage','archer','warrior','gunner','fighter','armor','acc'].map(h=>[h,30]));});
 const before=await effective(uid);assert.equal((await call(uid,'codex','3:mage')).ok,true);assert.equal((await effective(uid)).mat.crystal,before.mat.crystal+5);
 const rs=await Promise.all([call(uid,'codex','3:all'),call(uid,'codex','3:all')]);assert.equal(rs.filter(x=>x.ok).length,1);
 const after=await effective(uid);assert.equal(after.souls,before.souls+500);assert.equal(after.mat.essence,10);assert.deepEqual(after.codexRw,['3:mage','3:all']);
 assert.equal((await call(uid,'codex','3:mechanic')).ok,false);assert.equal((await call(uid,'codex','1:all')).ok,false);
});
await test('all ten chapters and five grades preserve exact opened item and historical codex bits',async()=>{
 const matrix=[];for(let ch=1;ch<=10;ch++)for(let g=0;g<=4;g++){
  const uid=`open-matrix-${ch}-${g}`;await fixture(uid,s=>{const it=makeItem('weapon','fighter',g,()=>.4,ch);it.id=`matrix-${ch}-${g}`;s.chests=[chestOf(it,'chest')];});
  const before=await effective(uid);assert.equal((await call(uid,'open',before.chests[0].id)).ok,true);const after=await effective(uid);
  assert.deepEqual(after.inv.at(-1),before.chests[0].it);assert.equal(after.codex[ch].fighter,1<<g);assert.equal(after.souls-before.souls,[4,6,10,16,30][g]);matrix.push({ch,g,pass:true});
 }await fs.writeFile(new URL('../../direct-firestore-evidence-22/open-matrix.json',import.meta.url),JSON.stringify(matrix,null,2));
});
await fs.writeFile(resultsURL,JSON.stringify({scope:'real emulator Rules/REST; existing assets seeded only by trusted demo fixture; no browser',tests:rows},null,2));
console.log(JSON.stringify({total:rows.length,passed:rows.filter(x=>x.pass).length}));process.exitCode=rows.some(x=>!x.pass)?1:0;
