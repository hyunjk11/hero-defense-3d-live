import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,raw,root,config} from './emulator-harness.mjs';
import {createDirectTransport,directDocument,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {makeItem,enhCost} from '../src/account/equip.js';
import {stageCatalog} from './catalog.mjs';
await rest(':commit',{writes:stageCatalog().map(update=>({update}))});
const suffix=Date.now().toString(36),id=n=>'phase6-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
function randomClient(uid,random,fetcher=fetch){const u=user(uid),transport=createDirectTransport(config,{auth:{currentUser:u},random,fetcher});return {rpc:(name,args)=>transport({kind:'rpc',name:'hd3d_'+name,args},u).then(r=>r.data)};}
async function gearFixture(uid,e=0,money=100000){const {save}=await seed(uid);const it=makeItem('armor',null,4,()=>.4,1);it.id='enh-item';it.e=e;save.inv=[it];save.souls=money;save.mat={steel:10000,crystal:10000};
 const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});return save;}
async function finished(uid,token){await seed(uid);const c=client(uid);await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});
 const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');doc.fields.issuedAt={timestampValue:new Date(Date.now()-60000).toISOString()};delete doc.createTime;delete doc.updateTime;
 await rest(':commit',{writes:[{update:doc}]});c.setNow(Date.now()+60000);await c.rpc('growth_progress',{p_token:token,p_completed:1,p_win:false,p_finish:true});
 return {p_id:'run-'+token,p_action:'run_return',p_item:token,p_wave:1,p_kills:11};}
await test('ordinary enhancement retains all ten costs and the +10 cap',async()=>{
 const uid=id('ten');await gearFixture(uid);const c=randomClient(uid,()=>0),matrix=[];
 for(let n=0;n<10;n++){const before=await effective(uid),cost=enhCost(before.inv[0]);const r=await c.rpc('gear_action',{p_id:'enhance-level-'+n,p_action:'enhance',p_item:'enh-item'});
  assert.equal(r.ok,true);assert.equal(r.reason,'ok');const after=await effective(uid);assert.equal(after.inv[0].e,n+1);
  assert.equal(after.souls,before.souls-cost.souls);assert.equal(after.mat.steel,before.mat.steel-cost.steel);assert.equal(after.mat.crystal,before.mat.crystal-cost.crystal);matrix.push({from:n,to:n+1,cost});}
 const before=await effective(uid);assert.equal((await c.rpc('gear_action',{p_id:'enhance-max',p_action:'enhance',p_item:'enh-item'})).reason,'max');assert.deepEqual(await effective(uid),before);
 await fs.writeFile(new URL('../../direct-firestore-evidence-22/enhance-matrix.json',import.meta.url),JSON.stringify(matrix,null,2));
});
await test('failed paid enhancement survives unknown response and simultaneous retries exactly once',async()=>{
 const uid=id('fail'),before=await gearFixture(uid,5),cost=enhCost(before.inv[0]);let commits=0;
 const c=randomClient(uid,()=>.999,async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok){commits++;throw Error('lost enhancement response');}return r;});
 const a={p_id:'failed-upgrade-1',p_action:'enhance',p_item:'enh-item'};await assert.rejects(c.rpc('gear_action',a),/lost enhancement/);assert.equal(commits,1);
 const rs=await Promise.all([randomClient(uid,()=>0).rpc('gear_action',a),randomClient(uid,()=>0).rpc('gear_action',a)]);assert.ok(rs.every(r=>r.already&&r.reason==='fail'));
 const after=await effective(uid);assert.equal(after.inv[0].e,5);assert.equal(after.souls,before.souls-cost.souls);assert.equal(after.mat.steel,before.mat.steel-cost.steel);
});
await test('two requests with funds for one attempt cannot grant a free extra enhancement',async()=>{
 const uid=id('race');await gearFixture(uid,0,60);const c=randomClient(uid,()=>0);
 const rs=await Promise.all([1,2].map(i=>c.rpc('gear_action',{p_id:'race-attempt-'+i,p_action:'enhance',p_item:'enh-item'})));
 assert.equal(rs.filter(r=>r.ok).length,1);const after=await effective(uid);assert.equal(after.inv[0].e,1);assert.equal(after.souls,0);
});
await test('normal first-wave return preserves XP and credits original souls/statistics once',async()=>{
 const uid=id('return'),a=await finished(uid,'normal-return-1'),before=await effective(uid);
 const rs=await Promise.all([client(uid).rpc('gear_action',a),client(uid).rpc('gear_action',a)]);assert.ok(rs.every(r=>r.ok));assert.equal(rs.filter(r=>!r.already).length,1);
 const after=await effective(uid);assert.equal(after.souls,before.souls+11);assert.equal(after.stats.runs,before.stats.runs+1);assert.equal(after.stats.kills,before.stats.kills+11);assert.equal(after.stats.waves,before.stats.waves+1);assert.equal(after.stats.souls,before.stats.souls+11);
 assert.equal((await get(uid,'growth_wallet')).earned,10);assert.deepEqual(after.inv,before.inv);assert.deepEqual(after.chests,before.chests);assert.deepEqual(after.st,before.st);
 assert.equal((await client(uid).rpc('gear_action',a)).already,true);assert.deepEqual(await effective(uid),after);
 await assert.rejects(client(uid).rpc('gear_action',{...a,p_kills:12}),/reused/);
});
await test('normal return unknown commit resumes the original receipt without losing or repeating reward',async()=>{
 const uid=id('return-loss'),a=await finished(uid,'normal-return-2'),before=await effective(uid);let commits=0;
 const c=randomClient(uid,()=>0,async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok){commits++;throw Error('lost return response');}return r;});
 await assert.rejects(c.rpc('gear_action',a),/lost return/);assert.equal(commits,1);assert.equal((await client(uid).rpc('gear_action',a)).already,true);
 const after=await effective(uid);assert.equal(after.souls,before.souls+11);assert.equal(after.stats.runs,before.stats.runs+1);
});
await test('return cannot claim another receipt ID, unfinished run, absent run or item-bearing settlement',async()=>{
 const uid=id('invalid-return');await seed(uid);const c=client(uid),token='unfinished-run';await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});
 const a={p_id:'run-'+token,p_action:'run_return',p_item:token,p_wave:1,p_kills:11};const before=await effective(uid);
 for(const patch of [{},{p_id:'different-id'},{p_item:'absent',p_id:'run-absent'},{p_wave:5},{p_kills:-1}])await assert.rejects(c.rpc('gear_action',{...a,...patch}));
 assert.deepEqual(await effective(uid),before);
});
await test('raw return cannot mint extra currency, alter equipment or claim the same run under another ID',async()=>{
 const uid=id('raw-return'),a=await finished(uid,'raw-normal-return'),p=await get(uid,'progress'),rev=(await get(uid,'sequences','_revision')).value+1;
 const proof={op:'gear_run_return',request:a.p_id,token:a.p_item,hero:'',level:1,kills:11,stat:'',slot:'',pay:'',pos:0};
 const good=structuredClone(p.authority);good.souls+=11;good.gear.stats.runs++;good.gear.stats.kills+=11;good.gear.stats.waves++;good.gear.stats.souls+=11;
 const writes=(authority,pr=proof)=>[{update:raw(uid,'progress',uid,{...p,authority,updated_at:'2026-12-01'},rev)},
 {update:raw(uid,'growth_investments',uid+'~gear~'+pr.request,{id:uid+'~gear~'+pr.request,user_id:uid,body:'{}',at:'2026-12-01',result:{ok:true,id:pr.request,action:'run_return'}},rev)},
 {update:raw(uid,'sequences','_revision',{id:'_revision',value:rev,proof:pr},rev)}];
 for(const change of [x=>x.souls++,x=>x.gear.inv.push({id:'free'}),x=>x.gear.stats.runs++,x=>x.mat.steel++]){const bad=structuredClone(good);change(bad);await deniedWrite(uid,writes(bad));}
 await deniedWrite(uid,writes(good,{...proof,request:'different-return'}));assert.deepEqual(await get(uid,'progress'),p);
});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/return-enhance-results.json',import.meta.url),JSON.stringify({scope:'real local Rules; explicit issuedAt aging for run fixtures; not gameplay proof',tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length}));process.exitCode=rows.some(x=>!x.pass)?1:0;
