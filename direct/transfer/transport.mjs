// Operator-only REST adapter. No CLI login, ADC/config discovery or credential storage.
import {PROJECT,ROOT} from '../../server/firestore.mjs';
import {directRoot} from '../global-migration-plan.mjs';
import {normalizeLegacyTimestamp} from '../legacy-timestamp.mjs';
const fail=s=>{throw Error(s);};
const time=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(s)&&Number.isFinite(Date.parse(s));
export function snapshotTimeParts(value){
 if(!time(value))fail('Invalid snapshot timestamp');
 const canonical=normalizeLegacyTimestamp(value),m=canonical.match(/^(.*?)(?:\.(\d+))?Z$/);
 const seconds=Math.floor(Date.parse(m[1]+'Z')/1000),nanos=Number((m[2]||'').padEnd(9,'0'));
 if(!Number.isSafeInteger(seconds)||nanos%1000)fail('Snapshot timestamp must have microsecond precision');
 return {seconds:String(seconds),nanos:String(nanos)};
}
export function firestoreStore({project=PROJECT,endpoint='https://firestore.googleapis.com',token,fetcher=fetch,allowWrites=false,timeoutMs=30000,maxCalls=100000,maxDocuments=100000,maxDepth=20}={}){
 const demo=project==='demo-hd3d-direct';
 if(demo?!/^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.test(endpoint)||+endpoint.split(':').at(-1)>65535:project!==PROJECT||endpoint!=='https://firestore.googleapis.com')fail('Unsupported project/endpoint');
 if(typeof token!=='function')fail('Ephemeral token callback required');
 const root=demo?directRoot:ROOT,stats={http:0,commits:0,documentWrites:0,snapshots:0,batchGet:0,listCollectionIds:0,listDocuments:0,documentsReturned:0};
 function path(name){
  if(typeof name!=='string'||!name.startsWith(root+'/'))fail('Cross-project document');
  const parts=name.slice(root.length+1).split('/');
  if(parts.length%2||parts.some(p=>!p||p==='.'||p==='..'||/[\x00-\x1f?#\\]/.test(p)))fail('Invalid document path');
  return '/'+parts.map(encodeURIComponent).join('/');
 }
 async function call(suffix,body){
  if(++stats.http>maxCalls)fail('HTTP budget exceeded');
  if(suffix.endsWith(':batchGet'))stats.batchGet++;
  else if(suffix.endsWith(':listCollectionIds'))stats.listCollectionIds++;
  else if(body===undefined)stats.listDocuments++;
  const bearer=await token();if(typeof bearer!=='string'||!bearer||/[\r\n]/.test(bearer))fail('Missing ephemeral credential');
  let response;
  try{response=await fetcher(endpoint+'/v1/'+root+suffix,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{Authorization:'Bearer '+bearer,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{fail('Transport failed; write outcome must be reconciled');}
  if(!response.ok)throw Object.assign(Error('Firestore HTTP '+response.status),{status:response.status});
  try{return await response.json();}catch{fail('Invalid Firestore response; write outcome must be reconciled');}
 }
 async function inventory(){
  stats.snapshots++;
  // A missing sentinel still returns a server readTime. Pin every list request to it.
  const r=await call(':batchGet',{documents:[root+'/hd3d_sequences/hd3d_mail']});
  if(!Array.isArray(r)||r.length!==1||!time(r[0].readTime))fail('Missing snapshot readTime');
  const readTime=r[0].readTime,parts=snapshotTimeParts(readTime),documents=[],collections={},seen=new Set(),parents=new Set();
  // Emulator 1.22.0's GET transcoder loses the RFC3339 query value. Its typed
  // timestamp fields preserve the exact same instant (verified against gRPC).
  // Production uses the documented RFC3339 string; never fall back to latest.
  const queryTime=demo?{'readTime.seconds':parts.seconds,'readTime.nanos':parts.nanos}:{readTime};
  async function pages(get,consume){let next;const tokens=new Set();do{const p=await get(next);await consume(p);next=p.nextPageToken;if(next){if(typeof next!=='string'||tokens.has(next))fail('Pagination cycle');tokens.add(next);}}while(next);}
  async function walk(parent='',depth=0){
   if(depth>maxDepth||parents.has(parent))fail('Inventory depth/cycle exceeded');parents.add(parent);
   await pages(t=>call(parent+':listCollectionIds',{pageSize:100,readTime,...(t?{pageToken:t}:{})}),async p=>{
    if(p.collectionIds!==undefined&&!Array.isArray(p.collectionIds))fail('Invalid collection page');
    for(const col of p.collectionIds||[]){
     if(typeof col!=='string'||!col||col==='.'||col==='..'||/[\/\x00-\x1f?#\\]/.test(col))fail('Invalid collection ID');
     const url=parent+'/'+encodeURIComponent(col),key=decodeURIComponent(url.slice(1));
     if(Object.hasOwn(collections,key))fail('Duplicate collection');collections[key]=0;
     await pages(t=>call(url+'?'+new URLSearchParams({pageSize:'100',showMissing:'true',...queryTime,...(t?{pageToken:t}:{})})),async ds=>{
      if(ds.documents!==undefined&&!Array.isArray(ds.documents))fail('Invalid document page');
      for(const d of ds.documents||[]){
       const child=path(d.name);if(child.split('/').slice(0,-1).join('/')!==url||seen.has(d.name))fail('Duplicate/unexpected document');seen.add(d.name);
       if(seen.size>maxDocuments)fail('Inventory document budget exceeded');
       if(d.updateTime){if(!time(d.updateTime))fail('Invalid document updateTime');documents.push(d);collections[key]++;stats.documentsReturned++;}
       else if(d.fields&&Object.keys(d.fields).length)fail('Document fields without updateTime');
       await walk(child,depth+1);
      }
     });
    }
   });
  }
  await walk();documents.sort((a,b)=>a.name.localeCompare(b.name));
  return {format:1,documents,snapshot:{project,database:'(default)',complete:true,readTime,collections}};
 }
 async function commit(writes){
  if(!allowWrites)fail('Store is read-only');
  if(!Array.isArray(writes)||!writes.length||writes.length>400)fail('Commit batch size must be 1..400');
  const names=new Set();
  for(const w of writes){
   const name=w.update?.name||w.delete;path(name);
   if(names.has(name)||Object.keys(w).some(k=>!['update','delete','currentDocument'].includes(k))||Boolean(w.update)===Boolean(w.delete))fail('Unsupported/duplicate write');names.add(name);
   const c=w.currentDocument;
   if(!c||Object.keys(c).length!==1||!(c.exists===false||time(c.updateTime)))fail('Exact create/update precondition required');
   if(w.delete&&c.exists===false)fail('Delete requires observed updateTime');
  }
  if(Buffer.byteLength(JSON.stringify({writes}))>8*1024*1024)fail('Commit byte budget exceeded');
  stats.commits++;stats.documentWrites+=writes.length;return call(':commit',{writes});
 }
 return {project,root,stats,inventory,commit};
}
