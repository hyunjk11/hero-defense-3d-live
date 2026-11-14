import {assert,fs,test,rows,rest,seed,client,get,raw,deniedWrite,user} from './emulator-harness.mjs';
import {convertAccount} from './migration.mjs';
import {toDocument,numericTables} from '../server/firestore.mjs';
import {day,week} from '../server/common.mjs';
import {encodeFields,decodeFields} from '../src/account/direct-store.js';
const suffix=Date.now().toString(36),id=x=>'sp10-'+x+'-'+suffix,iso=()=>new Date().toISOString();
async function runs(c){return (await c.query({table:'hd3d_spire_runs',action:'select',filters:{},columns:'*'})).data;}
async function age(uid,row,seconds){const d=await rest(`/hd3d_live/${uid}/hd3d_spire_runs/${row.id}`,null,'owner','GET'),v=decodeFields(d.fields);v.row.started_at=new Date(Date.now()-seconds*1000).toISOString();const update={name:d.name,fields:encodeFields(v)};update.fields.issuedAt={timestampValue:v.row.started_at};update.fields.pingAt=v.row.last_ping_at?{timestampValue:v.row.last_ping_at}:{nullValue:null};await rest(':commit',{writes:[{update}]});}
await test('29 trusted historical entries consume day; 30th allowed and 31st blocked',async()=>{
 const uid=id('daily'),base=await seed(uid),now=Date.now(),source=[...base.source];
 for(let i=1;i<=29;i++)source.push(toDocument('hd3d_spire_runs',{id:i,user_id:uid,token:crypto.randomUUID(),day:day(now),week:week(now),from_floor:1,top_floor:0,growth:true,status:'done',started_at:iso(),last_ping_at:null,last_ping_floor:null,finished_at:iso(),capped:false,summary:null,created_at:iso()}));
 const docs=convertAccount(uid,source,{sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,5000]))});await rest(':commit',{writes:docs.map(update=>({update}))});
 const c=client(uid);assert.equal((await c.rpc('spire_status')).left,1);assert((await c.rpc('spire_start',{p_from:1,p_growth:1})).ok);assert.equal((await c.rpc('spire_start',{p_from:1,p_growth:1})).reason,'daily_limit');
 assert.equal((await get(uid,'sequences','spire-'+Math.floor(now/86400000+9/24))).value,30);
});
await test('older direct activation requires trusted day migration, no silent reset',async()=>{
 const uid=id('old');await seed(uid);const a=await get(uid,'sequences','_activation');delete a.spireVersion;await rest(':commit',{writes:[{update:raw(uid,'sequences','_activation',a,0)}]});
 await assert.rejects(client(uid).rpc('spire_start',{p_from:1,p_growth:1}),e=>e.code==='MIGRATION_REQUIRED');
 assert((await client(uid).rpc('growth_status')).ok);
});
await test('client tomorrow cannot evade Korean calendar counter',async()=>{
 const uid=id('date');await seed(uid);const c=client(uid);c.setNow(Date.now()+86400000);
 await assert.rejects(c.rpc('spire_start',{p_from:1,p_growth:1}),e=>e.status===403);assert.equal((await runs(client(uid))).length,0);
});
await test('non-growth boss-only ping and elapsed capping preserve original behavior',async()=>{
 const uid=id('nogrowth');await seed(uid);const c=client(uid),r=await c.rpc('spire_start',{p_from:1,p_growth:0}),row=(await runs(c))[0];
 assert.equal((await c.rpc('spire_ping',{p_token:r.token,p_floor:1})).reason,'bad_floor');await age(uid,row,100);c.setNow(Date.now());
 const done=await c.rpc('spire_finish',{p_token:r.token,p_top:30});assert(done.ok);assert.equal(done.top,4);assert.equal(done.capped,true);assert.equal((await get(uid,'growth_wallet')).balance,1000);
});
await test('expired attempt abandons without XP/reward and cross-token access fails',async()=>{
 const uid=id('expired');await seed(uid);const c=client(uid),r=await c.rpc('spire_start',{p_from:1,p_growth:1}),row=(await runs(c))[0];await age(uid,row,11000);c.setNow(Date.now());
 const result=await c.rpc('spire_finish',{p_token:r.token,p_top:30});assert.equal(result.reason,'expired');assert.equal((await get(uid,'spire_runs',row.id)).status,'abandoned');assert.equal((await get(uid,'growth_wallet')).balance,1000);
 const other=id('other');await seed(other);assert.equal((await client(other).rpc('spire_finish',{p_token:r.token,p_top:1})).reason,'bad_token');
});
await test('commit reply loss and concurrent finish use one reward/XP receipt',async()=>{
 const uid=id('lost');await seed(uid);let lose=false,commits=0;
 const c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&JSON.parse(o.body).writes.some(w=>w.update?.fields.row?.mapValue?.fields?.proof?.mapValue?.fields?.op?.stringValue==='spire_finish')){commits++;if(lose){lose=false;throw Error('synthetic lost tower finish');}}return r;}});
 const start=await c.rpc('spire_start',{p_from:1,p_growth:1}),row=(await runs(c))[0];await age(uid,row,1000);c.setNow(Date.now());lose=true;
 await assert.rejects(c.rpc('spire_finish',{p_token:start.token,p_top:10}),/lost tower/);
 const before=await get(uid,'growth_wallet');const same=await Promise.all([c.rpc('spire_finish',{p_token:start.token,p_top:10}),c.rpc('spire_finish',{p_token:start.token,p_top:10})]);
 assert(same.every(x=>x.already));assert.equal(commits,1);assert.equal(before.balance,1080);assert.deepEqual(await get(uid,'growth_wallet'),before);
 const mails=(await c.query({table:'hd3d_mail',action:'select',filters:{},columns:'*'})).data.filter(x=>!x.claimed);assert.equal(mails.length,1);assert.deepEqual(mails[0].reward,{souls:900,medals:6});
});
await test('over100 deterministic medals only, existing titles preserved',async()=>{
 const uid=id('high');await seed(uid);const now=iso();await rest(':commit',{writes:[{update:raw(uid,'spire_best',uid,{user_id:uid,best_floor:110,best_at:now,cleared_bosses:110,updated_at:now},0)}]});
 const c=client(uid),start=await c.rpc('spire_start',{p_from:111,p_growth:1}),row=(await runs(c))[0];await age(uid,row,1000);c.setNow(Date.now());const done=await c.rpc('spire_finish',{p_token:start.token,p_top:140});
 assert.equal(done.reward.souls,0);assert.equal(done.reward.medals,30);assert.deepEqual(done.reward.floors,[120,130,140]);assert.equal(done.xp,240);
});
await test('raw forged entry, counter rollback and arbitrary reward mail are denied',async()=>{
 const uid=id('raw');await seed(uid);const c=client(uid),r=await c.rpc('spire_start',{p_from:1,p_growth:1}),row=(await runs(c))[0],rev=(await get(uid,'sequences','_revision')).value+1;
 const proof={op:'spire_finish',request:String(row.id),token:r.token,hero:'',level:30,stat:''};
 const meta={update:raw(uid,'sequences','_revision',{id:'_revision',value:rev,proof},rev)};
 await deniedWrite(uid,[{update:raw(uid,'spire_runs',row.id,{...row,top_floor:99999,status:'done',finished_at:iso()},rev)},meta]);
 const key='spire-'+Math.floor(Date.now()/86400000+9/24);await deniedWrite(uid,[{update:raw(uid,'sequences',key,{id:key,value:0},rev)},meta]);
 await deniedWrite(uid,[{update:raw(uid,'mail',5001,{id:5001,user_id:uid,title:'forge',body:'',reward:{souls:9999},claimed:false,revoked:false,claimed_at:null,order_id:null,broadcast_id:null,created_at:iso()},rev)},meta]);
 assert.equal((await get(uid,'growth_wallet')).balance,1000);
});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/spire-boundary-results.json',import.meta.url),JSON.stringify({fixtureTimeAged:true,production:false,rows},null,2));console.log('RESULT',rows.filter(x=>x.pass).length+'/'+rows.length);if(rows.some(x=>!x.pass))process.exitCode=1;
