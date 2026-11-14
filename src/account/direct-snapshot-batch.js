// Coalesce concurrent reads within one snapshot and one cancellation lifetime.
// No cross-request cache, permission cache, retries, or changes to atomic writes.
export function batchSnapshotReads(request) {
 const groups=[];
 const flush=async group=>{
  groups.splice(groups.indexOf(group),1);
  const names=[...new Set(group.jobs.flatMap(j=>j.body.documents))];
  try {
   const rows=await request(group.method,group.path,{...group.jobs[0].body,documents:names},group.options);
   const by=new Map();
   for(const row of Array.isArray(rows)?rows:[rows]){
    const name=row.found?.name||row.missing;
    if(!name)continue;
    if(!names.includes(name)||by.has(name))throw Error('Snapshot batch identity mismatch');
    by.set(name,row);
   }
   if(by.size!==names.length)throw Error('Incomplete snapshot batch');
   for(const j of group.jobs)j.resolve(j.body.documents.map(name=>by.get(name)));
  }catch(e){for(const j of group.jobs)j.reject(e);}
 };
 return (method,path,body,options={})=>{
  if(method!=='POST'||!path.endsWith(':batchGet')||!body?.transaction||body.documents?.length!==1||Object.keys(body).some(k=>!['documents','transaction'].includes(k)))return request(method,path,body,options);
  let group=groups.find(g=>g.path===path&&g.transaction===body.transaction&&g.options.signal===options.signal&&g.jobs.length<10);
  if(!group){group={method,path,transaction:body.transaction,options,jobs:[]};groups.push(group);queueMicrotask(()=>flush(group));}
  return new Promise((resolve,reject)=>group.jobs.push({body,resolve,reject}));
 };
}
