import {assert,fs,test,rows,user,rest,seed,get,config,root} from './emulator-harness.mjs';
import {createDirectTransport,decodeFields,encodeFields,directDocument} from '../src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {HARD_STAGES,hardReward} from '../src/data/hard.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const suffix=Date.now().toString(36),id=n=>'hard14-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
const C=(uid,random=()=>.7,fetcher=async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&!r.ok){await fs.writeFile('../direct-firestore-evidence-22/hard-failed-commit.json',o.body);}return r;})=>{const u=user(uid),auth={currentUser:u},t=createDirectTransport(config,{auth,random,fetcher});return {u,auth,rpc:(name,args={})=>t({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data)};};
async function fixture(n,{stage='hard-1-1',first=false,party=false,version=2,capacity=0}={}){
 const uid=id(n);await seed(uid,{hard:true});
 const w=await get(uid,'growth_wallet');w.hard={st:Object.fromEntries(Object.keys(HARD_STAGES).filter(k=>!first||k!==stage).map(k=>[k,3]))};
 const p=await get(uid,'progress'),save=authoritativeSave(p.cosmetic,p.authority);
 if(capacity){const {makeItem,addChests}=await import('../src/account/equip.js');for(let i=0;i<capacity;i++){const it=makeItem('armor',undefined,0,()=>.5,1);it.id='filled'+i;addChests(save,[{it,src:'chest'}]);}}
 const {authorityOf}=await import('../src/account/direct-authority.js');p.authority=authorityOf(save);
 await rest(':commit',{writes:[{update:directDocument(config.firebase.projectId,uid,'hd3d_growth_wallet',uid,w)},{update:{name:root+'/hd3d_live/'+uid+'/hd3d_progress/'+uid,fields:encodeFields({owner:uid,version:1,row:p})}}]});
 const c=C(uid),token='hard-test-'+n.replaceAll('_','-')+'-'+suffix,s=HARD_STAGES[stage];const r=await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_hero:'fighter',p_stage:stage,p_target:'mage',...(party?{p_partyVersion:1,p_partner:'mage'}:{})});assert(r.ok,JSON.stringify(r));
 const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');const value=decodeFields(doc.fields);const at=new Date(Date.now()-120000).toISOString();value.row.started_at=at;value.row.hardRewardVersion=version;doc.fields=encodeFields(value);doc.fields.issuedAt={timestampValue:at};delete doc.createTime;delete doc.updateTime;await rest(':commit',{writes:[{update:doc}]});
 return {uid,c,token,s,before:await effective(uid),args:{p_token:token,p_completed:s.waves,p_win:true,p_finish:true,p_stars:3,p_kills:11}};
}
await test('first and repeat hard settlement preserve XP, item descriptors, telemetry and sequence',async()=>{
 for(const first of [true,false]){const f=await fixture('basic'+first,{first}),r=await f.c.rpc('growth_progress',f.args);assert(r.ok&&r.hardSaved,JSON.stringify(r));const after=await effective(f.uid),run=await get(f.uid,'growth_runs',f.uid+'~'+f.token),expected=hardReward(f.s,f.s.waves,true,first,'fighter',()=>.7,first?null:'mage',2);
  assert.equal(after.souls,f.before.souls+expected.souls);assert.equal(after.chests.length,expected.items.length);assert.equal(after.stats.kills,(f.before.stats.kills||0)+11);assert.equal(after.hardRewardSeq,(f.before.hardRewardSeq||0)+1);assert.equal(run.directReward.method,'normal');assert.deepEqual((await get(f.uid,'growth_investments',f.uid+'~hard~'+f.token)).result.specs,expected.items);assert(!('mail' in run.directReward));assert.equal(run.hardSaved,true);
  await f.c.rpc('growth_progress',{...f.args,p_kills:999});assert.deepEqual(await effective(f.uid),after);
 }
});
await test('all 30 stages: repeat target and two low-grade boxes preserve existing base counts',async()=>{
 const matrix=[];
 for(const stage of Object.keys(HARD_STAGES)){const f=await fixture(stage.replaceAll('-',''),{stage,party:true}),r=await f.c.rpc('growth_progress',f.args),save=await effective(f.uid),run=await get(f.uid,'growth_runs',f.uid+'~'+f.token);
  const expected=hardReward(f.s,f.s.waves,true,false,'fighter',()=>.7,'mage',2);assert(r.ok&&r.hardSaved);assert.equal(save.chests.length,expected.items.length);assert.equal(run.directReward.method,'normal');assert.deepEqual((await get(f.uid,'growth_investments',f.uid+'~hard~'+f.token)).result.specs,expected.items);assert(!('mail' in run.directReward));assert.equal(save.chests[0].it.h,'mage');assert(save.chests.slice(-2).every(x=>x.it.g<=2));assert.equal(save.stats.kills,11);matrix.push({stage,party:run.party,count:save.chests.length,souls:r.hardReward.souls,xp:r.xp,grades:save.chests.map(x=>x.it.g)});
 }
 await fs.writeFile('../direct-firestore-evidence-22/hard-stage-matrix.json',JSON.stringify(matrix,null,2));
});
await test('partial, failed, zero-wave and legacy-version runs do not receive repeat bonuses',async()=>{
 const matrix=[];
 for(const [n,change,version,count] of [['partial',{p_completed:5,p_win:false,p_stars:0},2,1],['failed',{p_win:false,p_stars:0},2,2],['zero',{p_completed:0,p_win:false,p_stars:0,p_kills:0},2,0],['legacy',{},1,2],['legacy-win-no-finish',{p_finish:false},2,2]]){
  const f=await fixture(n,{version});const r=await f.c.rpc('growth_progress',{...f.args,...change}),save=await effective(f.uid);assert(r.ok&&r.hardSaved);assert.equal(save.chests.length,count);assert.equal(save.stats.kills,change.p_kills===0?0:11);matrix.push({n,count,result:r.hardReward});
 }
 await fs.writeFile('../direct-firestore-evidence-22/hard-partial-matrix.json',JSON.stringify(matrix,null,2));
});
await test('lost response at each payment phase: fresh client recovers same entitlement once',async()=>{
 for(const phase of ['growth_progress','hard_settle','hard_loot','hard_finalize']){
  const f=await fixture('lost-'+phase),before=await effective(f.uid);let lost=false;
  const c=C(f.uid,()=>.7,async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&!lost){const batch=JSON.parse(o.body),w=batch.writes.find(w=>w.update?.name.endsWith('/_revision')),op=w&&decodeFields(w.update.fields).row.proof.op;if(op===phase){lost=true;throw Error('lost '+phase);}}return r;});
  await assert.rejects(c.rpc('growth_progress',f.args),/lost/);assert(lost);
  const fresh=C(f.uid,()=>0),pending=await fresh.rpc('normal_pending');assert.equal(pending.some(x=>x.token===f.token),phase!=='hard_finalize');
  const status=await fresh.rpc('normal_status',{p_token:f.token});assert.equal(status.kind,'hard');assert.equal(status.hardSaved,phase==='hard_finalize');assert.equal(status.kills,11);const r=await fresh.rpc('growth_progress',f.args);assert(r.ok&&r.hardSaved);const after=await effective(f.uid);assert.equal(after.souls,before.souls+320);assert.equal(after.chests.length,4);assert.equal(after.stats.kills,11);assert.equal(after.hardRewardSeq,(before.hardRewardSeq||0)+1);
  await fresh.rpc('growth_progress',f.args);assert.deepEqual(await effective(f.uid),after);assert.equal((await fresh.rpc('normal_pending')).length,0);
 }
});
await test('concurrent duplicate finish and finalization serialize one payment, kill count and sequence',async()=>{
 const f=await fixture('concurrent',{party:true});const rs=await Promise.all([f.c.rpc('growth_progress',f.args),C(f.uid,()=>0).rpc('growth_progress',f.args)]);assert(rs.every(x=>x.ok&&x.hardSaved));const p=await effective(f.uid);assert.equal(p.chests.length,4);assert.equal(p.souls,1320);assert.equal(p.stats.kills,11);assert.equal(p.stats.runs,1);assert.equal(p.hardRewardSeq,1);
});
await test('capacity 199 and 200 preserve old chests and exact auto-dismantle summary',async()=>{
 for(const capacity of [199,200]){const f=await fixture('cap'+capacity,{capacity}),r=await f.c.rpc('growth_progress',f.args),p=await effective(f.uid);assert.equal(p.chests.length,200);assert.deepEqual(p.chests.slice(0,capacity),f.before.chests);assert.equal(r.hardReward.chests,200-capacity);assert.equal(r.hardReward.steel,p.mat.steel-f.before.mat.steel);assert.equal(r.hardReward.crystal,p.mat.crystal-f.before.mat.crystal);assert.deepEqual(p.codex,f.before.codex);await f.c.rpc('growth_progress',f.args);assert.deepEqual(await effective(f.uid),p);}
});
await test('raw forged descriptor, collection grade, reward amount and cursor are denied',async()=>{
 const f=await fixture('forged');let captured;
 const c=C(f.uid,()=>.7,async(url,o)=>{if(url.endsWith(':commit')){const batch=JSON.parse(o.body),w=batch.writes.find(w=>w.update?.name.endsWith('/_revision'));if(w&&decodeFields(w.update.fields).row.proof.op==='hard_settle'){captured=batch;throw Error('capture unpaid entitlement');}}return fetch(url,o);});
 await assert.rejects(c.rpc('growth_progress',f.args),/capture/);assert(captured);
 const mutate=(fn)=>{const b=structuredClone(captured);const d=b.writes.find(w=>w.update?.name.includes('/hd3d_growth_investments/')).update;const v=decodeFields(d.fields);fn(v.row);d.fields=encodeFields(v);return b;};
 for(const fn of [r=>r.result.souls++,r=>r.result.specs.at(-1).g=4,r=>r.result.specs[0].c=5,r=>r.result.specs[0].h='fighter',r=>r.result.specs.push(r.result.specs[0]),r=>r.result.next=1])await assert.rejects(rest(':commit',mutate(fn),await f.c.u.getIdToken()),e=>e.status===403);
 await rest(':commit',captured,await f.c.u.getIdToken());const r=await f.c.rpc('growth_progress',f.args);assert(r.hardSaved);assert.equal((await effective(f.uid)).chests.length,4);
});
await test('too-fast and unreleased stage denied; zero wave cannot mint currency',async()=>{
 const uid=id('locked');await seed(uid);const c=C(uid);assert.equal((await c.rpc('growth_start',{p_id:'locked-hard-start',p_mode:'campaign',p_hero:'mage',p_stage:'hard-6-1'})).reason,'locked');assert.equal((await c.rpc('growth_start',{p_id:'locked-hard-other',p_mode:'campaign',p_hero:'mage',p_stage:'hard-1-1'})).reason,'locked');
 const f=await fixture('early');const d=await rest(`/hd3d_live/${f.uid}/hd3d_growth_runs/${f.uid}~${f.token}`,null,'owner','GET');const v=decodeFields(d.fields),at=new Date().toISOString();v.row.started_at=at;d.fields=encodeFields(v);d.fields.issuedAt={timestampValue:at};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});assert.equal((await f.c.rpc('growth_progress',f.args)).reason,'too_fast');assert.equal((await effective(f.uid)).souls,1000);
});
await fs.writeFile('../direct-firestore-evidence-22/hard-rewards-results.json',JSON.stringify({rows,passed:rows.filter(x=>x.pass).length,total:rows.length},null,2));
if(rows.some(x=>!x.pass))process.exitCode=1;
