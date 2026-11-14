// Actual Account/HG/settlement modules and local Rules, synthetic Auth/DOM only.
// This is not a browser or played battle. No real Firebase endpoint is allowed.
import {assert,fs,seed,user,get,rest,config} from './emulator-harness.mjs';
import {stageCatalog,treeCatalog,itemCatalog,bootstrapTemplate} from './catalog.mjs';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import {decodeFields} from '../src/account/direct-store.js';
import * as E from '../src/account/equip.js';
const memory=new Map(),session=new Map(),locks=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.sessionStorage={getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)};
globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request(k,fn){const p=(locks.get(k)||Promise.resolve()).then(fn);locks.set(k,p.catch(()=>{}));return p;}}},configurable:true});
await rest(':commit',{writes:[...stageCatalog(),...treeCatalog(),...itemCatalog(),bootstrapTemplate()].map(update=>({update}))});
const uid='challenge-client-'+Date.now().toString(36),u=user(uid),b=user(uid+'-b');await seed(uid);await seed(b.uid);
const auth={currentUser:u,authStateReady:async()=>{}},sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,connectAuthEmulator:(a,url)=>a.emulatorConfig={url},setPersistence:async()=>{},browserLocalPersistence:{},onAuthStateChanged:()=>{},signOut:async()=>{auth.currentUser=null;},signInWithEmailAndPassword:async(a,email)=>{auth.currentUser=email===b.email?b:u;return {user:auth.currentUser};}};
let lost=false;const commits=[];
const fetcher=async(url,o)=>{const res=await fetch(url,o);if(url.endsWith(':commit')&&res.ok){const e=JSON.parse(o.body).writes.filter(w=>w.update).map(w=>decodeFields(w.update.fields)),p=e.find(x=>x.row.proof)?.row.proof;
 if(p?.op?.startsWith('challenge_'))commits.push(p.op);
 if(p?.op==='challenge_loot'&&!lost){lost=true;throw Error('synthetic lost challenge loot response');}}
 return res;};
const cli=await createFirebaseClient({...config,storageMode:'firestore-direct-prototype',authEmulator:'http://127.0.0.1:9199',authStorageKey:'challenge-test-only'},{sdk,fetch:fetcher});globalThis.window={__hd3dCloudMock:()=>cli};
const Acc=await import('../src/account/account.js'),HG=await import('../src/account/hero-growth.js'),N=await import('../src/account/direct-normal-client.js');
await Acc.signIn(u.email,'fixture-only');await HG.refresh();const before=structuredClone(Acc.load()),beforeB=await get(b.uid,'progress');
const run=await HG.startRun(null,'mage');assert(run?.token);assert.equal(run.stage,null);
const d=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${run.token}`,null,'owner','GET');const aged=new Date(Date.now()-60000).toISOString();d.fields.issuedAt={timestampValue:aged};d.fields.row.mapValue.fields.started_at={stringValue:aged};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});
const item=E.makeItem('armor',null,1,()=>.4,1);item.id='client-boss';
const input={challenge:true,args:{p_token:run.token,p_wave:5,p_kills:50,p_stars:0,p_drops:[item],p_bossKills:[5]},checkpoint:{run,completed:5,win:false,stars:0}};
await assert.rejects(N.runDirectNormal(input),/synthetic lost/);assert(lost);assert.equal(Acc.saveAllowed(),false);assert.equal((await get(uid,'progress')).authority.gear.chests.length,1);
await Acc.signOut();await Acc.signIn(b.email,'fixture-only');await HG.refresh();assert.deepEqual((await get(b.uid,'progress')).authority,beforeB.authority);
await Acc.signOut();await Acc.signIn(u.email,'fixture-only');await HG.refresh();
// Reconnect invokes the product recovery listener; it uses the retained token.
for(let n=0;n<200&&(Acc.serverSaveState()||[...memory.keys()].some(k=>k.includes('_direct_normal_')));n++)await new Promise(r=>setTimeout(r,50));
assert.equal(Acc.serverSaveState(),null);assert.equal(Acc.saveAllowed(),true);assert.equal(HG.HG.pending,0);
const after=structuredClone(Acc.load()),wallet=await get(uid,'growth_wallet');assert.equal(after.souls,before.souls+56);assert.equal(after.bestWave,5);assert.equal(after.stats.runs,1);assert.equal(after.stats.kills,50);assert.equal(after.chests.length,2);assert.equal(after.chests.at(-1).it.id,item.id);
assert.equal(commits.filter(x=>x==='challenge_settle').length,1);assert.equal(commits.filter(x=>x==='challenge_loot').length,2);assert(wallet.earned>0);
await Acc.signOut();await Acc.signIn(u.email,'fixture-only');await HG.refresh();assert.deepEqual(Acc.load(),after);assert.deepEqual(await get(uid,'growth_wallet'),wallet);assert.equal(Acc.serverSaveState(),null);
await fs.writeFile('../direct-firestore-evidence-22/challenge-client-integration.json',JSON.stringify({scope:'actual product Account/HG/settlement plus real local Rules; synthetic Auth/DOM, timestamp-aged run, not browser/gameplay',pass:true,checks:['challenge-start','XP-checkpoint','loot-response-loss','purchase-guard','account-isolation','reconnect-auto-recovery','exact-second-reload','no-duplicate-receipts'],commits,before,after,wallet,pending:HG.HG.pending,guard:Acc.serverSaveState()},null,2));
console.log('PASS actual Account/HG challenge start -> lost loot response -> account switch -> automatic recovery -> exact reconnect');await Acc.signOut();
