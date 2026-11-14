import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {FirestoreTransport} from './support/firestore-transport.mjs';
import {empty} from '../src/account/progress.js';
import {initialGrowth} from '../src/data/hero-growth.js';
import {HARD_STAGES} from '../src/data/hard.js';
import {ROOT,toDocument} from '../server/firestore.mjs';
import {LIVE_ROOT,LIVE_ORIGIN,initialOwnerPlan} from '../server/live.mjs';
const require=createRequire(new URL('../cloud-functions/package.json',import.meta.url));
const {Compute}=require('google-auth-library');
const PROJECT='hero-defense-3d-independent';
function pair(op,token,origin=LIVE_ORIGIN,method='POST'){
 const req=Object.assign(new EventEmitter(),{method,headers:{origin,'content-type':'application/json',authorization:'Bearer '+token},rawBody:Buffer.from(JSON.stringify(op))});
 const res=Object.assign(new EventEmitter(),{headers:{},statusCode:200,
  status(n){this.statusCode=n;return this;},set(o){Object.assign(this.headers,o);return this;},setHeader(k,v){this.headers[k]=v;},
  end(s){this.body=s?.toString();this.writableFinished=this.writableEnded=true;this.emit('finish');this.emit('close');return this;},send(s){return this.end(s);}});
 return {req,res};
}
test('real Functions SDK: new namespace, rewards, response loss, CAS, admin and old-data isolation',async()=>{
 const original={fetch:globalThis.fetch,now:Date.now,access:Compute.prototype.getAccessToken,env:{}};
 for(const k of ['GCLOUD_PROJECT','K_SERVICE','FUNCTIONS_EMULATOR','HD3D_LIVE_ENABLED'])original.env[k]=process.env[k];
 let now=1800000000000;Date.now=()=>now;process.env.GCLOUD_PROJECT=PROJECT;process.env.K_SERVICE='isolated-live-functions';process.env.HD3D_LIVE_ENABLED='true';delete process.env.FUNCTIONS_EMULATOR;
 const {gameApi}=await import('../cloud-functions/index.mjs');
 let tokens=0;Compute.prototype.getAccessToken=async()=>{tokens++;return {token:'isolated-runtime-token'};};
 const a='live-a',b='live-b',owner='live-owner',stamp=()=>new Date(now).toISOString();
 const db=new FirestoreTransport({}, {latency:1,root:LIVE_ROOT});
 const legacy=toDocument('hd3d_progress',{user_id:a,data:{souls:987654},updated_at:stamp()});db.docs.set(legacy.name,structuredClone(legacy));
 const tokenFor=id=>'fake.'+Buffer.from(JSON.stringify({aud:PROJECT,iss:'https://securetoken.google.com/'+PROJECT,sub:id,iat:now/1000,exp:now/1000+3600})).toString('base64url')+'.not-signed';
 const email=id=>id===owner?'owner@example.invalid':id+'@example.invalid';
 globalThis.fetch=async(url,o)=>{
  const address=String(url);
  if(address.startsWith('https://identitytoolkit.googleapis.com/')){
   const id=JSON.parse(Buffer.from(JSON.parse(o.body).idToken.split('.')[1],'base64url')).sub;
   return Response.json({users:[{localId:id,email:email(id),createdAt:String(now)}]});
  }
  assert(address.startsWith('https://firestore.googleapis.com/v1/'+ROOT),address);assert.equal(o.headers.Authorization,'Bearer isolated-runtime-token');
  const path=address.split('/v1/')[1],body=JSON.parse(o.body);
  for(const n of [...(body.documents||[]),...(body.writes||[]).map(w=>w.update?.name||w.delete)])assert(n.startsWith(LIVE_ROOT+'/'),'legacy access: '+n);
  if(path.endsWith(':runQuery'))assert.equal(path,LIVE_ROOT+':runQuery');
  try{return Response.json(await db.request(o.method,path,body));}catch(e){return Response.json({error:{status:e.code||'UNAVAILABLE',message:e.message}},{status:e.status||503});}
 };
 const call=async(op,id=a,origin=LIVE_ORIGIN,method='POST')=>{
  const {req,res}=pair(op,tokenFor(id),origin,method);await gameApi(req,res);
  assert.equal(req.listenerCount('aborted'),0);assert.equal(res.listenerCount('close'),0);
  return {status:res.statusCode,...(res.body?JSON.parse(res.body):{})};
 };
 const rpc=(name,args={},id=a)=>call({kind:'rpc',name:'hd3d_'+name,args},id);
 const query=(table,action,filters={},values,returning=true)=>({kind:'query',table:'hd3d_'+table,action,filters,values,returning,columns:'*'});
 const measures={},measure=async(name,fn)=>{const i=db.calls.length,result=await fn(),calls=db.calls.slice(i);measures[name]={http:calls.length,documentReadRequests:calls.filter(c=>c.action==='batchGet').reduce((n,c)=>n+c.body.documents.length,0),queryRequests:calls.filter(c=>c.action==='runQuery').length,writeDocuments:calls.filter(c=>c.action==='commit').reduce((n,c)=>n+c.body.writes.length,0)};return result;};
 try{
  assert.equal((await call({},a,'https://attacker.invalid')).status,403);
  assert.equal((await call({},a,'https://legacy.example.invalid')).status,403);
  assert.equal((await call({},a,LIVE_ORIGIN,'OPTIONS')).status,204);
  for(const id of [a,b,owner])assert.equal((await rpc('my_status',{},id)).data.admin,false);
  assert.equal((await call(query('progress','select',{user_id:a}))).data.length,0);
  await measure('freshSave',async()=>{const r=await call(query('progress','insert',{}, {user_id:a,data:empty(),merged:true}));assert.equal(r.data[0].data.souls,0);});
  assert.equal((await call(query('progress','select',{user_id:a}),b)).data.length,0);
  assert.equal((await call(query('progress','update',{user_id:a,updated_at:stamp()},{data:empty(),merged:true}),b)).status,403);
  const before=structuredClone(db.rows('hd3d_progress')[0]);
  assert.deepEqual((await call(query('progress','update',{user_id:a,updated_at:'stale'},{data:{...empty(),souls:999},merged:true}))).data,[]);assert.deepEqual(db.rows('hd3d_progress')[0],before);
  await measure('warmRead',async()=>assert.equal((await call(query('progress','select',{user_id:a}))).data.length,1));
  await measure('normalStart',async()=>assert.equal((await rpc('growth_start',{p_id:'normal-live',p_mode:'campaign',p_stage:'1-1',p_hero:'mage'})).data.ok,true));
  now+=15000;const normal={p_token:'normal-live',p_completed:1,p_win:false,p_finish:true};
  const done=await measure('normalReward',()=>rpc('growth_progress',normal));assert.equal(done.data.xp,10);
  assert.equal((await rpc('growth_progress',normal)).data.already,true);assert.equal((await rpc('growth_progress',normal,b)).data.reason,'bad_token');
  const settlement={p_token:'normal-live',p_wave:1,p_kills:11,p_stars:0,p_drops:[],p_bossKills:[]};
  db.loseCommitResponse=true;
  assert.equal((await measure('normalSettlementLostResponse',()=>rpc('normal_settle',settlement))).status,503);
  const normalPaid=structuredClone(db.rows('hd3d_progress')[0]);assert.equal(normalPaid.data.souls,11);
  const normalRetry=await measure('normalSettlementRecovery',()=>Promise.all([rpc('normal_settle',settlement),rpc('normal_settle',settlement)]));
  assert(normalRetry.every(r=>r.data.already));assert.deepEqual(db.rows('hd3d_progress')[0],normalPaid);
  const forged=await call(query('progress','update',{user_id:a,updated_at:normalPaid.updated_at},{data:{...normalPaid.data,souls:777777},merged:true}));
  assert.equal(forged.error.code,'ECONOMY_ACTION_REQUIRED');assert.deepEqual(db.rows('hd3d_progress')[0],normalPaid);
  assert.equal((await rpc('normal_status',{p_token:'normal-live'},b)).status,403);
  // Isolated fixture progression only, never a production account.
  const save=empty();save.st={'10-6':3,'1-1':3};save.souls=1000;
  db.seed('hd3d_progress',{user_id:a,data:save,merged:true,updated_at:stamp()});db.seed('hd3d_growth_wallet',{...initialGrowth(save),user_id:a});
  const start=id=>({p_id:id,p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage',p_partner:'warrior',p_partyVersion:1});
  const finish=id=>({p_token:id,p_completed:HARD_STAGES['hard-1-1'].waves,p_win:true,p_finish:true,p_stars:3,p_kills:11});
  await measure('hardStart',async()=>{const s=await rpc('growth_start',start('hard-live'));assert.equal(s.data.ok,true);assert.deepEqual(s.data.party,['mage','warrior']);});
  now+=120000;db.loseCommitResponse=true;
  const lost=await measure('hardRewardLostResponse',()=>rpc('growth_progress',finish('hard-live')));assert.equal(lost.status,503);
  const paid=structuredClone(db.rows('hd3d_progress')[0].data),xp=db.rows('hd3d_growth_wallet')[0].earned;assert.equal(paid.hardRewardSeq,1);
  const retry=await measure('hardRecovery',()=>Promise.all([rpc('growth_progress',finish('hard-live')),rpc('growth_progress',finish('hard-live'))]));
  assert(retry.every(r=>r.data.already));assert.deepEqual(db.rows('hd3d_progress')[0].data,paid);assert.equal(db.rows('hd3d_growth_wallet')[0].earned,xp);
  assert.equal((await rpc('growth_start',start('hard-repeat'))).data.ok,true);now+=120000;
  const repeat=await rpc('growth_progress',finish('hard-repeat'));assert.equal(repeat.data.ok,true);assert.equal(repeat.data.hardReward.chests,Math.floor(HARD_STAGES['hard-1-1'].waves/5)+2);
  assert.equal((await rpc('growth_start',{...start('future'),p_stage:'hard-6-1'})).data.ok,false);
  assert.equal((await rpc('admin_users')).status,403);assert.equal((await rpc('owner_add_admin',{p_email:email(b)})).status,403);
  const plan=initialOwnerPlan({uid:owner,verifiedEmail:email(owner),at:stamp()});assert.equal(plan.writes[0].currentDocument.exists,false);
  for(const w of plan.writes){assert(!db.docs.has(w.update.name));db.docs.set(w.update.name,w.update);db.versions.set(w.update.name,1);}
  assert.equal((await rpc('is_owner',{},owner)).data,true);
  const order=await call(query('orders','insert',{}, {item:'hero_gunner'}));assert.equal(order.data.length,1);
  const approve=await rpc('admin_approve',{p_order_id:order.data[0].id},owner);assert.equal(approve.data.ok,true);
  assert.equal((await rpc('admin_approve',{p_order_id:order.data[0].id},owner)).data.reason,'not_pending');
  const mail=await rpc('claim_mail',{p_mail_id:approve.data.mail});assert.equal(mail.data.serverSaved,true);assert.equal(mail.data.reward,null);
  assert.equal((await rpc('claim_mail',{p_mail_id:approve.data.mail})).data.already,true);assert.equal(db.rows('hd3d_owned').filter(x=>x.user_id===a).length,1);
  assert.equal((await rpc('owner_add_admin',{p_email:email(b)},owner)).data.ok,true);assert.equal((await rpc('is_admin',{},b)).data,true);
  assert.equal((await rpc('owner_add_admin',{p_email:email(a)},b)).status,403);
  assert.equal((await rpc('owner_remove_admin',{p_email:email(b)},owner)).data.ok,true);assert.equal((await rpc('admin_users',{},b)).status,403);
  assert.equal((await rpc('admin_ban',{p_user:b,p_reason:'isolated test'},owner)).data.ok,true);
  assert.equal((await call(query('profiles','upsert',{}, {id:b,nickname:'blocked'}),b)).status,403);
  assert.equal((await rpc('admin_unban',{p_user:b,p_reason:'isolated test'},owner)).data.ok,true);
  assert.deepEqual(db.docs.get(legacy.name),legacy);assert.equal(db.txs.size,0);assert(tokens>0);
  console.log('LIVE_FUNCTIONS_COST_SAMPLE '+JSON.stringify(measures));
 }finally{
  globalThis.fetch=original.fetch;Date.now=original.now;Compute.prototype.getAccessToken=original.access;
  for(const [k,v]of Object.entries(original.env))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
