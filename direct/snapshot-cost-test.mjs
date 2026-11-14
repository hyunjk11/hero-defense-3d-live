import {assert,fs,seed,rest,get,user,config} from './emulator-harness.mjs';
import {createDirectTransport as after,directDocument,encodeFields,decodeFields} from '../src/account/direct-store.js';
import {createDirectTransport as before} from '../../candidate-v34-firestore-direct-19/src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import * as E from '../src/account/equip.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {stable} from '../src/account/direct-authority.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const rows=[];
for(const [version,create] of [['before19',before],['after20',after]]){
 const uid='cost20-'+version,token='cost-challenge-fixture';await seed(uid);const u=user(uid),metrics={http:0,commits:0,writes:0,requestedDocuments:0},events=[];let measuring=false,seq=0;
 const start=await get(uid,'progress'),initial=authoritativeSave(start.cosmetic,start.authority),tx=create(config,{auth:{currentUser:u},random:()=>.4,uuid:()=>('cost'+String(++seq).padStart(12,'0')),fetcher:async(url,o)=>{
  const b=JSON.parse(o.body);if(measuring){metrics.http++;metrics.requestedDocuments+=b.documents?.length||0;events.push({path:url.split('/').at(-1),documents:b.documents?.length||0,writes:b.writes?.length||0});}
  const r=await fetch(url,o);if(measuring&&url.endsWith(':commit')&&r.ok){metrics.commits++;metrics.writes+=b.writes.length;}return r;
 }}),rpc=async(name,args)=>(await tx({kind:'rpc',name:'hd3d_'+name,args},u)).data;
 assert((await rpc('growth_start',{p_id:token,p_mode:'challenge',p_hero:'mage'})).ok);
 const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET'),v=decodeFields(doc.fields),at=new Date(Date.now()-300000).toISOString();v.row.started_at=at;doc.fields=encodeFields(v);doc.fields.issuedAt={timestampValue:at};delete doc.createTime;delete doc.updateTime;await rest(':commit',{writes:[{update:doc}]});
 assert((await rpc('growth_progress',{p_token:token,p_completed:55,p_win:false,p_finish:true})).ok);
 const drops=Array.from({length:11},(_,i)=>{const it=E.makeItem('armor',null,1,()=>.4,1);it.id='same-drop-'+i;return it;});
 measuring=true;const begin=performance.now();let z=await rpc('challenge_settle',{p_token:token,p_wave:55,p_kills:500,p_stars:0,p_drops:drops,p_bossKills:Array.from({length:11},(_,i)=>(i+1)*5)});
 while(z.next<z.total)z=await rpc('challenge_loot',{p_token:token,p_index:z.next});const elapsedMs=performance.now()-begin;measuring=false;
 const p=await get(uid,'progress'),saved=authoritativeSave(p.cosmetic,p.authority);assert.equal(saved.chests.length,22);
 rows.push({version,initial,metrics,elapsedMs,result:{souls:saved.souls,stats:saved.stats,bestWave:saved.bestWave,grades:saved.chests.map(x=>x.it.g),bossIds:saved.chests.slice(11).map(x=>x.it.id)},events});
}
assert.equal(stable(rows[0].initial),stable(rows[1].initial));assert.deepEqual(rows[0].result,rows[1].result);assert.equal(rows[0].metrics.writes,rows[1].metrics.writes);assert.equal(rows[0].metrics.commits,rows[1].metrics.commits);assert.equal(rows[0].metrics.requestedDocuments,rows[1].metrics.requestedDocuments);assert(rows[1].metrics.http<rows[0].metrics.http);
await fs.writeFile('../direct-firestore-evidence-22/snapshot-cost-results.json',JSON.stringify({scope:'Same isolated emulator, same initial save/55 waves/11 drops/RNG/settlement only. Sequential sample. No combat or production latency/billing claim.',rows},null,2));console.log(JSON.stringify(rows.map(({version,metrics,elapsedMs})=>({version,metrics,elapsedMs}))));
