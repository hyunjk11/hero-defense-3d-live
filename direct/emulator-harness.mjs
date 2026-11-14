import {testHost} from './test-endpoint.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createDirectTransport,DEMO_PROJECT,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {convertAccount} from './migration.mjs';
import {toDocument,numericTables} from '../server/firestore.mjs';
import {empty,clean} from '../src/account/progress.js';
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
 save.codex={'1':{mage:1}};
 const growth=initialGrowth(save);growth.granted=balance;growth.balance=balance;if(hard)growth.hard={st:{'hard-1-1':3}};
 const iso='2026-01-01T00:00:00.000Z';const source=[legacy('progress',{user_id:uid,data:save,merged:true,created_at:iso,updated_at:iso}),legacy('profiles',{id:uid,nickname:'Test',created_at:iso,updated_at:iso}),legacy('growth_wallet',{user_id:uid,...growth}),legacy('owned',{user_id:uid,item:'hero_fighter'}),legacy('mail',{id:900,user_id:uid,title:'old',body:'old',reward:{souls:1},claimed:true,claimed_at:iso,revoked:false,order_id:null,broadcast_id:null,created_at:iso})];
 const docs=convertAccount(uid,source,{sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,5000]))});await rest(':commit',{writes:docs.map(update=>({update}))});return {source,docs,save,growth};
}
function client(uid,{fetcher=fetch}={}){const u=user(uid),auth={currentUser:u};let now=Date.now();const transport=createDirectTransport(config,{auth,fetcher,clock:()=>now,random:()=>.7});return {u,auth,setNow:x=>now=x,rpc:(name,args={})=>transport({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data),query:q=>transport({kind:'query',...q},u),transport};}
async function get(uid,table,id=uid){const r=await rest(`/hd3d_live/${uid}/hd3d_${table}/${id}`,null,'owner','GET');return decodeFields(r.fields).row;}
async function deniedWrite(uid,writes){await assert.rejects(rest(':commit',{writes},await user(uid).getIdToken()),e=>e.status===403);}
const raw=(uid,table,id,row,revision)=>({name:`${root}/hd3d_live/${uid}/hd3d_${table}/${id}`,fields:encodeFields({owner:uid,version:1,row,commitRevision:revision})});
function commit(uid,table,id,row,revision){return [{update:raw(uid,table,id,row,revision)},{update:raw(uid,'sequences','_revision',{id:'_revision',value:revision,proof:{op:'save',request:'',token:'',hero:'',level:0,stat:''}},revision)}];}

// Phase 4 keeps browser QA state. This harness uses its existing fixture UIDs;
// reset is explicit test setup, never an import side effect.


export {assert,fs,host,root,config,test,rows,user,rest,seed,client,get,deniedWrite,raw,commit};
