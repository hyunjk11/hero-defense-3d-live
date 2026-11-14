import { FirestoreStore, PROJECT } from './firestore.mjs';
import { runOperation } from './operations.mjs';
import { NO_TIMING, requestTiming, timedJson, firestorePhase, errorKind } from './timing.mjs';
const authApiKey=()=>globalThis.process?.env?.HD3D_FIREBASE_WEB_API_KEY?.trim()||'';
const legacyOrigin=()=>globalThis.process?.env?.HD3D_LEGACY_ORIGIN||'';
const encoder=new TextEncoder(),credentialsCache=new Map(),identityCache=new Map(),userSyncScope={};
const encode64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json64=obj=>encode64(encoder.encode(JSON.stringify(obj)));
function parse64(s){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));}
async function serviceToken(serialized,timing=NO_TIMING,expectedServiceAccount){
  if(!serialized)throw Object.assign(new Error('Server is not configured'),{status:503});
  const key=typeof serialized==='string'?JSON.parse(serialized):serialized;
  if(typeof expectedServiceAccount!=='string'||!expectedServiceAccount.endsWith('@'+PROJECT+'.iam.gserviceaccount.com')||key.project_id!==PROJECT||key.client_email!==expectedServiceAccount)throw new Error('Wrong server credential');
  let cached=credentialsCache.get(key.private_key_id);
  if(cached?.token&&cached.expires>Date.now()+60000){timing.count('oauth_cache_hit');return cached.token;}
  if(cached?.pending){timing.count('oauth_shared_wait');return cached.pending;}
  timing.count('oauth_cache_miss');
  cached=cached||{};
  cached.pending=(async()=>{
    const seconds=Math.floor(Date.now()/1000),header=json64({alg:'RS256',typ:'JWT',kid:key.private_key_id}),payload=json64({iss:key.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+3600});
    const der=Uint8Array.from(atob(key.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
    const privateKey=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signature=await timing.measure('oauth.sign',()=>crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,encoder.encode(header+'.'+payload)));
    const {response,body}=await timedJson(timing,'oauth.token','https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:header+'.'+payload+'.'+encode64(new Uint8Array(signature))})});
    if(!response.ok||!body.access_token)throw Object.assign(new Error('Server credential rejected'),{status:503});
    cached.token=body.access_token;cached.expires=Date.now()+(body.expires_in||3600)*1000;return cached.token;
  })().finally(()=>{cached.pending=null;});credentialsCache.set(key.private_key_id,cached);return cached.pending;
}
export async function verifyIdentity(token,timing=NO_TIMING){
  if(typeof token!=='string'||token.length>16384)throw Object.assign(new Error('not authenticated'),{status:401});
  const apiKey=authApiKey();
  if(!apiKey)throw Object.assign(new Error('Authentication is not configured'),{status:503});
  const cacheKey=apiKey+'\0'+token;
  const cached=identityCache.get(cacheKey);if(cached&&cached.until>Date.now()){timing.count('auth_cache_hit');return cached.user;}
  timing.count('auth_cache_miss');
  let claims;try{claims=parse64(token.split('.')[1]);}catch{throw Object.assign(new Error('invalid token'),{status:401});}
  if(claims.aud!==PROJECT||claims.iss!=='https://securetoken.google.com/'+PROJECT||!claims.sub||claims.exp*1000<=Date.now()||claims.iat*1000>Date.now()+30000)throw Object.assign(new Error('invalid token'),{status:401});
  // Google's Auth endpoint validates the token signature, project, current account and disabled state.
  const {response,body:result}=await timedJson(timing,'auth.lookup','https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token})});
  const u=result.users?.[0];if(!response.ok||!u||u.disabled||u.localId!==claims.sub)throw Object.assign(new Error('not authenticated'),{status:401});
  const user={id:u.localId,email:u.email||'',created_at:u.createdAt?new Date(+u.createdAt).toISOString():null};
  if(identityCache.size>=200)identityCache.delete(identityCache.keys().next().value);identityCache.set(cacheKey,{until:Math.min(Date.now()+30000,claims.exp*1000),user});return user;
}
function allowedOrigin(origin){if(!origin)return null;if(origin===legacyOrigin())return origin;try{const url=new URL(origin);if(['localhost','127.0.0.1'].includes(url.hostname)&&['http:','https:'].includes(url.protocol))return origin;}catch{}return null;}
export function makeFirestoreRequest(env,timing=NO_TIMING,tokenProvider=null){return async(method,path,body,{signal}={})=>{
  signal?.throwIfAborted();
  const token=await timing.measure('oauth.wait',()=>tokenProvider?tokenProvider():serviceToken(env.HD3D_FIREBASE_SERVICE_ACCOUNT,timing,env.HD3D_RUNTIME_SERVICE_ACCOUNT||globalThis.process?.env?.HD3D_RUNTIME_SERVICE_ACCOUNT));
  signal?.throwIfAborted();
  const {response,body:result}=await timedJson(timing,firestorePhase(path),'https://firestore.googleapis.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),...(signal?{signal}:{})});
  if(!response.ok){const e=new Error(result.error?.message||'Database unavailable');e.status=response.status;e.code=result.error?.status||'DB_ERROR';throw e;}return result;
};}
export async function handleGameApi(request,env,dependencies={}){
  const origin=request.headers.get('origin'),accepted=(dependencies.allowedOrigin||allowedOrigin)(origin),headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin'};
  if(accepted){headers['access-control-allow-origin']=accepted;headers['access-control-allow-headers']='Authorization, Content-Type';headers['access-control-allow-methods']='POST, OPTIONS';}
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!accepted)return json({data:null,error:{code:'42501',message:'Origin not allowed'}},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json({data:null,error:{code:'METHOD',message:'POST required'}},405);
  const timing=requestTiming(request);let outcome='ok',finalStatus=200;
  try{
    if(+(request.headers.get('content-length')||0)>100000){outcome='rejected';finalStatus=413;return json({data:null,error:{code:'23514',message:'Request too large'}},413);}
    const raw=await timing.measure('request.body',()=>request.text());if(encoder.encode(raw).length>100000){outcome='rejected';finalStatus=413;return json({data:null,error:{code:'23514',message:'Request too large'}},413);}
    const op=JSON.parse(raw);timing.operation(op);const token=request.headers.get('authorization')?.match(/^Bearer ([^ ]+)$/)?.[1],user=await timing.measure('auth.verify',()=>(dependencies.verifyIdentity||verifyIdentity)(token,timing));
    const store=dependencies.store||dependencies.createStore?.(timing,userSyncScope,request.signal)||new FirestoreStore(makeFirestoreRequest(env,timing),timing,userSyncScope,{signal:request.signal});return json(await (dependencies.runOperation||runOperation)(store,user,op));
  }catch(e){outcome=errorKind(e);const status=e.status===401?401:e.code==='42501'?403:e.status===503?503:200;finalStatus=status;return json({data:null,error:{code:e.code||(status===401?'invalid_credentials':'BACKEND_ERROR'),message:e.code||status===401?String(e.message):'서버에 연결할 수 없습니다.'}},status);}
  finally{timing.finish(outcome,finalStatus);}
}
