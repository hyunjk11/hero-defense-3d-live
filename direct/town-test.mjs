import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,config} from './emulator-harness.mjs';
import {createDirectTransport,directDocument,decodeFields,encodeFields,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave,authorityOf} from '../src/account/direct-authority.js';
import {applyTown} from '../src/account/direct-town.js';
import {townCatalog} from './catalog.mjs';
import * as GR from '../src/data/growth.js';
import * as SX from '../src/account/steel.js';
import * as AD from '../src/data/advance.js';
import * as P from '../src/account/progress.js';
import {totalXP} from '../src/data/hero-growth.js';
await rest(':commit',{writes:[{update:townCatalog()}]});
const suffix=Date.now().toString(36),id=n=>'town8-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
async function putSave(uid,s){const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:s,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});}
async function fixture(uid){const {save}=await seed(uid,{balance:100000});save.souls=100000;save.mat={steel:100000,crystal:10000,essence:100};save.st['2-4']=3;
 for(const h of AD.ADV_HEROES)save.hq[h]={clr:0,...save.hq[h],boss:1};await putSave(uid,save);
 const g=await get(uid,'growth_wallet');g.xp=Object.fromEntries(Object.keys(g.xp).map(h=>[h,totalXP(10)]));g.spent=6*totalXP(10);g.balance=g.granted-g.spent;
 await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_growth_wallet',uid,g)},{update:directDocument(DEMO_PROJECT,uid,'hd3d_owned',uid+'~hero_gunner',{user_id:uid,item:'hero_gunner'})}]});return save;}
let n=0;const args=(action,extra={})=>({p_id:'town-command-'+(++n),p_action:action,...extra});
const exec=(uid,a)=>client(uid).rpc('gear_action',a);
await test('all 81 research upgrades preserve original costs, effects and caps',async()=>{
 const uid=id('research'),start=await fixture(uid);let expected=structuredClone(start);const matrix=[];
 for(const type of GR.TTYPES)for(const stat of GR.RKEYS){for(let level=0;level<GR.RES[stat].max;level++){
  const cost=GR.resCost(stat,level);assert.ok(GR.buyResearch(expected,type,stat));assert.ok((await exec(uid,args('research',{p_type:type,p_stat:stat}))).ok);
  assert.deepEqual(await effective(uid),expected);matrix.push({type,stat,level:level+1,cost});
 }assert.equal((await exec(uid,args('research',{p_type:type,p_stat:stat}))).ok,false);}
 await fs.writeFile(new URL('../../direct-firestore-evidence-22/research-matrix.json',import.meta.url),JSON.stringify(matrix,null,2));assert.equal(matrix.length,81);
});
await test('efficiency prerequisites, poor balances and invalid inputs reject without debits',async()=>{
 const uid=id('locks');await seed(uid);const before=await effective(uid);
 assert.equal((await exec(uid,args('research',{p_type:'arrow',p_stat:'efficiency'}))).ok,false);
 assert.equal((await exec(uid,args('bar'))).ok,false);
 for(const a of [args('research',{p_type:'bad',p_stat:'atk'}),args('research',{p_type:'arrow',p_stat:'__proto__'}),args('exchange',{p_count:0}),args('exchange',{p_count:16}),args('exchange',{p_count:1.1}),args('advance',{p_hero:'mechanic',p_branch:'siege'})])await assert.rejects(exec(uid,a));
 assert.deepEqual(await effective(uid),before);
});
await test('bar levels 1 through 10 cost exactly 40+20*old and preserve save fields',async()=>{
 const uid=id('bar'),expected=await fixture(uid);expected.unrelatedLegacy={note:'preserve',x:[1,2]};await putSave(uid,expected);
 for(let i=0;i<10;i++){assert.ok(SX.buyBar(expected)[1]);assert.ok((await exec(uid,args('bar'))).ok);assert.deepEqual(await effective(uid),expected);}
 assert.equal((await exec(uid,args('bar'))).ok,false);assert.equal(SX.barMul(expected.barLv),1.5);
});
await test('legacy absent research, start alias, optional bar/exchange and unknown values roundtrip without cleaning',async()=>{
 const uid=id('legacy'),save=await fixture(uid);save.research={arrow:{atk:10,rng:2,spd:0,start:1,legacy:'keep'},oldTower:{x:8}};save.futureField={keep:true};await putSave(uid,save);
 const out=await exec(uid,args('research',{p_type:'arrow',p_stat:'efficiency'}));assert.ok(out.ok);const after=await effective(uid);
 assert.equal(after.research.arrow.efficiency,2);assert.equal(after.research.arrow.start,1);assert.equal(after.research.arrow.legacy,'keep');assert.deepEqual(after.research.oldTower,{x:8});assert.deepEqual(after.futureField,save.futureField);
 delete save.research;await putSave(uid,save);assert.ok((await exec(uid,args('research',{p_type:'magic',p_stat:'rng'}))).ok);assert.deepEqual((await effective(uid)).research,{magic:{rng:1}});
 assert.deepEqual(authoritativeSave({},authorityOf(save)),Object.fromEntries(Object.entries(save).filter(([k])=>!['hero','settings','nick','growth'].includes(k))));
});
await test('exchange preserves rate and KST daily limit, replay and simultaneous cap',async()=>{
 const uid=id('exchange'),before=await fixture(uid);const a=args('exchange',{p_count:5});assert.ok((await exec(uid,a)).ok);assert.ok((await exec(uid,a)).already);
 const rr=await Promise.all([exec(uid,args('exchange',{p_count:6})),exec(uid,args('exchange',{p_count:6}))]);assert.equal(rr.filter(r=>r.ok).length,1);
 const end=await exec(uid,args('exchange',{p_count:4}));assert.ok(end.ok);assert.equal((await exec(uid,args('exchange',{p_count:1}))).reason,'cap');
 const after=await effective(uid);assert.equal(after.souls,before.souls+450);assert.equal(after.mat.steel,before.mat.steel-150);assert.deepEqual(after.xch,{d:SX.kstDay(),n:15});
});
await test('prior KST day refreshes once; spoofed tomorrow cannot reset server daily limit',async()=>{
 const uid=id('day'),before=await fixture(uid);before.xch={d:SX.kstDay(Date.now()-86400000),n:15};await putSave(uid,before);
 const c=client(uid);assert.ok((await c.rpc('gear_action',args('exchange',{p_count:15}))).ok);const after=await effective(uid);
 c.setNow(Date.now()+86400000);await assert.rejects(c.rpc('gear_action',args('exchange',{p_count:1})),e=>e.status===403);assert.deepEqual(await effective(uid),after);
 for(const iso of ['2026-11-04T14:59:59.999Z','2026-11-04T15:00:00.000Z']){
  const s={souls:0,mat:{steel:100},xch:{d:'2026-11-04',n:15}},r=applyTown(s,{action:'exchange',count:1},{now:Date.parse(iso)});
  assert.equal(r.result.ok,iso.includes('15:00')); // pure boundary, not emulator clock injection
 }
});
await test('all five heroes first advancement and alternate branch preserve costs and saved trees',async()=>{
 const matrix=[];for(const hero of AD.ADV_HEROES){const uid=id('adv-'+hero),before=await fixture(uid),g=await get(uid,'growth_wallet'),branches=AD.branchesOf(hero);let expected=structuredClone(before);
  for(const branch of branches){const [next,ok]=P.buyAdv({...expected,growth:g},hero,branch,true);assert.ok(ok);delete next.growth;expected=next;
   assert.ok((await exec(uid,args('advance',{p_hero:hero,p_branch:branch}))).ok);assert.deepEqual(await effective(uid),expected);matrix.push({hero,branch,souls:expected.souls,mat:expected.mat,adv:expected.adv[hero]});}
  assert.equal((await exec(uid,args('advance',{p_hero:hero,p_branch:branches.at(-1)}))).ok,false);assert.deepEqual(await get(uid,'growth_wallet'),g);
 }await fs.writeFile(new URL('../../direct-firestore-evidence-22/advancement-matrix.json',import.meta.url),JSON.stringify(matrix,null,2));
});
await test('advancement requires real wallet level, chapter, hero boss trial and owned hero',async()=>{
 for(const fault of ['level','chapter','trial','crystal','essence','souls','ownership']){const uid=id('advlock-'+fault),s=await fixture(uid),h=fault==='ownership'?'gunner':'mage';
  if(fault==='level'){const g=await get(uid,'growth_wallet');g.xp.mage=0;g.spent-=totalXP(10);g.balance+=totalXP(10);await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_growth_wallet',uid,g)}]});s.growth={xp:{mage:999999}};}
  if(fault==='chapter')delete s.st['2-4'];if(fault==='trial')s.hq.mage.boss=0;if(fault==='crystal')s.mat.crystal=19;if(fault==='essence')s.mat.essence=2;if(fault==='souls')s.souls=1499;
  if(fault==='ownership')await rest(':commit',{writes:[{delete:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live/${uid}/hd3d_owned/${uid}~hero_gunner`}]});
  await putSave(uid,s);const before=await effective(uid);const a=args('advance',{p_hero:h,p_branch:AD.branchesOf(h)[0]});
  if(fault==='ownership')await assert.rejects(exec(uid,a));else assert.equal((await exec(uid,a)).ok,false);assert.deepEqual(await effective(uid),before);
 }
});
await test('research lost commit response recovers once; different request body rejected',async()=>{
 const uid=id('lost'),before=await fixture(uid),u=user(uid);let committed=0;
 const transport=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){committed++;throw Error('lost after commit');}return r;}});
 const a=args('research',{p_type:'arrow',p_stat:'atk'});await assert.rejects(transport({kind:'rpc',name:'hd3d_gear_action',args:a},u),/lost after commit/);assert.equal(committed,1);
 assert.ok((await exec(uid,a)).already);assert.equal((await effective(uid)).research.arrow.atk,1);assert.equal((await effective(uid)).souls,before.souls-40);
 await assert.rejects(exec(uid,{...a,p_stat:'spd'}),/reused/);
});
await test('raw town requests cannot skip costs, alter other fields, mint levels or forge unlocks',async()=>{
 for(const action of ['research','bar','exchange','advance']){
  const uid=id('raw-'+action);await fixture(uid);const u=user(uid);let captured;
  const transport=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body).writes;throw Error('captured');}return fetch(url,o);}});
  const a=args(action,{...(action==='research'?{p_type:'arrow',p_stat:'atk'}:action==='exchange'?{p_count:1}:action==='advance'?{p_hero:'mage',p_branch:'flame'}:{})});
  await assert.rejects(transport({kind:'rpc',name:'hd3d_gear_action',args:a},u),/captured/);const before=await get(uid,'progress');
  for(const mutate of [x=>x.souls++,x=>x.mat.steel++,x=>x.sealed='{}',x=>x.heroLv.mage.hp++,x=>x.present.push('research'),x=>{if(action==='research')x.research.arrow.atk++;if(action==='bar')x.barLv++;if(action==='exchange')x.xch.n--;if(action==='advance')x.adv.mage.n++;}]){
   const writes=structuredClone(captured),w=writes.find(w=>w.update.name.includes('/hd3d_progress/')),d=decodeFields(w.update.fields);mutate(d.row.authority);w.update.fields=encodeFields(d);await deniedWrite(uid,writes);
  }
  assert.deepEqual(await get(uid,'progress'),before);await rest(':commit',{writes:captured},await u.getIdToken());
 }
});
await test('fresh ban, missing revision and other account reject captured town writes',async()=>{
 for(const fault of ['ban','revision','other']){const uid=id('guard-'+fault);await fixture(uid);const u=user(uid);let captured;
  const transport=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body).writes;throw Error('captured');}return fetch(url,o);}});
  await assert.rejects(transport({kind:'rpc',name:'hd3d_gear_action',args:args('bar')},u),/captured/);
  if(fault==='ban')await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_bans',uid,{user_id:uid,reason:'synthetic'})}]});
  if(fault==='revision')captured=captured.filter(w=>!w.update.name.endsWith('/_revision'));
  await deniedWrite(fault==='other'?id('other'):uid,captured);
 }
});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/town-results.json',import.meta.url),JSON.stringify({scope:'isolated Firestore Rules emulator; synthetic accounts, no production writes',tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length}));process.exitCode=rows.some(x=>!x.pass)?1:0;
