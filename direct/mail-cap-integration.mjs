import {assert,fs,seed,user,get,rest,config} from './emulator-harness.mjs';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import {directDocument,DEMO_PROJECT,decodeFields} from '../src/account/direct-store.js';
import {totalXP} from '../src/data/hero-growth.js';
const memory=new Map(),events=new Map(),locks=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.addEventListener=(k,f)=>events.set(k,[...(events.get(k)||[]),f]);
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request(k,fn){const p=(locks.get(k)||Promise.resolve()).then(fn);locks.set(k,p.catch(()=>{}));return p;}}},configurable:true});
const mode=process.env.AUDIT10_MAIL_MODE||'success';
const suffix=Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,6),uid='audit9-mail-'+mode+'-'+suffix,uidB='audit9-mail-other-'+suffix,u=user(uid),b=user(uidB),fixture=await seed(uid);await seed(uidB);const bBefore=await get(uidB,'progress');
const {authoritativeSave}=await import('../src/account/direct-authority.js');
const E=await import('../src/account/equip.js');
const s=fixture.save;s.keepLegacy={text:'mail audit'};s.research.arrow={atk:0,rng:0,spd:0,start:1};s.souls=mode!=='success'?1000000000:1000;
const oldItem=E.makeItem('armor',undefined,1,()=>.2,1);oldItem.id='audit9-old-item';s.chests=[E.chestOf(oldItem,'chest')];
const p=await get(uid,'progress'),iso=new Date().toISOString();
await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:s,merged:true,created_at:p.created_at,updated_at:p.updated_at})},{update:directDocument(DEMO_PROJECT,uid,'hd3d_dungeon_wallet',uid,{user_id:uid,medals:200,earned:200,spent:0,titles:[],uniques:['existing'],uq_pity:2,updated_at:iso})}]});
if(mode!=='success')await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_mail',7007,{id:7007,user_id:uid,title:'synthetic cap boundary',body:'test',reward:{souls:1,items:[{k:'gear',s:'armor',g:0,c:1}]},claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:null,created_at:iso})}]});
// Historical partial grant is an explicit local fixture, never a product grant.
if(mode==='partial'){
 const {packTypedItem}=await import('../src/account/direct-gear.js');
 const {mailItemId}=await import('../src/account/direct-mail-items.js');
 const it=E.makeItem('armor',undefined,0,()=>.2,1);it.id='historical-item';
 const [entry]=E.addChests(s,[{it,src:'chest'}]);const typed=packTypedItem(it),id=mailItemId(uid,7007,0);
 await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:s,merged:true,created_at:p.created_at,updated_at:p.updated_at})},
  {update:directDocument(DEMO_PROJECT,uid,'hd3d_growth_investments',id,{id,user_id:uid,body:JSON.stringify({k:'gear',s:'armor',g:0,c:1}),at:iso,result:{action:'mail_item',mail:7007,index:0,it:typed,entry:{...entry,it:typed}}})}]});
}
const auth={currentUser:u,authStateReady:async()=>{}};
const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,connectAuthEmulator:(a,url)=>a.emulatorConfig={url},setPersistence:async()=>{},browserLocalPersistence:{},onAuthStateChanged:()=>{},signOut:async()=>{auth.currentUser=null;},signInWithEmailAndPassword:async(a,email)=>{auth.currentUser=email===b.email?b:u;return {user:auth.currentUser};}};

const commits=[],lost=[],losses=new Set(mode==='success'?['dungeon_buy','mail_item','claim_mail']:[]);
const fetcher=async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){const env=JSON.parse(o.body).writes.filter(x=>x.update).map(x=>decodeFields(x.update.fields));const proof=env.find(x=>x.row.proof)?.row.proof;
 if(['dungeon_buy','mail_item','claim_mail'].includes(proof?.op)){commits.push({op:proof.op,owner:env[0].owner});if(losses.has(proof.op)){losses.delete(proof.op);lost.push(proof.op);throw Error('independent mail response loss');}}}return r;};
const cli=await createFirebaseClient({...config,storageMode:'firestore-direct-prototype',authEmulator:'http://127.0.0.1:9199',authStorageKey:'audit9-mail-auth'},{sdk,fetch:fetcher});globalThis.window={__hd3dCloudMock:()=>cli};
const base=new URL('../src/account/',import.meta.url).href;const Acc=await import(base+'account.js'),Gear=await import(base+'direct-gear-client.js'),Shop=await import(base+'shop.js'),DG=await import(base+'dungeon.js');
await Acc.signIn(u.email,'fixture-only');await Shop.refresh();
const delay=()=>new Promise(r=>setTimeout(r,25));const waitFor=async(fn,label)=>{for(let i=0;i<240;i++){if(fn())return;await delay();}throw Error('timeout '+label);};
const back=async email=>{await Acc.signOut();await Acc.signIn(email,'fixture-only');};
let result;
if(mode==='success'){
 const pair=await Promise.all([DG.dgBuy('dg_morvia_mage'),DG.dgBuy('dg_morvia_mage')]);assert.ok(pair.every(x=>!x.ok));assert.equal(commits.length,1);assert.ok(Gear.pendingGear());
 await back(b.email);await new Promise(r=>setTimeout(r,150));assert.equal(Gear.pendingGear(),null);assert.deepEqual((await get(uidB,'progress')).authority,bBefore.authority);assert.equal(commits.length,1);
 await back(u.email);await waitFor(()=>!Gear.pendingGear()&&!Acc.serverSaveState(),'buy recovery');await Shop.refresh();const mails=Shop.S.mail.filter(x=>!x.claimed);assert.equal(mails.length,1);const mid=mails[0].id;assert.equal((await get(uid,'dungeon_wallet')).medals,155);
 const first=await Shop.claim(mid);assert.equal(first.pending,true);assert.deepEqual(Shop.pendingClaims(),[mid]);assert.ok(Acc.serverSaveState());assert.equal((await get(uid,'mail',mid)).claimed,false);
 const partial=structuredClone({save:Acc.load(),guard:Acc.serverSaveState(),pending:Shop.pendingClaims(),raw:(await get(uid,'progress')).authority});
 await back(b.email);await new Promise(r=>setTimeout(r,150));assert.deepEqual(Shop.pendingClaims(),[]);assert.deepEqual((await get(uidB,'progress')).authority,bBefore.authority);assert.equal(lost.length,2);
 await back(u.email);await waitFor(()=>lost.length===3,'final mail lost reply');await waitFor(()=>!Acc.serverSaveState()?.busy,'mail idle');assert.equal((await get(uid,'mail',mid)).claimed,true);
 await back(u.email);await waitFor(()=>!Shop.pendingClaims().length&&!Acc.serverSaveState(),'mail complete');
 assert.equal(commits.length,3);assert.equal(Acc.load().chests.length,2);assert.deepEqual(Acc.load().chests[0],s.chests[0]);assert.equal(Acc.load().souls,1000);const grant=Acc.load().chests[1];assert.equal(grant.it.set,'morvia');assert.equal(grant.it.h,'mage');assert.deepEqual(Acc.load().codex,s.codex);
 await Gear.runDirectGear([{p_action:'open',p_item:grant.id}]);const after=structuredClone(Acc.load());assert.equal(after.inv.length,1);assert.deepEqual(after.chests,s.chests);assert.deepEqual(after.codex,s.codex);await back(u.email);assert.deepEqual(Acc.load(),after);assert.deepEqual((await get(uidB,'progress')).authority,bBefore.authority);
 const raw=authoritativeSave((await get(uid,'progress')).cosmetic,(await get(uid,'progress')).authority);assert.deepEqual(raw.keepLegacy,s.keepLegacy);assert.equal(raw.research.arrow.start,1);assert.ok(!Object.hasOwn(raw.research.arrow,'efficiency'));
 result={pass:true,mode,uid,scope:'Real Account/Gear/DG/Shop + actual isolated Rules; synthetic Node Auth/DOM/storage; no browser claim',commits,lost,pair,first,partial,after,otherAccountUnchanged:true,rawLegacyPreserved:true,exactReload:true};
}else{
 if(mode==='partial'){const j=Acc.beginServerSave('mail:7007');Acc.markServerSave(j);Acc.finishServerSave(j,false);memory.set('hd3d_live_mailpend_'+uid,'[7007]');}
 const before=await get(uid,'progress'),first=await Shop.claim(7007);
 assert.equal(first.deferred,true);assert.equal(first.pending,false);assert.deepEqual(Shop.pendingClaims(),[]);assert.equal(Acc.serverSaveState(),null);
 assert.deepEqual((await get(uid,'progress')).authority,before.authority);assert.equal((await get(uid,'mail',7007)).claimed,false);
 assert.equal(commits.length,0);await back(u.email);await new Promise(r=>setTimeout(r,150));assert.deepEqual(Shop.pendingClaims(),[]);assert.equal(Acc.serverSaveState(),null);
 // Actual permanent-training save clears capacity, not a synthetic debit.
 Acc.update(d=>{d.heroLv.mage.hp++;d.souls-=30;return d;});assert.equal(await Acc.flush(),true);
 const second=await Shop.claim(7007);assert(second.ok);assert.equal(Acc.load().souls,999999971);assert.equal(Acc.load().heroLv.mage.hp,1);
 assert.equal(Acc.load().chests.length,2);assert.deepEqual(Acc.load().chests[0],s.chests[0]);assert.equal((await get(uid,'mail',7007)).claimed,true);
 assert.equal(commits.filter(x=>x.op==='mail_item').length,mode==='partial'?0:1);assert.equal(commits.filter(x=>x.op==='claim_mail').length,1);
 const after=structuredClone(Acc.load());await back(b.email);assert.deepEqual((await get(uidB,'progress')).authority,bBefore.authority);await back(u.email);assert.deepEqual(Acc.load(),after);
 assert.deepEqual(Shop.pendingClaims(),[]);assert.equal(Acc.serverSaveState(),null);await Shop.claim(7007);assert.deepEqual(Acc.load(),after);
 result={pass:true,mode,uid,scope:'Actual Account/Shop/Firebase adapter/Rules; synthetic Auth/DOM, historical partial fixture only in partial mode',first,second,commits,after,pending:Shop.pendingClaims(),guard:Acc.serverSaveState(),otherAccountUnchanged:true};
}
await fs.writeFile(new URL('../../direct-firestore-evidence-10/mail-journal-'+mode+'.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({mode,pass:result.pass,commits,lost,first:result.first,pending:result.afterReload?.pending,blocked:result.blocked}));await Acc.signOut();
