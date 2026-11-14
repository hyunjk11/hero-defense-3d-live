import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,raw,root,config} from './emulator-harness.mjs';
import {stageCatalog,itemCatalog,bootstrapTemplate} from './catalog.mjs';
import {directDocument,DEMO_PROJECT,createDirectTransport,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {STAGES,stageReward} from '../src/data/stages.js';
import * as E from '../src/account/equip.js';
import {clean as cleanSave} from '../src/account/progress.js';
await rest(':commit',{writes:[...stageCatalog(),...itemCatalog(),bootstrapTemplate()].map(update=>({update}))});
const actualFetch=globalThis.fetch;let rejected=0;globalThis.fetch=async(url,o)=>{const res=await actualFetch(url,o);if(String(url).endsWith(':commit')&&!res.ok){await fs.writeFile(new URL('../../direct-fresh-live-evidence-2/emulator/normal-rejected-'+(++rejected)+'.json',import.meta.url),JSON.stringify({writes:JSON.parse(o.body).writes.map(w=>({...w,update:{...w.update,fields:decodeFields(w.update.fields)}})),error:await res.clone().json()},null,2));}return res;};
const suffix=Date.now().toString(36),id=n=>'phase7-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
async function fixture(uid,stage='1-1',mutate=()=>{}){const f=await seed(uid);mutate(f.save);const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:f.save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});return f.save;}
async function finish(uid,token,stage='1-1',win=true,wave=STAGES[stage].waves,target=null){const c=client(uid);const r=await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_stage:stage,p_hero:'mage',p_target:target});assert.equal(r.ok,true,JSON.stringify(r));
 const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');doc.fields.issuedAt={timestampValue:new Date(Date.now()-300000).toISOString()};delete doc.createTime;delete doc.updateTime;await rest(':commit',{writes:[{update:doc}]});c.setNow(Date.now()+300000);
 const done=await c.rpc('growth_progress',{p_token:token,p_completed:wave,p_win:win,p_finish:true});assert.equal(done.ok,true,JSON.stringify(done));return c;}
const input=(token,wave=STAGES['1-1'].waves,kills=50,stars=3,drops=[])=>({p_token:token,p_wave:wave,p_kills:kills,p_stars:stars,p_drops:drops});
async function drain(c,token,r){while(r.next<r.total)r=await c.rpc('normal_loot',{p_token:token,p_index:r.next});return r;}
await test('normal first full clear keeps souls, progress, quest, chests, open/codex and once-only receipts',async()=>{
 const uid=id('clear'),token='first-full-clear';const before=await fixture(uid);const c=await finish(uid,token),a=input(token),r=await c.rpc('normal_settle',a);
 assert.equal(r.first,true);assert.equal(r.souls,a.p_wave*8+Math.floor(a.p_kills/3)+stageReward('1-1',true));assert.equal(r.total,Math.floor(a.p_wave/5)+1);
 const end=await drain(c,token,r),save=await effective(uid);assert.equal(save.souls,before.souls+r.souls);assert.equal(save.st['1-1'],3);assert.equal(save.hq.mage.clr,1);assert.equal(save.chests.length,r.total);assert.equal(save.stats.kills,50);
 assert.equal((await c.rpc('normal_settle',a)).already,true);assert.deepEqual(await effective(uid),save);assert.equal((await c.rpc('normal_loot',{p_token:token,p_index:0})).already,true);
 const uiSave=cleanSave(save);assert.deepEqual(uiSave.chests.map(c=>[c.id,c.it.id]),save.chests.map(c=>[c.id,c.it.id]));
 const ch=uiSave.chests[0],opened=await c.rpc('gear_action',{p_id:'normal-open-one',p_action:'open',p_item:ch.id});assert.equal(opened.ok,true);const after=await effective(uid);assert.equal(after.inv[0].id,ch.it.id);assert.ok(after.codex['1']);assert.deepEqual(await c.rpc('normal_pending'),[]);
 await fs.writeFile(new URL('../../direct-fresh-live-evidence-2/emulator/normal-clear.json',import.meta.url),JSON.stringify({before,result:end,after},null,2));
});
await test('star catchup, repeat target hero, exact old unopened chest and unknown save fields preserved',async()=>{
 const uid=id('repeat'),token='normal-repeat-target',legacy=E.chestOf(E.makeItem('armor',null,1,()=>.3,1),'boss');legacy.unknown='legacy';
 const before=await fixture(uid,'1-1',s=>{s.st=Object.fromEntries(Object.keys(STAGES).map(k=>[k,3]));s.chests=[legacy];s.unknown={nested:[1,2]};});
 const c=await finish(uid,token,'1-1',true,STAGES['1-1'].waves,'gunner');const r=await c.rpc('normal_settle',input(token));assert.equal(r.first,false);assert.equal(r.starTo,36);assert.equal(r.total,36+Math.floor(STAGES['1-1'].waves/5));
 const end=await drain(c,token,r),s=await effective(uid);assert.equal(s.chests.length,before.chests.length+r.total);assert.equal(s.chests[1].it.s,'weapon');assert.equal(s.chests[1].it.h,'gunner');assert.deepEqual(s.chests[0],legacy);assert.deepEqual(s.unknown,before.unknown);assert.equal(s.starRw,36);assert.equal(end.next,end.total);
});
await test('drop-bearing partial return and capacity199/200 preserve stored versus dismantled outcomes',async()=>{
 for(const count of [199,200]){const uid=id('cap'+count),token='normal-capacity-'+count;const drop=E.makeItem('armor',null,3,()=>.3,1);drop.id='normal-drop-'+count;
  const before=await fixture(uid,'1-1',s=>{s.chests=Array.from({length:count},(_,n)=>{const it=E.makeItem('armor',null,1,()=>.3,1);it.id='old-'+n;return E.chestOf(it,'chest');});});
  const c=await finish(uid,token,'1-1',false,5),r=await c.rpc('normal_settle',input(token,5,50,0,[drop])),end=await drain(c,token,r),s=await effective(uid);
  assert.equal(s.chests.length,200);assert.equal(end.loot.filter(x=>x.auto).length,count===199?1:2);assert.deepEqual(s.chests.slice(0,count),before.chests);assert.deepEqual(s.codex,before.codex);assert.ok(s.mat.steel>before.mat.steel);assert.equal(s.st['1-1']||0,0);
 }
});
await test('lost response, simultaneous cursor retry and local journal loss recover once from account pending receipt',async()=>{
 const uid=id('loss'),token='normal-lost-response';await fixture(uid);const c=await finish(uid,token),a=input(token);let hits=0;
 const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{const res=await fetch(url,o);if(url.endsWith(':commit')&&res.ok){hits++;throw Error('lost response');}return res;}});
 await assert.rejects(t({kind:'rpc',name:'hd3d_normal_settle',args:a},u),/lost response/);assert.equal(hits,1);const settled=await effective(uid);let [r]=await c.rpc('normal_pending');assert.equal(r.token,token);
 await assert.rejects(t({kind:'rpc',name:'hd3d_normal_loot',args:{p_token:token,p_index:0}},u),/lost response/);
 const rr=await Promise.all([c.rpc('normal_loot',{p_token:token,p_index:0}),client(uid).rpc('normal_loot',{p_token:token,p_index:0})]);assert.ok(rr.every(x=>x.already));
 [r]=await client(uid).rpc('normal_pending');await drain(client(uid),token,r);assert.equal((await effective(uid)).souls,settled.souls);assert.equal((await effective(uid)).stats.runs,1);assert.deepEqual(await c.rpc('normal_pending'),[]);
});
await test('old return and full normal settlement cannot both credit one run',async()=>{
 for(const oldFirst of [true,false]){const uid=id('cross'+oldFirst),token='normal-cross-'+oldFirst;await fixture(uid);const c=await finish(uid,token,'1-1',false,1),a=input(token,1,11,0);const legacy={p_id:'run-'+token,p_action:'run_return',p_item:token,p_wave:1,p_kills:11};
  if(oldFirst){await c.rpc('gear_action',legacy);await assert.rejects(c.rpc('normal_settle',a),/already settled/);}else{await c.rpc('normal_settle',a);await assert.rejects(c.rpc('gear_action',legacy),/already settled/);}
  assert.equal((await effective(uid)).stats.runs,1);
 }
});
await test('DF6-01 zero-wave million-kill and first-wave impossible report rejected by API and Rules',async()=>{
 const uid=id('kills'),token='zero-wave-fraud';await fixture(uid);const c=await finish(uid,token,'1-1',false,0),before=await effective(uid);
 for(const k of [1,1000000]){await assert.rejects(c.rpc('normal_settle',input(token,0,k,0)));await assert.rejects(c.rpc('gear_action',{p_id:'run-'+token,p_action:'run_return',p_item:token,p_wave:0,p_kills:k}));}
 const u=user(uid),forged=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body);for(const w of b.writes){const x=decodeFields(w.update.fields);if(x.row.proof)x.row.proof.kills=1000000;if(x.row.result){x.row.result.kills=1000000;x.row.result.souls=333333;}if(x.row.authority){x.row.authority.souls+=333333;x.row.authority.gear.stats.kills+=1000000;x.row.authority.gear.stats.souls+=333333;}w.update.fields=encodeFields(x);}o={...o,body:JSON.stringify(b)};}return fetch(url,o);}});
 await assert.rejects(forged({kind:'rpc',name:'hd3d_normal_settle',args:input(token,0,0,0)},u),e=>e.code==='PERMISSION_DENIED');
 await assert.rejects(c.rpc('normal_settle',input(token,1,1000000,0)),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(uid),before);
});
await test('DF6-02 crafted item ID cannot collide with unopened chest ID via raw commit',async()=>{
 const uid=id('collision');await fixture(uid,'1-1',s=>{const it=E.makeItem('armor',null,1,()=>.3,1);it.id='reserved-chest-item';s.chests=[E.chestOf(it,'boss')];s.mat={steel:500,crystal:500};});const before=await effective(uid),u=user(uid);
 const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body);for(const w of b.writes){const env=decodeFields(w.update.fields);if(w.update.name.includes('/hd3d_progress/')){env.row.authority.gear.inv.at(-1).id='reserved-chest-item';env.row.authority.gear.bagIds[env.row.authority.gear.bagIds.length-1]='reserved-chest-item';}if(w.update.name.includes('/hd3d_growth_investments/'))env.row.result.it.id='reserved-chest-item';w.update.fields=encodeFields(env);}o={...o,body:JSON.stringify(b)};}return fetch(url,o);}});
 await assert.rejects(t({kind:'rpc',name:'hd3d_gear_action',args:{p_id:'collision-craft',p_action:'craft',p_ch:0,p_slot:'armor',p_hero:'mage',p_recipe:'basic'}},u),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(uid),before);
 assert.equal((await client(uid).rpc('gear_action',{p_id:'collision-open',p_action:'open',p_item:before.chests[0].id})).ok,true);
});
await test('raw normal settlement cannot inflate currency/progress, detach receipt or rewrite awarded cursor',async()=>{
 const uid=id('raw-normal'),token='raw-normal-settle';await fixture(uid);const c=await finish(uid,token),u=user(uid),before=await effective(uid);
 const mutateClient=mutate=>createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body);const envs=b.writes.map(w=>decodeFields(w.update.fields));mutate(envs,b.writes);b.writes.forEach((w,i)=>w.update.fields=encodeFields(envs[i]));o={...o,body:JSON.stringify(b)};}return fetch(url,o);}});
 for(const mutate of [a=>a.find(x=>x.row.authority).row.authority.souls++,a=>a.find(x=>x.row.authority).row.authority.st['1-2']=3,a=>a.find(x=>x.row.authority).row.authority.starsTotal++,a=>a.find(x=>x.row.result).row.result.total++,a=>a.find(x=>x.row.result).row.result.first=false]){
  await assert.rejects(mutateClient(mutate)({kind:'rpc',name:'hd3d_normal_settle',args:input(token)},u),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(uid),before);
 }
 const r=await c.rpc('normal_settle',input(token));
 for(const mutate of [a=>a.find(x=>x.row.result).row.result.next++,a=>a.find(x=>x.row.result).row.result.last.it.spec.m[1]=999,a=>a.find(x=>x.row.authority).row.authority.mat.steel++,a=>a.find(x=>x.row.result).row.result.total++])await assert.rejects(mutateClient(mutate)({kind:'rpc',name:'hd3d_normal_loot',args:{p_token:token,p_index:0}},u),e=>e.code==='PERMISSION_DENIED');
 await drain(c,token,r);assert.deepEqual(await c.rpc('normal_pending'),[]);
});
await test('normal high chapters preserve grade floor, first/repeat rewards and strong item shapes under Rules',async()=>{
 for(const stage of ['3-1','10-6'])for(const repeat of [false,true]){
  const uid=id(stage+'-'+repeat),token='matrix-'+stage+'-'+repeat;await fixture(uid,stage,s=>{s.st=Object.fromEntries(Object.keys(STAGES).map(k=>[k,3]));if(!repeat)delete s.st[stage];s.starRw=Math.floor(Object.values(s.st).reduce((a,b)=>a+b,0)/5);});
  const c=await finish(uid,token,stage),a=input(token,STAGES[stage].waves,100,3),r=await c.rpc('normal_settle',a),end=await drain(c,token,r);
  assert.equal(r.first,!repeat);assert.equal(r.souls,a.p_wave*8+Math.floor(a.p_kills/3)+stageReward(stage,!repeat));assert.ok(end.loot.every(x=>x.it.g>=1));assert.equal((await effective(uid)).hq.mage.boss,STAGES[stage].boss?1:0);
 }
});
await test('legacy missing progression fields initialize only on the earned normal settlement',async()=>{
 const uid=id('legacy-fields'),token='normal-legacy-fields';const before=await fixture(uid,'1-1',s=>{for(const k of ['st','hq','starRw','stats','chests'])delete s[k];s.oldOnly={keep:true};});
 assert.deepEqual(await effective(uid),before);
 const c=await finish(uid,token),r=await c.rpc('normal_settle',input(token));await drain(c,token,r);const s=await effective(uid);
 assert.equal(s.st['1-1'],3);assert.equal(s.hq.mage.clr,1);assert.equal(s.stats.kills,50);assert.equal(s.chests.length,r.total);assert.deepEqual(s.oldOnly,{keep:true});
});
await test('LIMITATION: elapsed and bounded values are accepted without attesting actual combat or fair draw',async()=>{
 const uid=id('trust-limit'),token='normal-trust-boundary';await fixture(uid);await finish(uid,token);
 const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},random:()=>.999999});
 const rpc=async(name,args)=>{const r=await t({kind:'rpc',name:'hd3d_'+name,args},u);if(r.error)throw r.error;return r.data;};
 let r=await rpc('normal_settle',input(token));while(r.next<r.total)r=await rpc('normal_loot',{p_token:token,p_index:r.next});
 assert.ok(r.loot.every(x=>x.it.g===4));
 await fs.writeFile(new URL('../../direct-fresh-live-evidence-2/emulator/combat-rng-boundary.json',import.meta.url),JSON.stringify({scope:'synthetic emulator run with time-aged fixture, no gameplay; NOT proof of security',result:'ACCEPTED bounded report and chosen valid high-grade client draw',souls:r.souls,grades:r.loot.map(x=>x.it.g),limitation:'Rules enforce allowed values and once-only ledger, not combat authenticity or private randomness. Original v34 ordinary save/draw was client-trusted.'},null,2));
});
await fs.writeFile(new URL('../../direct-fresh-live-evidence-2/emulator/normal-results.json',import.meta.url),JSON.stringify({scope:'local real Rules, synthetic account and explicit time-aged run fixtures; not real gameplay',tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(r=>r.pass).length}));process.exitCode=rows.some(r=>!r.pass)?1:0;
