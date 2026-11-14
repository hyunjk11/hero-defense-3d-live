import {testHost} from './test-endpoint.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createDirectTransport,DEMO_PROJECT,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {convertAccount} from './migration.mjs';
import {toDocument,numericTables} from '../server/firestore.mjs';
import {empty} from '../src/account/progress.js';
import {initialGrowth} from '../src/data/hero-growth.js';
import {STAGES} from '../src/data/stages.js';
import {HARD_STAGES} from '../src/data/hard.js';
const host=testHost,root=`projects/${DEMO_PROJECT}/databases/(default)/documents`;
const config={firebase:{projectId:DEMO_PROJECT},firestoreEmulator:host};
const rows=[],test=async(name,fn)=>{try{await fn();rows.push({name,pass:true});console.log('PASS',name);}catch(e){rows.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message);}};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function user(uid){const token=b64({alg:'none',typ:'JWT'})+'.'+b64({iss:`https://securetoken.google.com/${DEMO_PROJECT}`,aud:DEMO_PROJECT,sub:uid,user_id:uid,email:`${uid}@example.invalid`,email_verified:true,iat:Math.floor(Date.now()/1000)-10,exp:Math.floor(Date.now()/1000)+3600,auth_time:Math.floor(Date.now()/1000)-10,firebase:{identities:{},sign_in_provider:'password'}})+'.';return {uid,email:`${uid}@example.invalid`,getIdToken:async()=>token};}
async function rest(path,body,token='owner',method='POST'){const r=await fetch(host+'/v1/'+root+path,{method,headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Object.assign(new Error(value.error?.message||JSON.stringify(value)),{status:r.status,code:value.error?.status});return value;}
const legacy=(table,row)=>toDocument('hd3d_'+table,row);
async function seed(uid,{balance=1000,hard=false}={}){
 const save=empty();save.souls=1000;if(hard)save.st=Object.fromEntries(Object.keys(STAGES).map(s=>[s,3]));
 save.codex={'old-key':true};save.chests=[{id:'preserved-chest',it:{id:'old-gear',s:'weapon',h:'mage',g:0}}];
 const growth=initialGrowth(save);growth.granted=balance;growth.balance=balance;if(hard)growth.hard={st:{'hard-1-1':3}};
 const iso='2026-01-01T00:00:00.000Z';const source=[legacy('progress',{user_id:uid,data:save,merged:true,created_at:iso,updated_at:iso}),legacy('profiles',{id:uid,nickname:'Test',created_at:iso,updated_at:iso}),legacy('growth_wallet',{user_id:uid,...growth}),legacy('owned',{user_id:uid,item:'hero_fighter'}),legacy('mail',{id:900,user_id:uid,title:'old',body:'old',reward:{souls:1},claimed:true,claimed_at:iso,revoked:false,order_id:null,broadcast_id:null,created_at:iso})];
 const docs=convertAccount(uid,source,{sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,5000]))});await rest(':commit',{writes:docs.map(update=>({update}))});return {source,docs,save,growth};
}
function client(uid,{fetcher=fetch}={}){const u=user(uid),auth={currentUser:u};let now=Date.now();const transport=createDirectTransport(config,{auth,fetcher,clock:()=>now,random:()=>.7});return {u,auth,setNow:x=>now=x,rpc:(name,args={})=>transport({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data),query:q=>transport({kind:'query',...q},u),transport};}
async function get(uid,table,id=uid){const r=await rest(`/hd3d_live/${uid}/hd3d_${table}/${id}`,null,'owner','GET');return decodeFields(r.fields).row;}
async function deniedWrite(uid,writes){await assert.rejects(rest(':commit',{writes},await user(uid).getIdToken()),e=>e.status===403);}
const raw=(uid,table,id,row,revision)=>({name:`${root}/hd3d_live/${uid}/hd3d_${table}/${id}`,fields:encodeFields({owner:uid,version:1,row,commitRevision:revision})});
function commit(uid,table,id,row,revision){return [{update:raw(uid,table,id,row,revision)},{update:raw(uid,'sequences','_revision',{id:'_revision',value:revision},revision)}];}

// Reset only this dedicated in-memory demo project, never a production endpoint.
if(process.argv.includes('--reset-demo')){const reset=await fetch(host+'/emulator/v1/projects/'+DEMO_PROJECT+'/databases/(default)/documents',{method:'DELETE'});assert.equal(reset.ok,true);}

await test('production mode cannot be enabled by config',()=>assert.throws(()=>createDirectTransport({...config,firebase:{projectId:'hero-defense-3d-independent'}},{auth:{}}),/emulator-only/));
await test('migration preserves every exported row, IDs, save and codex',async()=>{const x=await seed('migration');assert.equal((await get('migration','progress')).saveJson,JSON.stringify(x.save));assert.equal((await get('migration','sequences','hd3d_mail')).value,5000);assert.throws(()=>convertAccount('other',x.source),/Cross-account/);assert.throws(()=>convertAccount('migration',x.source,{project:'production'}),/demo/);assert.throws(()=>convertAccount('migration',[x.source[0],x.source[0]]),/Duplicate/);});
await test('unmigrated account fails closed, without creating an empty replacement',async()=>{const c=client('not-migrated');await assert.rejects(c.rpc('growth_status'),/snapshot/);});
await test('auth A cannot read B, anonymous cannot read A',async()=>{await seed('alice');await seed('bob');await assert.rejects(rest('/hd3d_live/bob/hd3d_progress/bob',null,await user('alice').getIdToken(),'GET'),e=>e.status===403);await assert.rejects(rest('/hd3d_live/alice/hd3d_progress/alice',null,null,'GET'),e=>e.status===403);});
await test('own progress query is scoped and preserves old timestamp',async()=>{const c=client('alice');const r=await c.query({table:'hd3d_progress',action:'select',columns:'*',filters:{user_id:'alice'},single:true});assert.equal(r.data.user_id,'alice');assert.equal(r.data.updated_at,'2026-01-01T00:00:00.000Z');assert.equal((await c.query({table:'hd3d_progress',action:'select',columns:'*',filters:{user_id:'bob'},single:true})).data,null);});
await test('fresh bans block writes immediately',async()=>{await seed('banned');await rest(':commit',{writes:[{update:raw('banned','bans','banned',{user_id:'banned',reason:'test'},0)}]});await assert.rejects(client('banned').rpc('growth_start',{p_id:'run-banned-1',p_mode:'campaign',p_stage:'1-1',p_hero:'mage'}),/banned/);});
await test('admin, owned and activation escalation blocked, legacy documents remain denied',async()=>{for(const [t,id,row]of [['admins','alice',{user_id:'alice',owner:true}],['owned','alice~hero_gunner',{user_id:'alice',item:'hero_gunner'}],['sequences','_activation',{id:'_activation',schema:1,enabled:true}]])await deniedWrite('alice',commit('alice',t,id,row,2));await assert.rejects(rest('/hd3d_progress/alice',null,await user('alice').getIdToken(),'GET'),e=>e.status===403);});
await test('normal save CAS, stale device rejection, and reload equality',async()=>{await seed('save');const c=client('save'),old=await get('save','progress');const save=JSON.parse(old.saveJson);save.souls-=30;save.heroLv.mage.hp=1;const q={table:'hd3d_progress',action:'update',columns:'*',filters:{user_id:'save',updated_at:old.updated_at},values:{data:save,merged:true},returning:true};const [a,b]=await Promise.all([c.query(q),client('save').query(q)]);assert.equal([a,b].filter(r=>r.data.length===1).length,1);assert.equal(JSON.parse((await get('save','progress')).saveJson).souls,970);assert.deepEqual((await client('save').query({table:'hd3d_progress',action:'select',filters:{user_id:'save'},single:true})).data.data,save);});
await test('simultaneous two-hero investment cannot spend one balance twice',async()=>{await seed('invest',{balance:100});const a=client('invest'),b=client('invest');const results=await Promise.all([a.rpc('growth_invest',{p_id:'invest-id-a',p_revision:0,p_hero:'mage',p_level:2}),b.rpc('growth_invest',{p_id:'invest-id-b',p_revision:0,p_hero:'archer',p_level:2})]);assert.equal(results.filter(x=>x.ok).length,1);const w=await get('invest','growth_wallet');assert.equal(w.balance,0);assert.equal(w.spent,100);assert.equal(w.xp.mage+w.xp.archer,100);});
await test('same investment retry reuses receipt and mismatched body fails',async()=>{await seed('retry',{balance:500});const c=client('retry'),a={p_id:'retry-invest',p_revision:0,p_hero:'mage',p_level:2};assert.equal((await c.rpc('growth_invest',a)).ok,true);assert.equal((await c.rpc('growth_invest',a)).already,true);assert.equal((await c.rpc('growth_invest',{...a,p_hero:'archer'})).reason,'id_reused');assert.equal((await get('retry','growth_wallet')).balance,400);});
await test('server commit response loss is not blindly replayed; same receipt recovers',async()=>{await seed('lost',{balance:500});let commits=0,lost=false;const c=client('lost',{fetcher:async(url,opt)=>{const response=await fetch(url,opt);if(url.endsWith(':commit')&&response.ok&&!lost){commits++;lost=true;throw new TypeError('simulated response loss after commit');}return response;}});const a={p_id:'lost-invest',p_revision:0,p_hero:'mage',p_level:2};await assert.rejects(c.rpc('growth_invest',a),/response loss/);assert.equal(commits,1);assert.equal((await client('lost').rpc('growth_invest',a)).already,true);assert.equal((await get('lost','growth_wallet')).balance,400);});
await test('late response after account switch is discarded',async()=>{await seed('switch');let switched=false;const c=client('switch',{fetcher:async(url,opt)=>{const r=await fetch(url,opt);if(url.endsWith(':commit')&&r.ok&&!switched){switched=true;c.auth.currentUser=user('bob');}return r;}});await assert.rejects(c.rpc('growth_invest',{p_id:'switch-invest',p_revision:0,p_hero:'mage',p_level:2}),e=>e.code==='ACCOUNT_CHANGED');assert.equal((await get('bob','growth_wallet')).balance,1000);});
await test('hard party ownership, identity reuse and stage lock stay enforced',async()=>{await seed('party',{hard:true});const c=client('party'),a={p_id:'hard-party-start',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage',p_partner:'fighter',p_partyVersion:1};const r=await c.rpc('growth_start',a);assert.equal(r.ok,true);assert.deepEqual(r.party,['mage','fighter']);assert.equal((await c.rpc('growth_start',{...a,p_partner:'gunner'})).reason,'invalid_party');assert.equal((await c.rpc('growth_start',{...a,p_id:'hard-party-locked',p_stage:'hard-6-1'})).ok,false);});
await test('hard repeat collection loot, XP and kills settle once atomically',async()=>{await seed('hard',{hard:true});const c=client('hard'),id='hard-settle-id';assert.equal((await c.rpc('growth_start',{p_id:id,p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'})).ok,true);c.setNow(Date.now()+120000);const args={p_token:id,p_completed:HARD_STAGES['hard-1-1'].waves,p_win:true,p_finish:true,p_stars:3,p_kills:11};const first=await c.rpc('growth_progress',args);assert.equal(first.ok,true);assert.equal(first.hardSaved,true);const after=await get('hard','progress'),w=await get('hard','growth_wallet');const again=await c.rpc('growth_progress',args);assert.equal(again.already,true);assert.deepEqual(await get('hard','progress'),after);assert.deepEqual(await get('hard','growth_wallet'),w);const save=JSON.parse(after.saveJson);assert.equal(save.hardRewardSeq,1);assert.equal(save.stats.kills,11);assert.ok(save.chests.length>1);});
await test('forged negative wallet / missing schema / envelope owner / delete rejected',async()=>{await seed('invalid');const w=await get('invalid','growth_wallet');for(const row of [{...w,balance:-1},{...w,admin:true},{user_id:'invalid'}])await deniedWrite('invalid',commit('invalid','growth_wallet','invalid',row,1));const bad=raw('invalid','growth_wallet','invalid',w,1);bad.fields.owner={stringValue:'bob'};await deniedWrite('invalid',[{update:bad}]);await deniedWrite('invalid',[{delete:`${root}/hd3d_live/invalid/hd3d_progress/invalid`}]);});
await test('known trust limit: own earned-XP forgery passes shape rules (release blocked)',async()=>{await seed('trust');const w=await get('trust','growth_wallet');w.earned+=1;w.balance+=1;w.rev++;await rest(':commit',{writes:commit('trust','growth_wallet','trust',w,1)},await user('trust').getIdToken());assert.equal((await get('trust','growth_wallet')).earned,1);});
await test('unsupported privileged/ranking APIs fail explicitly',async()=>{const c=client('alice');for(const name of ['owner_add_admin','admin_grant','spire_rank'])await assert.rejects(c.rpc(name),e=>e.code==='DIRECT_UNSUPPORTED');});

await test('Auth emulator email login, UID retention, refresh token and Firestore ownership',async()=>{
 const email='direct-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+'aB7!';
 const authCall=async(action,body)=>{const r=await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:'+action+'?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.ok,true);return r.json();};
 const first=await authCall('signUp',{email,password,returnSecureToken:true});
 const second=await authCall('signInWithPassword',{email,password,returnSecureToken:true});
 assert.equal(first.localId,second.localId);await seed(first.localId);
 const u={uid:second.localId,email,getIdToken:async()=>second.idToken},auth={currentUser:u};
 const transport=createDirectTransport(config,{auth});
 const result=await transport({kind:'query',table:'hd3d_progress',action:'select',filters:{user_id:u.uid},single:true},u);
 assert.equal(result.data.user_id,u.uid);
 const refresh=await fetch('http://127.0.0.1:9199/securetoken.googleapis.com/v1/token?key=demo-key',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:second.refreshToken})});
 assert.equal(refresh.ok,true);const renewed=await refresh.json();assert.equal(renewed.user_id,u.uid);
 // Values above are ephemeral emulator-only credentials and never logged.
});
await test('cross-account create, mixed transaction and collection-group leakage denied',async()=>{
 const row=await get('alice','growth_wallet');await deniedWrite('alice',commit('bob','growth_wallet','bob',row,9));
 await assert.rejects(rest(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_progress',allDescendants:true}]}},await user('alice').getIdToken()),e=>e.status===403);
});
await test('receipt cannot be overwritten or removed even with a valid revision fence',async()=>{
 const uid='receipt-lock';await seed(uid);const c=client(uid);await c.rpc('growth_invest',{p_id:'immutable-receipt',p_revision:0,p_hero:'mage',p_level:2});
 const id=uid+'~immutable-receipt',receipt=await get(uid,'growth_investments',id),rev=(await get(uid,'sequences','_revision')).value+1;
 await deniedWrite(uid,commit(uid,'growth_investments',id,{...receipt,body:'changed'},rev));
 await deniedWrite(uid,[{delete:`${root}/hd3d_live/${uid}/hd3d_growth_investments/${id}`}]);
});
await test('completed run cannot reopen or rebind stage/hero/build',async()=>{
 const uid='run-lock';await seed(uid);const c=client(uid),id='finished-run';await c.rpc('growth_start',{p_id:id,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});c.setNow(Date.now()+10000);await c.rpc('growth_progress',{p_token:id,p_completed:1,p_win:false,p_finish:true});
 const old=await get(uid,'growth_runs',uid+'~'+id),rev=(await get(uid,'sequences','_revision')).value+1;
 for(const change of [{done:false},{stage:'10-6'},{hero:'archer'},{build:{}}])await deniedWrite(uid,commit(uid,'growth_runs',old.id,{...old,...change},rev));
});
await test('oversized blob, missing timestamp and forged mail hero reward rejected',async()=>{
 const uid='shape-bound';await seed(uid);const old=await get(uid,'progress');
 for(const row of [{...old,saveJson:'a'.repeat(65536)},Object.fromEntries(Object.entries(old).filter(([k])=>k!=='created_at'))])await deniedWrite(uid,commit(uid,'progress',uid,row,1));
 const mail={id:6001,user_id:uid,title:'forged',body:'',reward:{hero:'gunner'},claimed:true,claimed_at:'2026-01-01',revoked:false,order_id:null,broadcast_id:null,created_at:'2026-01-01',server_applied:true};
 await deniedWrite(uid,commit(uid,'mail','6001',mail,1));
});
await test('503 after commit is ambiguous: no auto retry and receipt survives',async()=>{
 const uid='ambiguous-503';await seed(uid);let count=0;
 const c=client(uid,{fetcher:async(url,opt)=>{const r=await fetch(url,opt);if(url.endsWith(':commit')&&r.ok){count++;return new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:'injected after commit'}}),{status:503});}return r;}});
 const args={p_id:'unavailable-receipt',p_revision:0,p_hero:'mage',p_level:2};await assert.rejects(c.rpc('growth_invest',args),e=>e.status===503);assert.equal(count,1);assert.equal((await client(uid).rpc('growth_invest',args)).already,true);
});
await test('hard reward racing a stale normal save preserves reward sequence',async()=>{
 const uid='hard-cas';await seed(uid,{hard:true});const c=client(uid),old=await get(uid,'progress'),id='hard-cas-run';
 await c.rpc('growth_start',{p_id:id,p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage'});c.setNow(Date.now()+120000);
 const stale=JSON.parse(old.saveJson);stale.souls-=30;stale.heroLv.mage.hp=1;
 const [finish,save]=await Promise.all([c.rpc('growth_progress',{p_token:id,p_completed:1,p_win:false,p_finish:true,p_kills:1}),client(uid).query({table:'hd3d_progress',action:'update',columns:'*',returning:true,filters:{user_id:uid,updated_at:old.updated_at},values:{data:stale,merged:true}})]);
 assert.equal(finish.ok,true);const actual=JSON.parse((await get(uid,'progress')).saveJson);assert.equal(actual.hardRewardSeq,1);assert.equal(actual.stats.kills,1);assert.equal(actual.souls,save.data.length?984:1014);
});
await test('known trust limit: valid own save can forge currency without touching authority',async()=>{
 const uid='save-trust';await seed(uid);const c=client(uid),old=await get(uid,'progress'),data=JSON.parse(old.saveJson);data.souls=999999;
 const r=await c.query({table:'hd3d_progress',action:'update',returning:true,filters:{user_id:uid,updated_at:old.updated_at},values:{data,merged:true}});assert.equal(r.data.length,1);assert.equal(JSON.parse((await get(uid,'progress')).saveJson).souls,999999);
});

await fs.writeFile(new URL('../../direct-firestore-evidence/emulator-results.json',import.meta.url),JSON.stringify({project:DEMO_PROJECT,host,tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length,failed:rows.filter(x=>!x.pass).map(x=>x.name)}));
process.exitCode=rows.some(x=>!x.pass)?1:0;
