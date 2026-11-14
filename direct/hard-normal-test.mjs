import {assert,fs,test,rows,user,rest,seed,get,config,root} from './emulator-harness.mjs';
import {createDirectTransport,decodeFields,encodeFields,directDocument,packRow} from '../src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {HARD_STAGES,hardReward} from '../src/data/hard.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const suffix='boundary'+Date.now().toString(36),id=n=>'hard14-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
const C=(uid,random=()=>.7,fetcher=async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&!r.ok){await fs.writeFile('../direct-fresh-live-evidence-2/emulator/hard-failed-commit.json',o.body);}return r;})=>{const u=user(uid),auth={currentUser:u},t=createDirectTransport(config,{auth,random,fetcher});return {u,auth,rpc:(name,args={})=>t({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data)};};
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

import {createDirectTransport as legacyTransport} from './fixtures/phase20-direct-store.mjs';
import {authorityOf} from '../src/account/direct-authority.js';
async function replaceSave(uid,save){const p=await get(uid,'progress');p.authority=authorityOf(save);await rest(':commit',{writes:[{update:{name:root+'/hd3d_live/'+uid+'/hd3d_progress/'+uid,fields:encodeFields({owner:uid,version:1,row:p})}}]});}
await test('legacy pending mail remains recoverable at every phase with new client; no conversion or duplicate',async()=>{
 for(const phase of ['growth_progress','hard_mail','mail_item','claim_mail','hard_finalize']){
  const f=await fixture('legacy-recover-'+phase);let lost=false;
  const u=user(f.uid),t=legacyTransport(config,{auth:{currentUser:u},random:()=>.7,fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&!lost){const w=JSON.parse(o.body).writes.find(w=>w.update?.name.endsWith('/_revision'));if(w&&decodeFields(w.update.fields).row.proof.op===phase){lost=true;throw Error('legacy acknowledgement lost');}}return r;}});
  await assert.rejects(t({kind:'rpc',name:'hd3d_growth_progress',args:f.args},u),/lost/);assert(lost);
  const before=await get(f.uid,'growth_runs',f.uid+'~'+f.token);assert(Number.isSafeInteger(before.directReward.mail));
  const r=await f.c.rpc('growth_progress',f.args);assert(r.hardSaved);const after=await effective(f.uid);
  assert.equal(after.souls,1320);assert.equal(after.chests.length,4);assert.equal(after.stats.kills,11);assert.equal(after.hardRewardSeq,1);
  assert.deepEqual((await get(f.uid,'growth_runs',f.uid+'~'+f.token)).directReward,before.directReward);
  await assert.rejects(f.c.rpc('hard_settle',{p_token:f.token}),/normal-style/);
  await f.c.rpc('growth_progress',f.args);assert.deepEqual(await effective(f.uid),after);
 }
});
await test('account changes after settlement commit halt old continuation; reconnect resumes exact owned cursor',async()=>{
 const f=await fixture('account-switch'),other=await fixture('account-other');let switched=false;
 const u=user(f.uid),auth={currentUser:u};const t=createDirectTransport(config,{auth,random:()=>.7,fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&!switched){const w=JSON.parse(o.body).writes.find(w=>w.update?.name.endsWith('/_revision'));if(w&&decodeFields(w.update.fields).row.proof.op==='hard_settle'){switched=true;auth.currentUser=user(other.uid);}}return r;}});
 await assert.rejects(t({kind:'rpc',name:'hd3d_growth_progress',args:f.args},u),e=>e.code==='ACCOUNT_CHANGED');assert(switched);
 assert.deepEqual(await effective(other.uid),other.before);assert.equal((await effective(f.uid)).souls,1320);assert.equal((await effective(f.uid)).chests.length,0);
 const r=await C(f.uid,()=>0).rpc('growth_progress',f.args);assert(r.hardSaved);const a=await effective(f.uid);assert.equal(a.chests.length,4);assert.equal(a.souls,1320);assert.equal(a.hardRewardSeq,1);
});
await test('currency and material ceiling reject before any new assets; lowering fixture cap then resumes once',async()=>{
 for(const kind of ['souls','steel','crystal']){
  const f=await fixture('limit-'+kind,{capacity:200}),save=structuredClone(f.before);if(kind==='souls')save.souls=1e9;else save.mat[kind]=1e9;
  await replaceSave(f.uid,save);const deferred=await f.c.rpc('growth_progress',f.args);assert.equal(deferred.reason,'capacity');assert.equal(deferred.deferred,true);assert.equal(deferred.hardSaved,false);assert.deepEqual(await effective(f.uid),save);
  const still=await f.c.rpc('normal_pending');assert(still.some(r=>r.token===f.token));
  // Synthetic fixture mutation models room made by a separately committed spend.
  await replaceSave(f.uid,f.before);const r=await f.c.rpc('growth_progress',f.args);assert(r.hardSaved);assert.equal((await effective(f.uid)).souls,1320);assert.equal((await effective(f.uid)).hardRewardSeq,1);
 }
});
await test('cursor gap, cross-account token and second legacy-mail path rejected without changes',async()=>{
 const f=await fixture('cursor');let stopped=false;
 const c=C(f.uid,()=>.7,async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&!stopped){const w=JSON.parse(o.body).writes.find(w=>w.update?.name.endsWith('/_revision'));if(w&&decodeFields(w.update.fields).row.proof.op==='hard_settle'){stopped=true;throw Error('stop after entitlement');}}return r;});
 await assert.rejects(c.rpc('growth_progress',f.args),/stop/);const before=await effective(f.uid);
 await assert.rejects(f.c.rpc('hard_loot',{p_token:f.token,p_index:1}),/cursor/);
 await assert.rejects(f.c.rpc('hard_mail',{p_token:f.token}),/no mail/);
 const other=await fixture('cursor-other');await assert.rejects(other.c.rpc('hard_loot',{p_token:f.token,p_index:0}),/hard run/);
 assert.deepEqual(await effective(f.uid),before);assert.deepEqual(await effective(other.uid),other.before);
 const one=await f.c.rpc('hard_loot',{p_token:f.token,p_index:0});const afterOne=await effective(f.uid);const again=await f.c.rpc('hard_loot',{p_token:f.token,p_index:0});assert.equal(again.next,1);assert.deepEqual(await effective(f.uid),afterOne);
 const r=await f.c.rpc('growth_progress',f.args);assert(r.hardSaved);assert.equal((await effective(f.uid)).chests.length,4);
});

await test('new-style finalization cannot attach the old mail telemetry payment for a second credit',async()=>{
 const f=await fixture('double-stats');let captured;
 const c=C(f.uid,()=>.7,async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body),w=b.writes.find(w=>w.update?.name.endsWith('/_revision'));if(w&&decodeFields(w.update.fields).row.proof.op==='hard_finalize'){captured=b;throw Error('capture final');}}return fetch(url,o);});
 await assert.rejects(c.rpc('growth_progress',f.args),/capture/);assert(captured);
 const before=await effective(f.uid),p=await get(f.uid,'progress'),forged=structuredClone(before);forged.stats.runs++;forged.stats.kills+=11;forged.stats.waves+=10;forged.stats.souls+=320;forged.hardRewardSeq++;
 const revision=decodeFields(captured.writes.find(w=>w.update?.name.endsWith('/_revision')).update.fields).row.value;
 const bad=structuredClone(captured);const row=packRow('hd3d_progress',{user_id:f.uid,data:forged,merged:p.merged,created_at:p.created_at,updated_at:new Date(Math.max(Date.now(),Date.parse(p.updated_at)+1)).toISOString()});
 bad.writes.push({update:{name:root+'/hd3d_live/'+f.uid+'/hd3d_progress/'+f.uid,fields:encodeFields({owner:f.uid,version:1,row,commitRevision:revision})}});
 await assert.rejects(rest(':commit',bad,await f.c.u.getIdToken()),e=>e.status===403);assert.deepEqual(await effective(f.uid),before);
 const r=await f.c.rpc('growth_progress',f.args);assert(r.hardSaved);assert.deepEqual(await effective(f.uid),before);
});
await fs.writeFile('../direct-fresh-live-evidence-2/emulator/hard-normal-boundaries.json',JSON.stringify({rows,passed:rows.filter(x=>x.pass).length,total:rows.length},null,2));
if(rows.some(x=>!x.pass))process.exitCode=1;
