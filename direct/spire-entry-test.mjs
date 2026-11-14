import {assert,fs,rows,test,seed,client,get,rest,raw,deniedWrite} from './emulator-harness.mjs';
import {decodeFields,encodeFields} from '../src/account/direct-store.js';
const suffix=Date.now().toString(36),id=x=>'entry11-'+x+'-'+suffix;
const list=c=>c.query({table:'hd3d_spire_runs',action:'select',filters:{},columns:'*'}).then(r=>r.data);
await test('same request concurrent independent transports commit one entry',async()=>{
 const uid=id('same');await seed(uid);const a=client(uid),b=client(uid),args={p_id:crypto.randomUUID(),p_from:1,p_growth:1};
 const r=await Promise.all([a.rpc('spire_start',args),b.rpc('spire_start',args)]);assert(r.every(x=>x.ok));assert.equal(r[0].token,r[1].token);assert.equal((await list(a)).length,1);assert.equal((await a.rpc('spire_status')).used,1);
 await assert.rejects(a.rpc('spire_start',{...args,p_from:6}));await assert.rejects(a.rpc('spire_start',{...args,p_growth:0}));assert.equal((await a.rpc('spire_status')).used,1);
 const done=await a.rpc('spire_finish',{p_token:r[0].token,p_top:0});assert(done.ok);assert.equal((await a.rpc('spire_start',args)).reason,'used');assert.equal((await list(a)).length,1);
});
await test('receipt and daily/run writes are indivisible, client cannot omit or change receipt',async()=>{
 const uid=id('raw');await seed(uid);let captured;const c=client(uid,{fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body);throw Error('capture before commit');}return fetch(url,o);}});
 await assert.rejects(c.rpc('spire_start',{p_id:crypto.randomUUID(),p_from:1,p_growth:1}),/capture/);
 const receipt=captured.writes.find(w=>w.update.name.includes('/hd3d_growth_investments/'));assert(receipt);
 await deniedWrite(uid,captured.writes.filter(w=>w!==receipt));
 for(const [field,value] of [['used',0],['left',30],['from',6],['best',999],['growth',false],['token',crypto.randomUUID()]]){
  const writes=structuredClone(captured.writes),r=writes.find(w=>w.update.name===receipt.update.name),d=decodeFields(r.update.fields);d.row.result[field]=value;r.update.fields=encodeFields(d);await deniedWrite(uid,writes);
 }
 assert.equal((await list(client(uid))).length,0);assert.equal((await client(uid).rpc('spire_status')).used,0);
});
await test('expired same entry is not replaced, and cross account request IDs stay isolated',async()=>{
 const uid=id('expire'),other=id('other');await seed(uid);await seed(other);const c=client(uid),args={p_id:crypto.randomUUID(),p_from:1,p_growth:1},r=await c.rpc('spire_start',args),run=(await list(c))[0];
 const doc=await rest(`/hd3d_live/${uid}/hd3d_spire_runs/${run.id}`,null,'owner','GET'),d=decodeFields(doc.fields);d.row.started_at=new Date(Date.now()-10801000).toISOString();const update={name:doc.name,fields:encodeFields(d)};update.fields.issuedAt={timestampValue:d.row.started_at};await rest(':commit',{writes:[{update}]});
 c.setNow(Date.now());assert.equal((await c.rpc('spire_start',args)).reason,'expired');assert.equal((await list(c)).length,1);assert.equal((await c.rpc('spire_status')).used,1);
 const b=await client(other).rpc('spire_start',args);assert(b.ok);assert.notEqual(b.token,r.token);assert.equal((await get(uid,'growth_wallet')).balance,1000);
});
await test('invalid and overlong entry IDs cannot create documents',async()=>{
 const uid=id('bad');await seed(uid);for(const p_id of ['short','../outside','a'.repeat(65)])await assert.rejects(client(uid).rpc('spire_start',{p_id,p_from:1,p_growth:1}));assert.equal((await list(client(uid))).length,0);
});
await fs.writeFile('../direct-firestore-evidence-22/spire-entry-results.json',JSON.stringify({fixtureTimeAged:true,rows},null,2));console.log('RESULT',rows.filter(x=>x.pass).length+'/'+rows.length);if(rows.some(x=>!x.pass))process.exitCode=1;
