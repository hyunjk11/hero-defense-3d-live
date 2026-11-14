// Real account/adapter paths, isolated MemoryStore; no SDK/network/real account.
import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import {CLOUD} from '../src/config/cloud.js';
import {MemoryStore} from '../server/memory-store.mjs';
import {execute} from '../server/operations.mjs';
import {createFirebaseClient} from '../src/account/firebase-client.js';
const values=new Map(),events=new Map(),K=CLOUD.storagePrefix;
let blocked='',failProfile=false,failProgress=false,lostProfile=false,holdProfile=null,clock=Date.parse('2026-11-11'),serial=0;
const calls=[];
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem(k,v){if(k===blocked)throw Error('quota');values.set(k,String(v));},removeItem:k=>values.delete(k)};
globalThis.addEventListener=(k,f)=>events.set(k,[...(events.get(k)||[]),f]);
globalThis.document={addEventListener(){},visibilityState:'visible'};
globalThis.location={hostname:'localhost',search:''};
const realTimer=setTimeout;globalThis.setTimeout=(...a)=>{const t=realTimer(...a);t.unref();return t;};
const memory=new MemoryStore({hd3d_profiles:['a','b'].map(id=>({id,nickname:id})),hd3d_progress:['a','b'].map(id=>({user_id:id,data:{...P.empty(),nick:id,souls:id==='a'?11:0},merged:true,updated_at:new Date(clock).toISOString()}))});
const auth={currentUser:null,authStateReady:async()=>{}};
const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:'mock',onAuthStateChanged:()=>()=>{},signInWithEmailAndPassword:async(_,email)=>{auth.currentUser={uid:email.split('@')[0],email,getIdToken:async()=> 'mock'};return {user:auth.currentUser};},signOut:async()=>{auth.currentUser=null;}};
const fetcher=async(_,options)=>{
 const op=JSON.parse(options.body),user={id:auth.currentUser.uid,email:auth.currentUser.email};
 const profile=op.table==='hd3d_profiles'&&op.action==='upsert',progress=op.table==='hd3d_progress'&&op.action!=='select';
 if(profile||progress)calls.push({uid:user.id,kind:profile?'profile':'progress',nick:profile?op.values.nickname:op.values.data.nick});
 if(profile&&holdProfile){const f=holdProfile;holdProfile=null;await f();}
 if(profile&&failProfile||progress&&failProgress)throw Error('offline fixture');
 let result;try{result=await memory.transaction(tx=>execute(tx,user,op,{now:++clock}));}catch(e){result={data:null,error:{code:e.code,message:e.message}};}
 if(profile&&lostProfile){lostProfile=false;throw Error('profile commit response lost');}
 return new Response(JSON.stringify(result));
};
globalThis.window={__hd3dCloudMock:config=>createFirebaseClient({...config,storageMode:'worker',apiUrl:'https://mock.invalid/api/game'},{sdk,fetch:fetcher})};
let Acc=await import(process.argv.includes('--baseline')?'../../candidate-direct-fresh-live-3/src/account/account.js':'../src/account/account.js');
const profile=id=>memory.tables.hd3d_profiles.find(r=>r.id===id),progress=id=>memory.tables.hd3d_progress.find(r=>r.user_id===id);
const login=id=>Acc.signIn(id+'@example.invalid','unused');
const pass=s=>console.log('PASS '+s);
const reload=async()=>{await Acc.signOut();Acc=await import('../src/account/account.js?nick-restart='+ ++serial);await login('a');};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
Acc.store(P.empty(),{cloud:false});await login('a');
try{
 failProfile=true;await Acc.saveNick('Offline A');await Acc.flush();
 assert.notEqual(Acc.A.sync,'saved','FA-01: failed profile must not be acknowledged as saved');
 assert.equal(profile('a').nickname,'a');assert.equal(Acc.load().nick,'Offline A');pass('profile failure stays pending, not false saved');
 await Acc.signOut();await login('b');assert.equal(Acc.load().nick,'b');assert.equal(Acc.load().souls,0);await Acc.signOut();
 failProfile=false;await login('a');await Acc.flush();assert.equal(profile('a').nickname,'Offline A');assert.equal(progress('a').data.nick,'Offline A');pass('offline logout A-B-A preserves account intent');
 failProfile=true;await Acc.saveNick('Reload A');await reload();assert.equal(Acc.load().nick,'Reload A');assert.notEqual(Acc.A.sync,'saved');
 failProfile=false;await Acc.flush();await reload();assert.equal(Acc.load().nick,'Reload A');pass('module reload retains nickname until confirmed');
 lostProfile=true;await Acc.saveNick('Lost reply');assert.notEqual(Acc.A.sync,'saved');assert.equal(profile('a').nickname,'Lost reply');await Acc.flush();await reload();assert.equal(Acc.load().nick,'Lost reply');pass('lost profile response retries idempotently');
 failProgress=true;await Acc.saveNick('Partial');assert.equal(profile('a').nickname,'Partial');assert.notEqual(Acc.A.sync,'saved');
 failProgress=false;await reload();assert.equal(Acc.load().nick,'Partial');assert.equal(progress('a').data.nick,'Partial');pass('profile success / progress failure resumes');
 const start=deferred(),release=deferred();holdProfile=()=>{start.resolve();return release.promise;};
 const old=Acc.saveNick('Old edit');await start.promise;const newer=Acc.saveNick('Latest edit');release.resolve();await Promise.all([old,newer]);await Acc.flush();
 assert.equal(profile('a').nickname,'Latest edit');assert.equal(progress('a').data.nick,'Latest edit');pass('rapid edits serialize with latest intent');
 const oldCalls=calls.filter(c=>c.kind==='profile').length;Acc.update(s=>({...s,settings:{...s.settings,quality:'low'}}));await Acc.flush();assert.equal(calls.filter(c=>c.kind==='profile').length,oldCalls);pass('ordinary save adds no profile write');
 const before=Acc.load().nick,priorCalls=calls.length;blocked=K+'_nick_pending_a';await assert.rejects(Acc.saveNick('Quota'),/저장|기기/);blocked='';assert.equal(calls.length,priorCalls);assert.equal(Acc.load().nick,before);pass('local journal quota prevents untracked network write');
 const guard=Acc.beginServerSave('fixture');await assert.rejects(Acc.saveNick('Blocked'),/저장/);Acc.finishServerSave(guard,true);assert.equal(Acc.load().nick,before);pass('settlement guard preserved');
 const lateStart=deferred(),lateRelease=deferred();holdProfile=()=>{lateStart.resolve();return lateRelease.promise;};const late=Acc.saveNick('Late A');await lateStart.promise;
 await Acc.signOut();await login('b');await Acc.saveNick('Only B');lateRelease.resolve();await late;await Acc.flush();assert.equal(Acc.load().nick,'Only B');assert.equal(profile('b').nickname,'Only B');
 await Acc.signOut();await login('a');await Acc.flush();assert.equal(profile('a').nickname,'Late A');assert.equal(Acc.load().souls,11);pass('delayed A response cannot affect B');
 failProfile=true;await Acc.saveNick('Discard me');await Acc.signOut();
 progress('a').data.nick='Other device';progress('a').updated_at=new Date(++clock).toISOString();profile('a').nickname='Other device';failProfile=false;
 await login('a');assert.equal(Acc.A.sync,'conflict');await Acc.resolveConflict('cloud');await Acc.flush();await reload();assert.equal(Acc.load().nick,'Other device');assert.equal(profile('a').nickname,'Other device');pass('explicit cloud choice discards pending nickname');
 assert.equal(Acc.load().souls,11);assert.equal(progress('b').data.souls,0);pass('economic balances unchanged');
}finally{blocked='';failProfile=false;failProgress=false;await Acc.signOut();}
