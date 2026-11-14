import {assert,fs,test,rows,user,rest,seed,client,get,config} from './emulator-harness.mjs';
import {itemCatalog,stageCatalog,bootstrapTemplate} from './catalog.mjs';
import {createDirectTransport,DEMO_PROJECT,directDocument,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import * as E from '../src/account/equip.js';
import {applyRun} from '../src/account/progress.js';
await rest(':commit',{writes:[...itemCatalog(),...stageCatalog(),bootstrapTemplate()].map(update=>({update}))});
const suffix=Date.now().toString(36),id=x=>'challenge16-'+x+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
const args=(token,wave,kills=30,drops=[])=>({p_token:token,p_wave:wave,p_kills:kills,p_stars:0,p_drops:drops,p_bossKills:Array.from({length:Math.floor(wave/5)},(_,i)=>(i+1)*5)});
async function fixture(uid,mutate=()=>{}){const f=await seed(uid);mutate(f.save);const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:f.save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});return f.save;}
async function finish(uid,token,wave){const c=client(uid);assert.equal((await c.rpc('growth_start',{p_id:token,p_mode:'challenge',p_hero:'mage'})).ok,true);
 const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');doc.fields.issuedAt={timestampValue:new Date(Date.now()-Math.max(300000,wave*2000+10000)).toISOString()};delete doc.createTime;delete doc.updateTime;await rest(':commit',{writes:[{update:doc}]});c.setNow(Date.now()+Math.max(300000,wave*2000+10000));
 assert.equal((await c.rpc('growth_progress',{p_token:token,p_completed:Math.min(wave,9999),p_win:false,p_finish:true})).ok,true);return c;}
const drain=async(c,token,z)=>{while(z.next<z.total)z=await c.rpc('challenge_loot',{p_token:token,p_index:z.next});return z;};
const drawn=(uid,random,metrics)=>{const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},random,...(metrics?{fetcher:async(url,o)=>{metrics.requests++;const res=await fetch(url,o);if(url.endsWith(':commit')&&res.ok){metrics.commits++;metrics.documentWrites+=JSON.parse(o.body).writes.length;}return res;}}:{})});return {rpc:async(name,args={})=>{const r=await t({kind:'rpc',name:'hd3d_'+name,args},u);if(r.error)throw r.error;return r.data;}};};
await test('zero-wave and partial challenge return preserve stats, best and exactly-once currency',async()=>{
 for(const wave of [0,1]){const uid=id('partial'+wave),token='challenge-partial-'+wave,before=await fixture(uid),c=await finish(uid,token,wave),a=args(token,wave,wave?11:0),z=await c.rpc('challenge_settle',a),after=await effective(uid);
  assert.equal(z.total,0);assert.equal(after.souls,before.souls+wave*8+Math.floor(a.p_kills/3));assert.equal(after.bestWave,wave);assert.equal(after.stats.runs,1);assert.equal(after.stats.kills,a.p_kills);assert.equal((await c.rpc('challenge_settle',a)).already,true);assert.deepEqual(await effective(uid),after);assert.deepEqual(await c.rpc('normal_pending'),[]);
 }
});
await test('open chapters, four base boxes, actual boss drop and essence keep original formulas; open/codex/reconnect',async()=>{
 const uid=id('full'),token='challenge-twenty',before=await fixture(uid,s=>{s.st['1-6']=3;s.legacyKeep={a:1};}),drop=E.makeItem('armor',null,2,()=>.4,2);drop.id='challenge-boss';
 await finish(uid,token,20);const c=drawn(uid,()=>0),a=args(token,20,200,[drop]),z=await c.rpc('challenge_settle',a),end=await drain(c,token,z),after=await effective(uid),[expected]=applyRun(before,{wave:20,kills:200,hero:'mage',stage:false,ch:'open',drops:[drop],bossKills:a.p_bossKills},()=>0);
 assert.equal(after.souls,expected.souls);assert.deepEqual(after.stats,expected.stats);assert.equal(after.bestWave,20);assert.equal(after.mat.essence,1);assert.equal(after.chests.length,5);assert.equal(after.chests.at(-1).it.id,drop.id);assert.deepEqual(after.legacyKeep,before.legacyKeep);assert.equal(end.loot.filter(x=>x.chest).length,5);assert.deepEqual(end.loot.at(-1),{src:'essence',essence:1});
 const reopened=await client(uid).rpc('normal_status',{p_token:token});assert.equal(reopened.stored,5);assert.deepEqual(await effective(uid),after);assert.equal((await client(uid).rpc('gear_action',{p_id:'challenge-open-one',p_action:'open',p_item:after.chests.at(-1).id})).ok,true);assert.ok((await effective(uid)).codex['2']);
 await fs.writeFile('../direct-firestore-evidence-22/challenge-parity.json',JSON.stringify({before,result:end,after,scope:'time-aged synthetic emulator run; not actual combat'},null,2));
});
await test('eleven drops at wave55 are preserved, exceeding former normal 4/10 drop limits',async()=>{
 const uid=id('eleven'),token='challenge-eleven-drops';await fixture(uid);const drops=Array.from({length:11},(_,i)=>{const it=E.makeItem('armor',null,1,()=>.4,1);it.id='challenge-d'+i;return it;});await finish(uid,token,55);const metrics={scope:'settlement only; no start/checkpoint/open/reload or retries; HTTP counts are not billed read counts',requests:0,commits:0,documentWrites:0},c=drawn(uid,()=>.4,metrics),z=await c.rpc('challenge_settle',args(token,55,500,drops)),end=await drain(c,token,z),s=await effective(uid);
 assert.equal(end.total,22);assert.equal(end.next,22);assert.equal(s.chests.length,22);assert.deepEqual(s.chests.slice(11).map(x=>x.it.id),drops.map(x=>x.id));assert.deepEqual(await client(uid).rpc('normal_pending'),[]);await fs.writeFile('../direct-firestore-evidence-22/challenge-request-cost.json',JSON.stringify({wave:55,bossDrops:11,baseBoxes:11,...metrics},null,2));
});
await test('199/200 capacity reports stored versus dismantled; legacy unopened identity is unchanged',async()=>{
 for(const count of [199,200]){const uid=id('cap'+count),token='challenge-capacity-'+count,before=await fixture(uid,s=>{s.chests=Array.from({length:count},(_,i)=>{const it=E.makeItem('armor',null,1,()=>.4,1);it.id='old-'+i;return E.chestOf(it,'boss');});s.bestWave=100;});const c=await finish(uid,token,10),z=await c.rpc('challenge_settle',args(token,10)),end=await drain(c,token,z),s=await effective(uid);
  assert.equal(s.chests.length,200);assert.equal(end.stored,count===199?1:0);assert.equal(end.dismantled,count===199?1:2);assert.deepEqual(s.chests.slice(0,count),before.chests);assert.deepEqual(s.codex,before.codex);assert.equal(s.bestWave,100);assert.equal(end.best,false);assert(s.mat.steel>before.mat.steel);
 }
});
await test('response loss on preflight, settlement and loot; concurrent replay and journal-free pending recover once',async()=>{
 for(const action of ['challenge_drop','challenge_settle','challenge_loot']){const uid=id('loss-'+action),token='loss-'+action.replaceAll('_','-');await fixture(uid);await finish(uid,token,5);const drop=E.makeItem('armor',null,1,()=>.4,1);drop.id='loss-drop';const a=args(token,5,50,[drop]);let lost=0;
  const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{const res=await fetch(url,o);if(res.ok&&url.endsWith(':commit')&&!lost&&JSON.parse(o.body).writes.some(w=>{const row=decodeFields(w.update.fields).row;return row.action===action||row.result?.action===action;})){lost++;throw Error('lost response');}return res;}});
  const rpc=(name,args)=>t({kind:'rpc',name:'hd3d_'+name,args},u);if(action==='challenge_loot')await client(uid).rpc('challenge_settle',a);
  await assert.rejects(rpc(action==='challenge_loot'?'challenge_loot':'challenge_settle',action==='challenge_loot'?{p_token:token,p_index:0}:a),/lost response/);assert.equal(lost,1);
  const settled=await client(uid).rpc('challenge_settle',a);await Promise.all([client(uid).rpc('challenge_loot',{p_token:token,p_index:0}),client(uid).rpc('challenge_loot',{p_token:token,p_index:0})]);
  const [pending]=await client(uid).rpc('normal_pending');const end=await drain(client(uid),token,pending||await client(uid).rpc('normal_status',{p_token:token})),s=await effective(uid);assert.equal(s.stats.runs,1);assert.equal(s.chests.length,2);assert.equal(end.next,2);assert.equal(s.souls,1000+settled.souls);assert.deepEqual(await client(uid).rpc('normal_pending'),[]);
 }
});
await test('bad later drop, duplicate identity, boss sequence and zero-wave million kills grant nothing',async()=>{
 const uid=id('bad'),token='challenge-invalid';const before=await fixture(uid);const c=await finish(uid,token,20),valid=E.makeItem('armor',null,1,()=>.4,1),wrong=E.makeItem('armor',null,1,()=>.4,2);valid.id='valid-item';wrong.id='wrong-item';
 for(const a of [args(token,20,10,[valid,wrong]),args(token,20,10,[valid,valid]),{...args(token,20),p_bossKills:[5,5,10]},args(token,0,1000000)])await assert.rejects(c.rpc('challenge_settle',a));assert.deepEqual(await effective(uid),before);
 const receipts=await rest(`/hd3d_live/${uid}/hd3d_growth_investments`,null,'owner','GET');assert.equal((receipts.documents||[]).filter(x=>x.name.includes('~challenge')).length,0);
});
await test('raw commits cannot inflate souls/best/essence, unlock chapters, skip cursor or alter granted item',async()=>{
 const uid=id('forged'),token='challenge-forged';await fixture(uid);await finish(uid,token,5);const u=user(uid),before=await effective(uid);
 const changed=mutate=>createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body),env=b.writes.map(w=>decodeFields(w.update.fields));mutate(env,b);b.writes.forEach((w,i)=>{if(w.update)w.update.fields=encodeFields(env[i]);});o={...o,body:JSON.stringify(b)};}return fetch(url,o);}});
 for(const mutate of [a=>a.find(x=>x.row.authority).row.authority.souls++,a=>a.find(x=>x.row.authority).row.authority.bestWave=9999,a=>a.find(x=>x.row.result?.kind==='challenge').row.result.essence=1,a=>a.find(x=>x.row.result?.kind==='challenge').row.result.unlock['9-6']=3,a=>a.find(x=>x.row.result?.kind==='challenge').row.result.total++]){
  await assert.rejects(changed(mutate)({kind:'rpc',name:'hd3d_challenge_settle',args:args(token,5)},u),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(uid),before);
 }
 await client(uid).rpc('challenge_settle',args(token,5));
 for(const mutate of [a=>a.find(x=>x.row.result?.kind==='challenge').row.result.next++,a=>a.find(x=>x.row.result?.action==='challenge_loot').row.result.it.spec.m[1]=999,a=>a.find(x=>x.row.authority).row.authority.mat.steel++])await assert.rejects(changed(mutate)({kind:'rpc',name:'hd3d_challenge_loot',args:{p_token:token,p_index:0}},u),e=>e.code==='PERMISSION_DENIED');
 await drain(client(uid),token,await client(uid).rpc('normal_status',{p_token:token}));
});
await test('escaped bosses do not block return or fabricate essence; early waves cannot claim a million kills',async()=>{
 const uid=id('escaped'),token='challenge-escaped';await fixture(uid);await finish(uid,token,20);const a={...args(token,20),p_bossKills:[10,20]},z=await drawn(uid,()=>0).rpc('challenge_settle',a);assert.equal(z.bosses,2);assert.equal(z.trials,1);assert.equal(z.essence,1);await drain(client(uid),token,z);
 const low=id('million'),lowToken='challenge-million';const before=await fixture(low),c=await finish(low,lowToken,1);await assert.rejects(c.rpc('challenge_settle',args(lowToken,1,1000000)),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(low),before);
});
await test('raw drop preflights require shape, original item context, revision and linked order',async()=>{
 const edits=[(env)=>env.find(x=>x.row.result?.action==='challenge_drop').row.result.index=1,
  env=>env.find(x=>x.row.result?.action==='challenge_drop').row.body='0'.repeat(64),
  env=>env.find(x=>x.row.result?.action==='challenge_drop').row.result.drop.c=9,
  env=>env.find(x=>x.row.result?.action==='challenge_drop').row.result.drop.spec.m[1]=999,
  (env,b)=>b.writes=b.writes.filter(w=>!w.update.name.endsWith('/_revision'))];
 for(const [i,edit] of edits.entries()){
  const uid=id('chain-forged-'+i),token='challenge-chain-'+i,before=await fixture(uid);await finish(uid,token,5);const u=user(uid),drop=E.makeItem('armor',null,1,()=>.4,1);drop.id='chain-item';
  const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body),env=b.writes.map(w=>decodeFields(w.update.fields));if(env.some(x=>x.row.result?.action==='challenge_drop')){edit(env,b);for(const w of b.writes){const original=JSON.parse(o.body).writes.findIndex(x=>x.update.name===w.update.name);w.update.fields=encodeFields(env[original]);}o={...o,body:JSON.stringify(b)};}}return fetch(url,o);}});
  await assert.rejects(t({kind:'rpc',name:'hd3d_challenge_settle',args:args(token,5,10,[drop])},u),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(uid),before);
  const good=await client(uid).rpc('challenge_settle',args(token,5,10,[drop]));await drain(client(uid),token,good);
 }
});
await test('settlement cannot detach its chain or omit atomic progress/revision writes',async()=>{
 const edits=[env=>env.find(x=>x.row.result?.kind==='challenge').row.result.dropNext='missing-item',
  env=>env.find(x=>x.row.result?.kind==='challenge').row.result.lastDrop='missing-item',
  (env,b)=>b.writes=b.writes.filter(w=>!w.update.name.includes('/hd3d_progress/')),
  (env,b)=>b.writes=b.writes.filter(w=>!w.update.name.endsWith('/_revision'))];
 for(const [i,edit] of edits.entries()){
  const uid=id('atomic-forged-'+i),token='challenge-atomic-'+i,before=await fixture(uid);await finish(uid,token,5);const u=user(uid),drop=E.makeItem('armor',null,1,()=>.4,1);drop.id='atomic-item';
  const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const b=JSON.parse(o.body),env=b.writes.map(w=>decodeFields(w.update.fields));if(env.some(x=>x.row.action==='challenge_settle')){edit(env,b);for(const w of b.writes){const original=JSON.parse(o.body).writes.findIndex(x=>x.update.name===w.update.name);w.update.fields=encodeFields(env[original]);}o={...o,body:JSON.stringify(b)};}}return fetch(url,o);}});
  const a=args(token,5,10,[drop]);await assert.rejects(t({kind:'rpc',name:'hd3d_challenge_settle',args:a},u),e=>e.code==='PERMISSION_DENIED');assert.deepEqual(await effective(uid),before);
  const good=await client(uid).rpc('challenge_settle',a);await drain(client(uid),token,good);assert.equal((await effective(uid)).stats.runs,1);
 }
});
await fs.writeFile('../direct-firestore-evidence-22/challenge-results.json',JSON.stringify({scope:'Actual local demo Rules; synthetic accounts/time-aged runs; no production or actual combat',tests:rows},null,2));console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length}));if(rows.some(x=>!x.pass))process.exitCode=1;
