import {assert,fs,rest,seed,client,get,user,test,rows,deniedWrite} from './emulator-harness.mjs';
import {DEMO_PROJECT,directDocument,decodeFields} from '../src/account/direct-store.js';
import {rankingDocuments} from './ranking-migration.mjs';
import {rankTimeKey} from '../src/account/direct-ranking.js';
const suffix=Date.now().toString(36),early='z-precision-'+suffix,late='a-precision-'+suffix;
const at='2026-11-01T09:00:00.000000001+09:00',later='2026-11-01T09:00:00.000000002+09:00';
for(const [uid,time] of [[early,at],[late,later]]){
 await seed(uid);const row={user_id:uid,best_floor:30,best_at:time,cleared_bosses:30,updated_at:'2026-11-01T00:00:00Z'};
 await rest(':commit',{writes:[directDocument(DEMO_PROJECT,uid,'hd3d_spire_best',uid,row),...rankingDocuments([{uid,kind:'all',nick:'Test',floor:30,at:time}])].map(update=>({update}))});
}
const publicRank=async uid=>decodeFields((await rest('/hd3d_live_ranks/all~all~'+uid,null,'owner','GET')).fields);
await test('actual Firestore roundtrip preserves nine-digit legacy tie ordering',async()=>{
 assert.equal((await get(early,'spire_best')).best_at,at);assert.equal((await publicRank(early)).at,'2026-11-01T00:00:00.000000001Z');
 assert(rankTimeKey((await publicRank(early)).at)<rankTimeKey((await publicRank(late)).at));
 const a=await client(early).rpc('spire_rank',{p_kind:'all'}),b=await client(late).rpc('spire_rank',{p_kind:'all'});assert.equal(a.me.rank+1,b.me.rank);
});
async function prepared(uid,from=1){const c=client(uid),run=await c.rpc('spire_start',{p_id:crypto.randomUUID(),p_from:from,p_growth:1});assert(run.ok);
 const row=(await c.query({table:'hd3d_spire_runs',action:'select',columns:'*',filters:{},single:false})).data.find(x=>x.token===run.token),doc=await rest(`/hd3d_live/${uid}/hd3d_spire_runs/${row.id}`,null,'owner','GET'),aged=new Date(Date.now()-120000).toISOString();
 doc.fields.issuedAt={timestampValue:aged};doc.fields.row.mapValue.fields.started_at={stringValue:aged};await rest(':commit',{writes:[{update:{name:doc.name,fields:doc.fields}}]});return run;}
await test('lower score keeps private exact time and public exact tie',async()=>{
 const run=await prepared(early);assert((await client(early).rpc('spire_finish',{p_token:run.token,p_top:1})).ok);assert.equal((await get(early,'spire_best')).best_at,at);assert.equal((await publicRank(early)).at,'2026-11-01T00:00:00.000000001Z');
});
await test('new best switches to linked server timestamp; client cannot introduce forged legacy strings',async()=>{
 const run=await prepared(early,31);let captured;
 const c=client(early,{fetcher:async(u,o)=>{if(u.endsWith(':commit')){captured=JSON.parse(o.body);throw Error('captured score');}return fetch(u,o);}});
 await assert.rejects(c.rpc('spire_finish',{p_token:run.token,p_top:31}),/captured/);assert(captured);
 for(const match of ['/hd3d_spire_best/','/hd3d_live_ranks/all~']){const b=structuredClone(captured),w=b.writes.find(w=>w.update?.name.includes(match));if(match.includes('spire_best'))w.update.fields.row.mapValue.fields.best_at={stringValue:'0001-01-01T00:00:00.000000001Z'};else w.update.fields.at={stringValue:'0001-01-01T00:00:00.000000001Z'};w.updateTransforms=[];await deniedWrite(early,b.writes);}
 await rest(':commit',captured,await user(early).getIdToken());const d=await rest(`/hd3d_live/${early}/hd3d_spire_best/${early}`,null,'owner','GET'),pub=await publicRank(early);assert(d.fields.row.mapValue.fields.best_at.timestampValue);assert.equal(pub.floor,31);assert.equal(pub.at,(await get(early,'spire_best')).best_at);
});
await fs.writeFile('../direct-firestore-evidence-22/legacy-rank-precision-results.json',JSON.stringify({scope:'Actual demo Firestore; trusted synthetic import and aged test clock, not normal-time gameplay',officialContract:'https://firebase.google.com/docs/firestore/manage-data/data-types',rows},null,2));if(rows.some(x=>!x.pass))process.exitCode=1;
