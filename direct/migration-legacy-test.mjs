import {assert,fs,test,rows,user,rest,seed,client,get,raw,root,deniedWrite} from './emulator-harness.mjs';
import {toDocument,numericTables} from '../server/firestore.mjs';
import {directDocument,DEMO_PROJECT,encodeFields,decodeFields} from '../src/account/direct-store.js';
import {makeItem,chestOf} from '../src/account/equip.js';
import {packItem,unpackItem} from '../src/account/storpack.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
const before=process.argv.includes('--before');
const {convertAccount}=await import(before?'../../candidate-v34-firestore-direct-4/direct/migration.mjs':'./migration.mjs');
const suffix=Date.now().toString(36),uidOf=x=>'legacy5-'+x+'-'+suffix;
const high={sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,5000]))};
const today=new Date(Date.now()+32400000).toISOString().slice(0,10);
const yesterday=new Date(Date.now()+32400000-86400000).toISOString().slice(0,10);
const dayKey=day=>'dungeon-'+(Date.parse(day+'T00:00:00.000Z')/86400000);
function run(uid,status='done',day=today,id=4999) {
 const iso=new Date(Date.parse(day+'T00:00:00.000Z')-32400000).toISOString();
 return {id,user_id:uid,day,token:'historical-'+id,growth:false,status,started_at:iso,
  finished_at:status==='active'?null:iso,floors:status==='active'?null:0,win:status==='active'?null:false,
  medals:0,uq:null,boss_reward:null,soul_reward:status==='done'?{ok:true,souls:0,mail:null,medals:0,total:0,floors:0,win:false,capped:false}:null,created_at:iso};
}
async function fixture(uid,runs=[]) {
 const base=await seed(uid),source=[...base.source,...runs.map(r=>toDocument('hd3d_dungeon_runs',r))];
 const docs=convertAccount(uid,source,high);await rest(':commit',{writes:docs.map(update=>({update}))});
 return {source,docs,save:base.save};
}
async function rawStart(uid,id=5001) {
 const row=run(uid,'active',today,id);row.token='raw-'+id;row.started_at=new Date().toISOString();row.created_at=row.started_at;
 const revision=(await get(uid,'sequences','_revision')).value+1;
 const proof={op:'dungeon_start',request:String(id),token:row.token,hero:'',level:0,stat:''};
 const key=dayKey(today);
 return [{update:raw(uid,'dungeon_runs',String(id),row,revision),updateTransforms:[{fieldPath:'issuedAt',setToServerValue:'REQUEST_TIME'}]},
  {update:raw(uid,'sequences',key,{id:key,value:id},revision)},
  {update:raw(uid,'sequences','_revision',{id:'_revision',value:revision,proof},revision)}];
}
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
let serial=0;
const args=(action,item='',extra={})=>({p_id:'legacy-action-'+(++serial),p_action:action,p_item:item,...extra});
const call=(uid,a,c=client(uid))=>c.rpc('gear_action',a);
async function gearFixture(uid,change=()=>{}) {
 const {save}=await seed(uid);save.mat={steel:1000,crystal:100};save.souls=1000;save.eq={};
 const it=makeItem('armor',null,2,()=>.4,1);it.id='old-no-e';delete it.e;save.inv=[it];change(save);
 const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});
 return save;
}

if(before) {
 await test('DF3-02 reproduced: migrated completed run permits second authenticated raw entry',async()=>{
  const uid=uidOf('before-dg');await fixture(uid,[run(uid)]);
  assert.equal((await client(uid).rpc('dungeon_start')).reason,'daily_limit');
  await rest(':commit',{writes:await rawStart(uid)},await user(uid).getIdToken());
  assert.equal((await client(uid).rpc('dungeon_status')).used,2);
 });
 await test('DF3-03 reproduced: missing-e legacy item store is denied and assets remain unchanged',async()=>{
  const uid=uidOf('before-gear'),original=await gearFixture(uid);
  await assert.rejects(call(uid,args('store','old-no-e')),e=>e.status===403);
  assert.deepEqual(await effective(uid),original);
 });
} else {
 for(const status of ['done','active','abandoned'])await test('migrated '+status+' entry retains daily limit in API and raw Rules',async()=>{
  const uid=uidOf(status),historical=run(uid,status),{source,docs}=await fixture(uid,[historical]);
  const markers=docs.filter(d=>d.name.includes('/hd3d_sequences/dungeon-'));
  assert.equal(markers.length,1);assert.equal(decodeFields(markers[0].fields).row.value,4999);
  assert.ok(docs.indexOf(markers[0])<docs.findIndex(d=>d.name.endsWith('/_activation')));
  assert.deepEqual(convertAccount(uid,source,high),docs);
  assert.deepEqual(await get(uid,'dungeon_runs','4999'),historical);
  const results=await Promise.all([1,2].map(()=>client(uid).rpc('dungeon_start')));
  assert.ok(results.every(r=>r.reason==='daily_limit'));
  const revision=(await get(uid,'sequences','_revision')).value;
  await deniedWrite(uid,await rawStart(uid));
  const ds=await client(uid).query({table:'hd3d_dungeon_runs',action:'select'});
  assert.equal(ds.data.length,1);assert.equal((await get(uid,'sequences','_revision')).value,revision);
  const key=dayKey(today);await deniedWrite(uid,[{delete:`${root}/hd3d_live/${uid}/hd3d_sequences/${key}`}]);
  assert.equal((await get(uid,'sequences',key)).value,4999);
 });
 await test('previous-day active history allows exactly one concurrent current-day entry',async()=>{
  const uid=uidOf('next-day');await fixture(uid,[run(uid,'active',yesterday)]);
  const rs=await Promise.all([1,2].map(()=>client(uid).rpc('dungeon_start')));
  assert.equal(rs.filter(x=>x.ok).length,1);assert.equal((await get(uid,'dungeon_runs','4999')).status,'abandoned');
  assert.equal((await client(uid).rpc('dungeon_status')).used,1);
  assert.equal((await get(uid,'sequences',dayKey(yesterday))).value,4999);
  assert.equal((await get(uid,'sequences',dayKey(today))).value,5001);
  await deniedWrite(uid,await rawStart(uid,5002));
 });
 await test('Korean day boundaries, duplicate historical runs, deterministic markers and invalid exports',async()=>{
  const uid=uidOf('dates'),base=await seed(uid);
  const a=run(uid,'done','2026-01-02',4998),b=run(uid,'abandoned','2026-01-02',4999);
  assert.equal(a.started_at.slice(0,10),'2026-01-01');
  const source=[...base.source,toDocument('hd3d_dungeon_runs',a),toDocument('hd3d_dungeon_runs',b)];
  const docs=convertAccount(uid,source,high),markers=docs.filter(d=>d.name.includes('/hd3d_sequences/dungeon-'));
  assert.equal(markers.length,1);assert.ok(markers[0].name.endsWith('/'+dayKey('2026-01-02')));
  assert.equal(decodeFields(markers[0].fields).row.value,4999);
  assert.deepEqual(convertAccount(uid,source,high),docs);
  for(const day of [undefined,'2026-2-3','2026-02-30','not-a-day']) {
   const bad={...a,day};if(day===undefined)delete bad.day;
   assert.throws(()=>convertAccount(uid,[...base.source,toDocument('hd3d_dungeon_runs',bad)],high),/historical dungeon day/);
  }
 });
 await test('lost current-day entry response after migration cannot consume another slot',async()=>{
  const uid=uidOf('lost');await fixture(uid,[run(uid,'done',yesterday)]);let commits=0;
  const c=client(uid,{fetcher:async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok){commits++;throw Error('lost dungeon response');}return r;}});
  await assert.rejects(c.rpc('dungeon_start'),/lost dungeon response/);assert.equal(commits,1);
  assert.equal((await client(uid).rpc('dungeon_start')).reason,'daily_limit');
  assert.equal((await client(uid).rpc('dungeon_status')).used,1);await deniedWrite(uid,await rawStart(uid,5002));
 });
 await test('missing-e item moves, equips with absent hero keys, upgrades deterministically and dismantles',async()=>{
  const uid=uidOf('gear'),before=await gearFixture(uid);
  assert.deepEqual(await effective(uid),before);
  for(const action of ['store','take'])assert.equal((await call(uid,args(action,'old-no-e'))).ok,true);
  assert.deepEqual((await effective(uid)).inv,before.inv);assert.equal(Object.hasOwn((await effective(uid)).inv[0],'e'),false);
  assert.equal((await call(uid,args('equip','old-no-e',{p_hero:'mage'}))).ok,true);
  assert.equal((await call(uid,args('store','old-no-e'))).reason,'equipped');
  assert.equal((await call(uid,args('equip','old-no-e',{p_hero:'fighter'}))).ok,true);
  assert.equal((await effective(uid)).eq.mage.armor,undefined);assert.equal((await effective(uid)).eq.fighter.armor,'old-no-e');
  assert.equal((await call(uid,args('unequip','',{p_hero:'fighter',p_slot:'armor'}))).ok,true);
  const upgrade=args('enhance','old-no-e');assert.equal((await call(uid,upgrade)).ok,true);
  const up=await effective(uid);assert.deepEqual(up.inv,[{...before.inv[0],e:1}]);assert.equal(up.souls,960);assert.equal(up.mat.steel,998);
  assert.equal((await call(uid,upgrade)).already,true);assert.deepEqual(await effective(uid),up);
  assert.equal((await call(uid,args('enhance','old-no-e'))).reason,'ok');assert.equal((await effective(uid)).inv[0].e,2);
  assert.equal((await call(uid,args('dismantle','old-no-e'))).ok,true);const end=await effective(uid);
  assert.equal(end.inv.length,0);assert.equal(end.souls,880);assert.equal(end.mat.steel,1006);assert.equal(end.mat.crystal,101);
  assert.deepEqual(end.codex,before.codex);
 });
 await test('missing-e unenhanced dismantle uses zero cost level, once after lost response',async()=>{
  const uid=uidOf('gear-loss'),before=await gearFixture(uid),a=args('dismantle','old-no-e');let commits=0;
  const c=client(uid,{fetcher:async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok){commits++;throw Error('lost dismantle response');}return r;}});
  await assert.rejects(call(uid,a,c),/lost dismantle response/);assert.equal(commits,1);
  const rs=await Promise.all([call(uid,a),call(uid,a)]);assert.ok(rs.every(r=>r.already));
  const end=await effective(uid);assert.equal(end.mat.steel,before.mat.steel+8);assert.equal(end.mat.crystal,before.mat.crystal+1);assert.equal(end.souls,before.souls);assert.equal(end.inv.length,0);
 });
 await test('legacy packed storage stays byte-identical until take and returns through equip/store',async()=>{
  const uid=uidOf('packed'),before=await gearFixture(uid,s=>{s.stor=[packItem(s.inv[0])];s.inv=[];s.eq={mage:{}};});
  assert.deepEqual(await effective(uid),before);const it=unpackItem(before.stor[0]);
  assert.equal((await call(uid,args('take',it.id))).ok,true);assert.deepEqual((await effective(uid)).inv,[it]);
  assert.equal((await call(uid,args('equip',it.id,{p_hero:'mage'}))).ok,true);
  assert.equal((await call(uid,args('unequip','',{p_hero:'mage',p_slot:'armor'}))).ok,true);
  assert.equal((await call(uid,args('store',it.id))).ok,true);assert.deepEqual((await effective(uid)).stor,[it]);
  assert.equal((await call(uid,args('take',it.id))).ok,true);assert.deepEqual((await effective(uid)).inv,[it]);
 });
 await test('pre-rolled missing-e chest preserves identity and registers codex only on opening',async()=>{
  const uid=uidOf('chest'),before=await gearFixture(uid,s=>{s.chests=[chestOf(s.inv[0],'chest')];s.inv=[];});
  assert.equal((await call(uid,args('open',before.chests[0].id))).ok,true);
  const after=await effective(uid);assert.deepEqual(after.inv,[before.chests[0].it]);assert.equal(Object.hasOwn(after.inv[0],'e'),false);
  assert.equal(after.souls,before.souls+10);assert.equal(after.codex[1].armor,4);
 });
 await test('raw legacy enhancement cannot hide levels, edit body, skip cost or roll +2',async()=>{
  const uid=uidOf('forge');await gearFixture(uid);const p=await get(uid,'progress');
  const proof={op:'gear_enhance',request:'legacy-forge',token:'old-no-e',hero:'',level:0,stat:'',slot:'',pay:'',pos:0};
  const make=auth=>[{update:raw(uid,'progress',uid,{...p,updated_at:'2026-05-01',authority:auth},1)},
   {update:raw(uid,'growth_investments',uid+'~gear~legacy-forge',{id:uid+'~gear~legacy-forge',user_id:uid,at:'2026-05-01',body:'{}',result:{ok:true,id:'legacy-forge',action:'enhance'}},1)},
   {update:raw(uid,'sequences','_revision',{id:'_revision',value:1,proof},1)}];
  const valid=structuredClone(p.authority);valid.gear.inv[0].e=1;valid.gear.inv[0].hasE=true;valid.souls-=40;valid.mat.steel-=2;
  for(const mutate of [x=>x.gear.inv[0].hasE=false,x=>x.gear.inv[0].e=2,x=>x.gear.inv[0].body='{}',x=>x.souls+=40]){
   const bad=structuredClone(valid);mutate(bad);await deniedWrite(uid,make(bad));
  }
  assert.deepEqual(await get(uid,'progress'),p);assert.equal((await get(uid,'sequences','_revision')).value,0);
 });
 await test('partial legacy equipment map cannot grant extra slots or alter unknown retained keys',async()=>{
  const uid=uidOf('eq-forge');await gearFixture(uid,s=>{s.eq={legacy:{note:'preserve'}};});const p=await get(uid,'progress');
  const proof={op:'gear_equip',request:'legacy-equip-forge',token:'old-no-e',hero:'mage',level:0,stat:'',slot:'',pay:'',pos:0};
  const make=eq=>[{update:raw(uid,'progress',uid,{...p,updated_at:'2026-05-01',authority:{...p.authority,gear:{...p.authority.gear,eq}}},1)},
   {update:raw(uid,'growth_investments',uid+'~gear~legacy-equip-forge',{id:uid+'~gear~legacy-equip-forge',user_id:uid,at:'2026-05-01',body:'{}',result:{ok:true,id:'legacy-equip-forge',action:'equip'}},1)},
   {update:raw(uid,'sequences','_revision',{id:'_revision',value:1,proof},1)}];
  for(const eq of [{legacy:{note:'changed'},mage:{armor:'old-no-e'}},
   {legacy:{note:'preserve'},mage:{armor:'old-no-e',weapon:'old-no-e'}},
   {legacy:{note:'preserve'},mage:{armor:'old-no-e'},warrior:{armor:'old-no-e'}}])await deniedWrite(uid,make(eq));
  assert.deepEqual(await get(uid,'progress'),p);
  assert.equal((await call(uid,args('equip','old-no-e',{p_hero:'mage'}))).ok,true);
  assert.deepEqual((await effective(uid)).eq,{legacy:{note:'preserve'},mage:{armor:'old-no-e'}});
 });
}
const output={mode:before?'reproduction of defects, passes mean defects present':'fixed candidate, actual local Firestore Rules and product RPC',date:new Date().toISOString(),tests:rows};
await fs.writeFile(new URL('../../direct-firestore-evidence-22/'+(before?'before-defects':'migration-legacy-results')+'.json',import.meta.url),JSON.stringify(output,null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length}));process.exitCode=rows.some(x=>!x.pass)?1:0;
