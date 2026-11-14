// Deliberately hostile modified-client draws, only against synthetic demo rows.
// Success here documents a security limitation, not a security-test pass.
import {assert,fs,rest,seed,get,user,config,root} from './emulator-harness.mjs';
import {createDirectTransport,decodeFields,encodeFields} from '../src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import {HARD_STAGES} from '../src/data/hard.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const rows=[];
function transport(uid,random,fetcher=fetch){const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},random,fetcher});return {u,rpc:async(name,args={})=>(await t({kind:'rpc',name:'hd3d_'+name,args},u)).data};}
async function age(uid,table,id){const d=await rest(`/hd3d_live/${uid}/hd3d_${table}/${id}`,null,'owner','GET'),v=decodeFields(d.fields),at=new Date(Date.now()-120000).toISOString();v.row.started_at=at;d.fields=encodeFields(v);d.fields.issuedAt={timestampValue:at};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});}
for(const [label,draw] of [['minimum',0],['forced-maximum',.999999]]){
 const uid='rng20-hard-'+label;await seed(uid,{hard:true});const token='rng-hard-'+label;let captured;
 const c=transport(uid,()=>draw,async(url,o)=>{if(url.endsWith(':commit')){const batch=JSON.parse(o.body),w=batch.writes.find(w=>w.update?.name.endsWith('/_revision'));if(w&&decodeFields(w.update.fields).row.proof.op==='hard_settle'){captured=batch;throw Error('capture before RNG grant');}}return fetch(url,o);});
 assert((await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_hero:'fighter',p_stage:'hard-1-1',p_target:'mage'})).ok);
 await age(uid,'growth_runs',uid+'~'+token);await assert.rejects(c.rpc('growth_progress',{p_token:token,p_completed:HARD_STAGES['hard-1-1'].waves,p_win:true,p_finish:true,p_stars:3,p_kills:11}),/capture/);assert(captured);
 // Raw hostile HTTP bypasses the game UI. Structural inflation is still denied.
 const bad=structuredClone(captured),mail=bad.writes.find(w=>w.update?.name.includes('/hd3d_growth_investments/')).update,v=decodeFields(mail.fields);v.row.result.souls++;mail.fields=encodeFields(v);
 await assert.rejects(rest(':commit',bad,await c.u.getIdToken()),e=>e.status===403);
 await rest(':commit',captured,await c.u.getIdToken());const run=await get(uid,'growth_runs',uid+'~'+token),m=await get(uid,'growth_investments',uid+'~hard~'+token);
 rows.push({operation:'hard_settle',draw,accepted:true,grades:m.result.specs.map(x=>x.g),slots:m.result.specs.map(x=>x.s),extraCurrencyDenied:true});
 if(label==='forced-maximum'){assert(m.result.specs.slice(0,-2).every(x=>x.g===4));assert(m.result.specs.slice(-2).every(x=>x.g===2));}
}
for(const [label,draw] of [['ordinary-miss',.99],['forced-success',0]]){
 const uid='rng20-dungeon-'+label;await seed(uid);const c=transport(uid,()=>draw),s=await c.rpc('dungeon_start',{p_growth:1});assert(s.ok);
 const list=await rest(`/hd3d_live/${uid}:runQuery`,{structuredQuery:{from:[{collectionId:'hd3d_dungeon_runs'}]}}),d=list.find(x=>x.document).document,id=decodeFields(d.fields).row.id;
 await age(uid,'dungeon_runs',id);const r=await c.rpc('dungeon_boss_drop',{p_token:s.token,p_hero:'fighter'});assert(r.ok);assert.equal(!!r.item,label==='forced-success');
 const again=await transport(uid,()=>draw?0:.99).rpc('dungeon_boss_drop',{p_token:s.token,p_hero:'fighter'});assert.deepEqual(again,r);
 rows.push({operation:'dungeon_boss_drop',draw,accepted:true,hit:!!r.item,duplicateDrawImmutable:true});
}
await fs.writeFile('../direct-firestore-evidence-22/rng-trust-results.json',JSON.stringify({scope:'Isolated demo, synthetic Auth, artificially aged eligible runs. No combat proof, probability fairness, production or approval to weaken security.',structuralLimitation:true,rows},null,2));
console.log(JSON.stringify(rows));
