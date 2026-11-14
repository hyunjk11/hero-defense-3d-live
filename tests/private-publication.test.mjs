import test from 'node:test';
import assert from 'node:assert/strict';
import {context,getPrivateOwnerEmail} from '../server/common.mjs';
import {initialOwnerPlan} from '../server/live.mjs';
import {RUNTIME_SERVICE_ACCOUNT,OWNER_EMAIL_CONFIG,AUTH_API_KEY_CONFIG,GAME_API_OPTIONS} from '../cloud-functions/options.mjs';

const owner='owner@example.invalid';
function txFor(row,ban=null){return {get:async(table,id)=>table==='hd3d_admins'?row:table==='hd3d_bans'?ban:null};}
test('private owner matching retains UID row, verified email and ban checks',async()=>{
 const original=process.env.HD3D_OWNER_EMAIL;
 try{
  process.env.HD3D_OWNER_EMAIL=owner;
  for(const [row,email,ban,allowed] of [[{owner:true},owner,null,true],[{owner:true},'outsider@example.invalid',null,false],[null,owner,null,false],[{owner:true},owner,{},false],[{owner:false},'admin@example.invalid',null,true]]){
   const c=await context(txFor(row,ban),{id:'fixture-uid',email});assert.equal(c.admin,allowed);
   assert.equal(c.owner,allowed&&!!row?.owner);
  }
  const before=initialOwnerPlan({uid:'fixture-uid',verifiedEmail:owner,at:'2026-11-13T00:00:00Z'});
  assert.equal(before.writes.length,1);assert.deepEqual(before.writes[0].currentDocument,{exists:false});assert.equal(before.activationIncluded,false);
  for(const value of [undefined,'',' ', 'bad-address',owner+'\n']){
   if(value===undefined)delete process.env.HD3D_OWNER_EMAIL;else process.env.HD3D_OWNER_EMAIL=value;
   assert.equal(getPrivateOwnerEmail(),'');
   const c=await context(txFor({owner:true}),{id:'fixture-uid',email:owner},{ownerEmail:owner});assert.equal(c.owner,false);
   assert.throws(()=>initialOwnerPlan({uid:'fixture-uid',verifiedEmail:owner,at:'2026-11-13T00:00:00Z'}));
   assert.throws(()=>initialOwnerPlan({uid:'fixture-uid',verifiedEmail:'',at:'2026-11-13T00:00:00Z'}));
  }
 }finally{if(original===undefined)delete process.env.HD3D_OWNER_EMAIL;else process.env.HD3D_OWNER_EMAIL=original;}
});
test('deployment binds the required private runtime identity without a default account',()=>{
 assert.equal(RUNTIME_SERVICE_ACCOUNT.name,'HD3D_RUNTIME_SERVICE_ACCOUNT');
 assert.equal(OWNER_EMAIL_CONFIG.name,'HD3D_OWNER_EMAIL');
 assert.equal(AUTH_API_KEY_CONFIG.name,'HD3D_FIREBASE_WEB_API_KEY');
 assert.equal(AUTH_API_KEY_CONFIG.options?.default,undefined);
 assert.equal(GAME_API_OPTIONS.serviceAccount,RUNTIME_SERVICE_ACCOUNT);
 assert.equal(RUNTIME_SERVICE_ACCOUNT.options?.default,undefined);
 assert.equal(OWNER_EMAIL_CONFIG.options?.default,undefined);
 assert.equal(GAME_API_OPTIONS.minInstances,0);assert.equal(GAME_API_OPTIONS.maxInstances,1);
 assert.equal(GAME_API_OPTIONS.cors,false);
});
test('administrator UI follows server status without exposing or guessing an email',async()=>{
 const before={addEventListener:globalThis.addEventListener,document:globalThis.document};
 globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){}};
 try{
  const {A}=await import('../src/account/account.js');
  const {S,isAdminUI,isOwnerUI}=await import('../src/account/shop.js');
  const {ADMIN_EMAIL}=await import('../src/config/shop.js');assert.equal(ADMIN_EMAIL,'');
  const oldUser=A.user,oldStatus=S.me;
  try{
   A.user={id:'fixture-owner',email:owner};
   for(const st of ['idle','loading','error','missing']){S.me={st,admin:false,owner:false};assert.equal(isAdminUI(),false);}
   S.me={st:'ok',admin:true,owner:true};assert.equal(isAdminUI(),true);assert.equal(isOwnerUI(),true);
   A.user={id:'fixture-other',email:'other@example.invalid'};S.me={st:'ok',admin:false,owner:false};assert.equal(isAdminUI(),false);
   A.user=null;S.me={st:'ok',admin:true,owner:true};assert.equal(isAdminUI(),false);assert.equal(isOwnerUI(),false);
  }finally{A.user=oldUser;S.me=oldStatus;}
 }finally{for(const [k,v]of Object.entries(before))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});

test('server Auth key is private and missing configuration cannot use a cached identity',async()=>{
 const {verifyIdentity}=await import('../server/http.mjs');
 const oldKey=process.env.HD3D_FIREBASE_WEB_API_KEY,oldFetch=globalThis.fetch;let calls=0;
 const now=Math.floor(Date.now()/1000);const token='header.'+Buffer.from(JSON.stringify({aud:'hero-defense-3d-independent',iss:'https://securetoken.google.com/hero-defense-3d-independent',sub:'key-fixture-user',iat:now,exp:now+600})).toString('base64url')+'.signature';
 globalThis.fetch=async(url)=>{calls++;assert.equal(new URL(url).searchParams.get('key'),process.env.HD3D_FIREBASE_WEB_API_KEY);return new Response(JSON.stringify({users:[{localId:'key-fixture-user',email:'fixture@example.invalid'}]}),{status:200});};
 try{
  process.env.HD3D_FIREBASE_WEB_API_KEY='fixture-auth-api-key';assert.equal((await verifyIdentity(token)).id,'key-fixture-user');assert.equal(calls,1);
  assert.equal((await verifyIdentity(token)).id,'key-fixture-user');assert.equal(calls,1);
  delete process.env.HD3D_FIREBASE_WEB_API_KEY;await assert.rejects(()=>verifyIdentity(token),e=>e.status===503);assert.equal(calls,1);
  process.env.HD3D_FIREBASE_WEB_API_KEY='second-fixture-key';assert.equal((await verifyIdentity(token)).id,'key-fixture-user');assert.equal(calls,2);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.HD3D_FIREBASE_WEB_API_KEY;else process.env.HD3D_FIREBASE_WEB_API_KEY=oldKey;}
});
