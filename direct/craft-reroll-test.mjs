import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,raw,config} from './emulator-harness.mjs';
import {createDirectTransport,directDocument,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {applyGear} from '../src/account/direct-economy.js';
import {packTypedItem,unpackGearItem} from '../src/account/direct-gear.js';
import * as E from '../src/account/equip.js';
import {STAGES} from '../src/data/stages.js';
import {itemCatalog} from './catalog.mjs';
await rest(':commit',{writes:itemCatalog().map(update=>({update}))});
const suffix=Date.now().toString(36),id=n=>'cr6-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
function rc(uid,r=()=>.45,fetcher=fetch){const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},random:r,fetcher});return {rpc:(name,args)=>t({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data)};}
async function fixture(uid){const {save}=await seed(uid);save.mat={steel:2000,crystal:2000};save.souls=100000;save.st=Object.fromEntries(Object.keys(STAGES).map(s=>[s,3]));
 const it=E.makeItem('armor',null,4,()=>.4,3);it.id='legacy-roll';it.e=5;it.legacyNote='preserve unknown legacy field';save.inv=[it];
 const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});return save;}
const craft=(n=1,extra={})=>({p_id:'craft-attempt-'+n,p_action:'craft',p_hero:'mage',p_slot:'weapon',p_recipe:'master',p_ch:1,...extra});
await test('ordinary craft reuses original odds, costs, names and item stats across 231 combinations',async()=>{
 const matrix=[];let tick=0;const realNow=Date.now;Date.now=()=>100000;
 try{for(const ch of [0,1,2,3,4,5,6,7,8,9,10])for(const R of E.RECIPES)for(const row of ['mage','archer','warrior','gunner','fighter','armor','acc']){
  const save={inv:[],mat:{steel:10000,crystal:10000},souls:100000,codex:{}},slot=['armor','acc'].includes(row)?row:'weapon',hero=slot==='weapon'?row:'mage';
  const r=()=>.47,expected=E.craft(structuredClone(save),R.k,slot,hero,r,ch);const got=applyGear(save,{action:'craft',recipe:R.k,slot,hero,ch},r);
  assert.deepEqual(got.save,expected[0]);assert.deepEqual(got.result.it,expected[2]);assert.deepEqual(unpackGearItem(packTypedItem(got.result.it)),got.result.it);
  matrix.push({ch,recipe:R.k,row,grade:got.result.it.g,cost:E.craftCost(R,ch)});tick++;
 }}finally{Date.now=realNow;}
 assert.equal(tick,231);await fs.writeFile(new URL('../../direct-firestore-evidence-22/craft-matrix.json',import.meta.url),JSON.stringify(matrix,null,2));
});
await test('Rules accept original crafted item shapes for all three recipes and slots',async()=>{
 for(const recipe of ['basic','fine','master'])for(const slot of ['weapon','armor','acc']){
  const uid=id(recipe+'-'+slot);const before=await fixture(uid);const c=rc(uid);const result=await c.rpc('gear_action',craft(1,{p_recipe:recipe,p_slot:slot,p_ch:3}));assert.ok(result.ok);
  const after=await effective(uid),cost=E.craftCost(E.RECIPES.find(r=>r.k===recipe),3);assert.deepEqual(after.inv,[...before.inv,result.it]);assert.equal(after.souls,before.souls-cost.souls);assert.equal(after.mat.steel,before.mat.steel-cost.steel);
  assert.ok(after.codex[3][slot==='weapon'?'mage':slot]&(1<<result.it.g));assert.equal((await c.rpc('gear_action',craft(1,{p_recipe:recipe,p_slot:slot,p_ch:3}))).already,true);
 }
});
await test('craft lost response resumes one exact item and rejects request reuse',async()=>{
 const uid=id('lost');const before=await fixture(uid);let commits=0;const c=rc(uid,()=>.999,async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok){commits++;throw Error('lost craft');}return r;});const args=craft();
 await assert.rejects(c.rpc('gear_action',args),/lost craft/);assert.equal(commits,1);const [a,b]=await Promise.all([client(uid).rpc('gear_action',args),client(uid).rpc('gear_action',args)]);
 assert.ok(a.already&&b.already);assert.deepEqual(a.it,b.it);assert.equal((await effective(uid)).inv.length,before.inv.length+1);await assert.rejects(client(uid).rpc('gear_action',{...args,p_ch:2}),/reused/);
});
await test('locked set, unowned hero and invalid recipe cannot buy or mint gear',async()=>{
 const uid=id('locked');await seed(uid);const c=client(uid),before=await effective(uid);
 for(const a of [craft(1),craft(2,{p_ch:0,p_hero:'gunner'}),craft(3,{p_ch:0,p_recipe:'cheat'}),craft(4,{p_ch:0,p_slot:'cape'})])await assert.rejects(c.rpc('gear_action',a));
 assert.deepEqual(await effective(uid),before);
});
await test('paid legacy reroll keeps base fields, allows keep, and applies a candidate exactly once',async()=>{
 const uid=id('reroll');const before=await fixture(uid),c=rc(uid,()=>.95);const a={p_id:'paid-roll-001',p_action:'reroll',p_item:'legacy-roll'};
 const r=await c.rpc('gear_action',a);assert.ok(E.validSubs(before.inv[0],r.sub));const paid=await effective(uid);assert.deepEqual(paid.inv,before.inv);assert.equal(paid.mat.steel,before.mat.steel-90);
 const apply={p_id:'apply-'+a.p_id,p_action:'reroll_apply',p_item:a.p_item,p_source:a.p_id};const applied=await c.rpc('gear_action',apply);assert.ok(applied.ok);const after=await effective(uid);
 assert.deepEqual(after.inv[0],{...before.inv[0],sub:r.sub});assert.equal(after.mat.steel,paid.mat.steel);assert.equal((await c.rpc('gear_action',apply)).already,true);assert.deepEqual(await effective(uid),after);
 await assert.rejects(c.rpc('gear_action',{...apply,p_id:'new-apply-id'}));await assert.rejects(c.rpc('gear_action',{...apply,p_item:'other-item'}));
 const kept=await c.rpc('gear_action',{...a,p_id:'paid-roll-002'});assert.ok(kept.ok);assert.deepEqual((await effective(uid)).inv,after.inv);assert.equal((await effective(uid)).mat.steel,before.mat.steel-180);
});
await test('typed craft -> reroll -> enhance -> storage -> reopen retains the same item',async()=>{
 const uid=id('roundtrip');await fixture(uid);const c=rc(uid,()=>.95),cr=await c.rpc('gear_action',craft(3));
 const r=await c.rpc('gear_action',{p_id:'typed-roll-01',p_action:'reroll',p_item:cr.it.id});
 await c.rpc('gear_action',{p_id:'apply-typed-roll-01',p_action:'reroll_apply',p_item:cr.it.id,p_source:'typed-roll-01'});
 await c.rpc('gear_action',{p_id:'typed-enhance-01',p_action:'enhance',p_item:cr.it.id});
 const enhanced=(await effective(uid)).inv.find(x=>x.id===cr.it.id);assert.equal(enhanced.e,1);assert.deepEqual(enhanced.sub,r.sub);
 await c.rpc('gear_action',{p_id:'typed-store-01',p_action:'store',p_item:cr.it.id});await c.rpc('gear_action',{p_id:'typed-take-01',p_action:'take',p_item:cr.it.id});
 assert.deepEqual((await effective(uid)).inv.find(x=>x.id===cr.it.id),enhanced);
});
await test('raw craft rejects extra currency, invented main stats, illegal grade, bonus subs and extra item fields',async()=>{
 const uid=id('raw');await fixture(uid);const p=await get(uid,'progress'),revision=(await get(uid,'sequences','_revision')).value+1,pr={op:'gear_craft',request:'raw-craft-01',token:'',hero:'mage',level:1,stat:'',slot:'weapon',pay:'',pos:0,choice:'master'};
 const it=packTypedItem(E.makeItem('weapon','mage',4,()=>.4,1)),good=structuredClone(p.authority);good.souls-=240;good.mat.steel-=96;good.mat.crystal-=10;good.gear.inv.push(it);good.gear.bagIds.push(it.id);good.gear.codex[1].mage|=16;
 const writes=a=>[{update:raw(uid,'progress',uid,{...p,authority:a,updated_at:'2026-12-01'},revision)},{update:raw(uid,'growth_investments',uid+'~gear~'+pr.request,{id:uid+'~gear~'+pr.request,user_id:uid,body:'{}',at:'x',result:{ok:true,id:pr.request,action:'craft',it:a.gear.inv.at(-1)}},revision)},{update:raw(uid,'sequences','_revision',{id:'_revision',value:revision,proof:pr},revision)}];
 for(const mutate of [a=>a.souls++,a=>a.gear.inv.at(-1).spec.m[1]=999,a=>a.gear.inv.at(-1).spec.sub.push({k:'hp',v:999}),a=>a.gear.inv.at(-1).spec.u='quake',a=>a.gear.inv.at(-1).uq=true,a=>a.gear.inv.at(-1).body='{"m":["atk",999]}']){
  const bad=structuredClone(good);mutate(bad);await deniedWrite(uid,writes(bad));
 }assert.deepEqual(await get(uid,'progress'),p);await rest(':commit',{writes:writes(good)},await user(uid).getIdToken());
});
await test('raw operations cannot skip revision, operate after ban/deactivation or disguise another receipt as paid reroll',async()=>{
 for(const mode of ['ban','inactive','no-revision','fake-roll']){
  const uid=id('fence-'+mode);await fixture(uid);let writes;
  const c=rc(uid,()=>.5,async(u,o)=>{if(u.endsWith(':commit')){writes=JSON.parse(o.body).writes;throw Error('capture before sending');}return fetch(u,o);});
  await assert.rejects(c.rpc('gear_action',{p_id:'fence-test-01',p_action:'enhance',p_item:'legacy-roll'}),/capture before sending/);
  if(mode==='ban')await rest(':commit',{writes:[{update:raw(uid,'bans',uid,{user_id:uid,reason:'fixture'},0)}]});
  if(mode==='inactive')await rest(':commit',{writes:[{update:raw(uid,'sequences','_activation',{id:'_activation',schema:1,enabled:false},0)}]});
  if(mode==='no-revision')writes=writes.filter(w=>!w.update.name.endsWith('/_revision'));
  if(mode==='fake-roll'){const receipt=writes.find(w=>w.update.name.includes('/hd3d_growth_investments/'));receipt.update.fields.row.mapValue.fields.result.mapValue.fields.action={stringValue:'reroll'};}
  const before=await get(uid,'progress');await deniedWrite(uid,writes);assert.deepEqual(await get(uid,'progress'),before);
 }
});
await test('reroll with identical legacy options still pays and can finish apply',async()=>{
 const uid=id('same');const before=await fixture(uid),c=rc(uid,()=>.4);const r=await c.rpc('gear_action',{p_id:'same-roll-001',p_action:'reroll',p_item:'legacy-roll'});
 assert.deepEqual(r.sub,before.inv[0].sub);assert.equal((await c.rpc('gear_action',{p_id:'apply-same-roll-001',p_action:'reroll_apply',p_item:'legacy-roll',p_source:'same-roll-001'})).ok,true);
 assert.deepEqual((await effective(uid)).inv,before.inv);assert.equal((await effective(uid)).mat.steel,before.mat.steel-90);
});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/craft-reroll-results.json',import.meta.url),JSON.stringify({scope:'local real Rules plus original pure RNG comparison; no proof of fair client RNG',tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length}));process.exitCode=rows.some(x=>!x.pass)?1:0;
