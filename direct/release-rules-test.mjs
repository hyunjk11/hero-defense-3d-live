import {authoritativeSave} from '../src/account/direct-authority.js';
// Production endpoint routing + generated audience Rules, redirected exclusively
// to a standalone demo emulator. Synthetic JWT/clock; not real Firebase or Auth.
import {assert,fs,seed,get,rest,root,config as demo,user as demoUser} from './emulator-harness.mjs';
import {CLOUD} from '../src/config/cloud.js';
import {DIRECT_READY,LIVE_PROJECT} from '../src/account/direct-config.js';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import {createDirectTransport,decodeFields,encodeFields} from '../src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import {ensureDirectAccount} from '../src/account/direct-bootstrap.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const uid='release-route-'+Date.now().toString(36),buid=uid+'-b';await seed(uid,{hard:true});await seed(buid);
const liveRoot=`projects/${LIVE_PROJECT}/databases/(default)/documents`,live={...CLOUD,directActivation:DIRECT_READY};
const jwt=(uid,aud=LIVE_PROJECT)=>{const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return enc({alg:'none',typ:'JWT'})+'.'+enc({sub:uid,user_id:uid,aud,iss:'https://securetoken.google.com/'+aud,email:uid+'@example.invalid',email_verified:true,iat:Math.floor(Date.now()/1000)-10,exp:Math.floor(Date.now()/1000)+3600,auth_time:Math.floor(Date.now()/1000)-10,firebase:{identities:{},sign_in_provider:'password'}})+'.';};
const u={uid,email:uid+'@example.invalid',getIdToken:async()=>jwt(uid)},b={uid:buid,email:buid+'@example.invalid',getIdToken:async()=>jwt(buid)},auth={currentUser:u,authStateReady:async()=>{}};
const records=[];let lose=false,lost=false;
const local=async(url,o={})=>{
 assert(url.startsWith('https://firestore.googleapis.com/v1/'+liveRoot));assert(!url.includes('chatgpt.site'));
 if(o.body)assert(!o.body.includes(root));
 records.push({suffix:url.slice(('https://firestore.googleapis.com/v1/'+liveRoot).length),method:o.method||'GET'});
 const target=demo.firestoreEmulator+'/v1/'+root+url.slice(('https://firestore.googleapis.com/v1/'+liveRoot).length);
 assert(target.startsWith('http://127.0.0.1:'));
 const response=await fetch(target,{...o,...(o.body?{body:o.body.replaceAll(liveRoot,root)}:{})});
 const body=await response.text();
 if(lose&&!lost&&response.ok&&url.endsWith(':commit')){
  const proof=JSON.parse(o.body).writes?.map(w=>w.update?.fields&&decodeFields(w.update.fields)).find(d=>d?.row?.proof)?.row.proof;
  if(proof?.op==='hard_loot'){lost=true;throw Error('synthetic committed reply loss');}
 }
 return {ok:response.ok,status:response.status,json:async()=>JSON.parse(body.replaceAll(root,liveRoot))};
};
await assert.rejects(rest(`/hd3d_live/${uid}/hd3d_progress/${uid}`,null,await demoUser(uid).getIdToken(),'GET'),e=>e.status===403);
await assert.rejects(rest(`/hd3d_live/${uid}/hd3d_progress/${uid}`,null,jwt(uid,'wrong-project'),'GET'),e=>e.status===403);
await ensureDirectAccount(live,{auth,user:u,fetcher:local});
const make=()=>createDirectTransport(live,{auth,fetcher:local,random:()=>.7});let transport=make();
const rpc=(name,args={})=>transport({kind:'rpc',name:'hd3d_'+name,args},auth.currentUser).then(x=>x.data);
const beforeB=await get(buid,'progress');
const token='release-hard-token-'+Date.now().toString(36);assert((await rpc('growth_start',{p_id:token,p_mode:'campaign',p_hero:'fighter',p_partner:'mage',p_partyVersion:1,p_stage:'hard-1-1'})).ok);
const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');
const at=new Date(Date.now()-120000).toISOString();doc.fields.issuedAt={timestampValue:at};doc.fields.row.mapValue.fields.started_at={stringValue:at};delete doc.createTime;delete doc.updateTime;await rest(':commit',{writes:[{update:doc}]});
lose=true;await assert.rejects(rpc('growth_progress',{p_token:token,p_completed:10,p_win:true,p_finish:true,p_stars:3,p_kills:11}),/reply loss/);assert(lost);
auth.currentUser=b;assert((await rpc('growth_status')).ok);assert.deepEqual(await get(buid,'progress'),beforeB);
auth.currentUser=u;transport=make();const pending=await rpc('normal_pending');assert.equal(pending.length,1);assert.equal(pending[0].kind,'hard');assert((await rpc('growth_progress',{p_token:token,p_completed:pending[0].completed,p_win:pending[0].win,p_finish:true,p_stars:pending[0].stars,p_kills:pending[0].kills})).hardSaved);
const after=await get(uid,'progress'),save=authoritativeSave(after.cosmetic,after.authority);assert.equal(save.hardRewardSeq,1);assert.equal(save.stats.runs,1);assert.equal(save.stats.kills,11);
assert.deepEqual(await rpc('normal_pending'),[]);assert.deepEqual(await get(uid,'progress'),after);
// The app entry uses this same route, existing app name and persisted Auth identity.
const sdk={getApps:()=>[{name:'hero-defense-live',options:CLOUD.firebase}],getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:{},connectAuthEmulator(){throw Error('production cannot connect Auth emulator');}};
const cli=await createFirebaseClient(live,{sdk,fetch:local});assert.equal((await cli.auth.getSession()).data.session.user.id,uid);assert((await cli.rpc('hd3d_growth_status')).data.ok);
await fs.writeFile('../direct-firestore-evidence-22/release-rules-results.json',JSON.stringify({pass:true,liveNetwork:false,auth:'synthetic JWT/SDK',database:'loopback demo only',generatedRulesAudience:LIVE_PROJECT,checks:['wrong-project audiences denied','existing migrated account login','hard 2-hero start','hard loot committed response loss','account isolation','pending recovery','exact second reconnect','application client direct dispatch'],http:records.length,records,after},null,2));
console.log('PASS generated live audience Rules and live-profile paths under isolated redirect; hard lost response/account switch/recovery');
