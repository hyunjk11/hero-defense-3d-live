import {stageCatalog,treeCatalog,itemCatalog,bootstrapTemplate} from '../direct/catalog.mjs';
import {assert,fs,seed,user,get,rest,config} from './emulator-harness.mjs';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import {directDocument,DEMO_PROJECT,decodeFields} from '../src/account/direct-store.js';
import {totalXP} from '../src/data/hero-growth.js';
const memory=new Map(),events=new Map(),locks=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.addEventListener=(k,f)=>events.set(k,[...(events.get(k)||[]),f]);
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request(k,fn){const p=(locks.get(k)||Promise.resolve()).then(fn);locks.set(k,p.catch(()=>{}));return p;}}},configurable:true});

await rest(':commit',{writes:[...stageCatalog(),...treeCatalog(),...itemCatalog(),bootstrapTemplate()].map(update=>({update}))});
const sessionMemory=new Map();globalThis.sessionStorage={getItem:k=>sessionMemory.get(k)??null,setItem:(k,v)=>sessionMemory.set(k,String(v)),removeItem:k=>sessionMemory.delete(k)};
const suffix=Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,5),uid='phase12-last-entry-'+suffix,uidB=uid+'-b',u=user(uid),b=user(uidB);await seed(uid);await seed(uidB);const bBefore=await get(uidB,'progress');
const auth={currentUser:u,authStateReady:async()=>{}};
const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,connectAuthEmulator:(a,url)=>a.emulatorConfig={url},setPersistence:async()=>{},browserLocalPersistence:{},onAuthStateChanged:()=>{},signOut:async()=>{auth.currentUser=null;},signInWithEmailAndPassword:async(a,email)=>{auth.currentUser=email===b.email?b:u;return {user:auth.currentUser};}};

const commits=[],losses=new Set(['spire_start','spire_finish']),lost=[];
const fetcher=async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){const env=JSON.parse(o.body).writes.filter(x=>x.update).map(x=>decodeFields(x.update.fields));const proof=env.find(x=>x.row.proof)?.row.proof;if(proof?.op?.startsWith('spire_')){commits.push({op:proof.op,request:proof.request,owner:env[0].owner});if(losses.has(proof.op)){losses.delete(proof.op);lost.push(proof.op);throw Error('independent lost '+proof.op+' response');}}}return r;};
const cli=await createFirebaseClient({...config,storageMode:'firestore-direct-prototype',authEmulator:'http://127.0.0.1:9199',authStorageKey:'audit10-spire-auth'},{sdk,fetch:fetcher});globalThis.window={__hd3dCloudMock:()=>cli};
const base=new URL('../src/account/',import.meta.url).href;const Acc=await import(base+'account.js'),HG=await import(base+'hero-growth.js'),Sp=await import(base+'spire.js'),Shop=await import(base+'shop.js');
await Acc.signIn(u.email,'fixture-only');await HG.refresh();const before=structuredClone(Acc.load());
const readRows=async table=>{const r=await cli.from('hd3d_'+table).select('*').eq('user_id',uid);assert.equal(r.error,null);return r.data;};

losses.clear();
for(let i=0;i<29;i++){const r=await cli.rpc('hd3d_spire_start',{p_id:crypto.randomUUID(),p_from:1,p_growth:1});assert(r.data.ok);}
assert.equal((await Sp.spStatus()).used,29);losses.add('spire_start');
const first=await Sp.spStart(1);assert(first.blocked&&first.pending);const all=await readRows('spire_runs'),active=all.filter(r=>r.status==='active');assert.equal(all.length,30);assert.equal(active.length,1);const originalToken=active[0].token;
const status=structuredClone(await Sp.spStatus());assert.equal(status.used,30);assert.equal(status.left,0);assert.equal(sessionMemory.size,0);
const journalKey=[...memory.keys()].find(k=>k.includes('_spire_entry_'));const journal=JSON.parse(memory.get(journalKey));assert(journal.request);
await Acc.signOut();await Acc.signIn(u.email,'fixture-only');await HG.refresh();await Sp.spStatus();
// Execute the unmodified paintGo function from the fixed UI source in a small
// DOM stub. This is a source/Node decision test, not a browser/pixel claim.
const source=await fs.readFile(new URL(base+'../ui/spire.js'),'utf8'),match=source.match(/function paintGo\(\) \{[^\n]+/);assert(match);
const button={disabled:false,textContent:''},paint=new Function('$','ranked','SS','departing','curFrom',match[0]+';return paintGo;');paint(()=>button,()=>Sp.SPS.st==='ok'&&!!Acc.A.user,Sp,false,()=>1)();assert.equal(button.disabled,false);assert.match(button.textContent,/입장 이어가기/);
const uiBefore=structuredClone(button);
await Acc.signOut();await Acc.signIn(b.email,'fixture-only');await HG.refresh();await Sp.spStatus();assert.equal(Sp.pendingDirectEntry(),null);await Acc.signOut();await Acc.signIn(u.email,'fixture-only');await HG.refresh();await Sp.spStatus();
// Account API control: same saved request CAN recover the already-paid entry.
const retried=await Promise.all([Sp.spStart(1),Sp.spStart(1)]);const recovered=retried.find(x=>x.mode==='ranked');assert(recovered);assert(retried.every(x=>x.mode==='ranked'||x.blocked));assert.equal(recovered.mode,'ranked');assert.equal(recovered.token,originalToken);assert.equal((await readRows('spire_runs')).length,30);assert.equal((await Sp.spStatus()).used,30);assert.equal(Sp.takeEntry(1).token,originalToken);
paint(()=>button,()=>Sp.SPS.st==='ok'&&!!Acc.A.user,Sp,false,()=>1)();assert.equal(button.disabled,true);
// Recovery remains enabled only for A's retained intent; expired server intent clears without charging.
const {CLOUD}=await import(base+'../config/cloud.js');memory.set(CLOUD.storagePrefix+'_spire_entry_'+uid,JSON.stringify(journal));
const env=await rest(`/hd3d_live/${uid}/hd3d_spire_runs/${active[0].id}`,null,'owner','GET');env.fields.issuedAt={timestampValue:new Date(Date.now()-4*3600000).toISOString()};env.fields.row.mapValue.fields.started_at={stringValue:new Date(Date.now()-4*3600000).toISOString()};await rest(':commit',{writes:[{update:{name:env.name,fields:env.fields}}]});
const expired=await Sp.spStart(1);assert.equal(expired.reason,'expired');assert.equal(Sp.pendingDirectEntry(),null);assert.equal((await Sp.spStatus()).used,30);
const result={uiBefore,expired,finding:'DF11-01',fixed:true,scope:'synthetic 29-entry setup and actual Account/Rules lost 30th response; exact UI paintGo code run with DOM stub, no browser',first,status,journal,active,button,recovered,apiControlSameToken:true,runCount:30,used:30,sourceFunction:match[0],impact:'Validated owner intent reopens last-entry recovery, same token/no extra charge; no-intent remains capped, expiry clears intent.'};
await fs.writeFile(new URL('../../direct-firestore-evidence-22/last-entry-ui-recovery.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await Acc.signOut();
