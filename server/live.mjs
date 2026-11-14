import {handleGameApi} from './http.mjs';
import {runEconomyOperation} from './economy.mjs';
import {FirestoreStore,ROOT,toDocument} from './firestore.mjs';
export const LIVE_NAMESPACE='hd3d_live_server/state';
export const LIVE_ROOT=ROOT+'/'+LIVE_NAMESPACE;
export const LIVE_ORIGIN='https://hyunjk11.github.io';
import {getPrivateOwnerEmail} from './common.mjs';
// Storage namespace is server-owned, never supplied by a request or URL.
export const liveStore=(request,timing,scope,signal)=>new FirestoreStore(request,timing,scope,{signal,namespace:LIVE_NAMESPACE});
export function liveHandler({request,enabled=false,verifyIdentity,origin=LIVE_ORIGIN}) {
  if(typeof request!=='function')throw new TypeError('Firestore transport required');
  return req=>{
    if(!enabled)return Promise.resolve(new Response(JSON.stringify({data:null,error:{code:'SERVICE_NOT_READY',message:'새 서버 연결을 준비 중입니다.'}}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}}));
    return handleGameApi(req,{}, {
      createStore:(timing,scope,signal)=>liveStore(request,timing,scope,signal),
      runOperation:runEconomyOperation,
      ...(verifyIdentity?{verifyIdentity}:{}),
      allowedOrigin:value=>value===origin?value:null
    });
  };
}
// Offline create-only plan. Never promotes a user on first login or trusts an email supplied by a client.
// Caller must independently verify the UID/email in Firebase Auth before applying this plan.
export function initialOwnerPlan({uid,verifiedEmail,at}) {
  const expectedOwner=getPrivateOwnerEmail();
  if(!expectedOwner||typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||verifiedEmail!==expectedOwner||!Number.isFinite(Date.parse(at)))throw new Error('Verified owner identity and timestamp required');
  const row={user_id:uid,owner:true,created_at:new Date(at).toISOString()};
  return {project:'hero-defense-3d-independent',database:'(default)',namespace:LIVE_NAMESPACE,oldDataReads:0,oldDataWrites:0,
    writes:[{update:toDocument('hd3d_admins',row,LIVE_ROOT),currentDocument:{exists:false}}],activationIncluded:false};
}
