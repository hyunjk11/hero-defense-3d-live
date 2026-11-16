import { NO_TIMING } from './timing.mjs';
export const PROJECT = 'hero-defense-3d-independent';
export const DATABASE = '(default)';
export const ROOT = `projects/${PROJECT}/databases/${DATABASE}/documents`;
export const collectionNames = ['profiles','progress','admins','owned','orders','mail','bans','admin_log','broadcasts','notices','dungeon_wallet','dungeon_runs','dungeon_buys','spire_runs','spire_best','spire_weeks','users','growth_wallet','growth_receipts','growth_investments','growth_runs'].map(x=>'hd3d_'+x);
const userKeys = new Set(['hd3d_progress','hd3d_admins','hd3d_bans','hd3d_dungeon_wallet','hd3d_spire_best','hd3d_growth_wallet']);
export const numericTables = new Set(['orders','mail','admin_log','broadcasts','notices','dungeon_runs','dungeon_buys','spire_runs'].map(x=>'hd3d_'+x));
const indexed = ['id','user_id','item','token','day','week','status','email','created_at','updated_at','target_user','order_id','action','active','best_floor','best_at','started_at'];
export function rowId(table,row){
  if(table==='hd3d_owned')return row.user_id+'~'+row.item;
  if(table==='hd3d_spire_weeks')return row.user_id+'~'+row.week;
  return String(userKeys.has(table)?row.user_id:row.id);
}
export function documentName(table,id,root=ROOT){if(!collectionNames.includes(table)&&table!=='hd3d_sequences')throw new Error('Unknown collection');id=String(id);if(!id||id==='undefined'||id.length>1500||id.includes('/')||id==='.'||id==='..')throw new Error('Invalid document ID');return `${root}/${table}/${id}`;}
export function scalar(v){if(v===null)return {nullValue:null};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return {stringValue:String(v)};}
export function toDocument(table,row,root=ROOT){const fields={payload:{stringValue:JSON.stringify(row)}};for(const k of indexed)if(k in row && row[k]!==undefined && (row[k]===null||['string','number','boolean'].includes(typeof row[k])))fields[k]=scalar(row[k]);return {name:documentName(table,rowId(table,row),root),fields};}
export function fromDocument(doc){return doc?.fields?.payload?.stringValue ? JSON.parse(doc.fields.payload.stringValue) : null;}
const matches=(row,filter)=>Object.entries(filter).every(([k,v])=>row[k]===v);
function checkSignal(signal){if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');}
export class FirestoreStore{
  constructor(request,timing=NO_TIMING,userSyncScope=null,{signal,namespace=''}={}){if(!['','hd3d_live_server/state'].includes(namespace))throw new Error('Unknown storage namespace');this.root=ROOT+(namespace?'/'+namespace:'');this.request=request;this.timing=timing;this.userSyncScope=userSyncScope||this;this.signal=signal;}
  readOnly(fn,documents=[]){return this.transaction(fn,{readOnly:true,documents});}
  async transaction(fn,{readOnly=false,documents=[]}={}){return this.timing.measure('transaction.total',async()=>{
    for(let attempt=0;attempt<5;attempt++){
      checkSignal(this.signal);
      let token,tx,committed=false,cleanupAttempted=false;this.timing.count('transaction_attempt');
      const cleanup=async()=>{if(token&&!committed&&!cleanupAttempted){cleanupAttempted=true;this.timing.count('transaction_rollback');await this.request('POST',`${ROOT}:rollback`,{transaction:token});}};
      try{
        let initial=[];
        if(documents.length){
          this.timing.count(readOnly?'read_only_transaction':'prefetched_write_transaction');
          const names=documents.map(([table,id])=>documentName(table,id,this.root));
          initial=await this.request('POST',`${ROOT}:batchGet`,{documents:names,newTransaction:readOnly?{readOnly:{}}:{readWrite:{}}});
          initial=Array.isArray(initial)?initial:[initial];token=initial.find(x=>x.transaction)?.transaction;
          if(typeof token!=='string'||!token)throw new Error('Read snapshot token missing');
          const received=new Set(initial.map(x=>x.found?.name||x.missing).filter(Boolean));
          if(names.some(n=>!received.has(n)))throw new Error('Incomplete read snapshot');
        }else token=(await this.request('POST',`${ROOT}:beginTransaction`,{options:readOnly?{readOnly:{}}:{readWrite:{}}})).transaction;
        // Begin/newTransaction cannot use the caller signal: obtain the token even
        // if the caller disconnects, so this attempt can be explicitly released.
        if(typeof token!=='string'||!token)throw new Error('Transaction token missing');
        checkSignal(this.signal);
        tx=new FirestoreTransaction(this.request,token,readOnly,this.signal,this.root);
        for(const row of initial){if(row.found)tx.cache.set(row.found.name,fromDocument(row.found));else if(row.missing)tx.cache.set(row.missing,null);}
        const result=await this.timing.measure('transaction.execute',()=>fn(tx));
        await tx.close();checkSignal(this.signal);
        // Once commit is dispatched, cancellation cannot tell us whether it was
        // applied. Await its actual response without attaching the caller signal.
        if(tx.writes.size){this.timing.count('transaction_commit');await this.request('POST',`${ROOT}:commit`,{transaction:token,writes:[...tx.writes.values()]});committed=true;}
        else await cleanup();
        return result;
      }catch(e){
        await tx?.close();
        // Use an independent request for cleanup, once, preserving the original
        // failure. An unknown commit response must never trigger a blind retry.
        await cleanup().catch(()=>{});
        checkSignal(this.signal);
        if(attempt<4&&(e.status===409||e.code==='ABORTED')){this.timing.count('transaction_retry');await this.timing.measure('transaction.retry_wait',()=>new Promise(r=>setTimeout(r,40+attempt*80)));continue;}throw e;
      }
    }
  });}
}
export class FirestoreTransaction{
  constructor(request,token,readOnly=false,signal,root=ROOT){this.root=root;this.request=request;this.token=token;this.readOnly=readOnly;this.cache=new Map();this.writes=new Map();this.reads=new Set();this.controller=new AbortController();this.signal=signal;this.abort=()=>this.controller.abort();signal?.addEventListener('abort',this.abort,{once:true});if(signal?.aborted)this.abort();}
  check(){checkSignal(this.controller.signal);}
  async read(path,body){this.check();const work=Promise.resolve().then(()=>{this.check();return this.request('POST',path,body,{signal:this.controller.signal});});this.reads.add(work);try{return await work;}finally{this.reads.delete(work);}}
  async close(){this.signal?.removeEventListener('abort',this.abort);this.controller.abort();await Promise.allSettled([...this.reads]);}
  requireWrite(){this.check();if(this.readOnly)throw new Error('Write attempted in read-only snapshot');}
  async get(table,id){
    this.check();
    const name=documentName(table,id,this.root);if(this.cache.has(name))return structuredClone(this.cache.get(name));
    const data=await this.read(`${ROOT}:batchGet`,{documents:[name],transaction:this.token});
    const found=(Array.isArray(data)?data:[data]).find(x=>x.found)?.found,row=fromDocument(found);
    this.cache.set(name,row);return structuredClone(row);
  }
  async list(table,filter={},unbounded=false){
    if(!unbounded&&table==='hd3d_dungeon_runs'&&typeof filter.user_id==='string'&&Object.keys(filter).length===2&&
       ['day','status'].some(k=>typeof filter[k]==='string'))return this.dungeonWindow(filter);
    this.check();
    documentName(table,'check',this.root);for(const k of Object.keys(filter))if(!indexed.includes(k)||filter[k]===undefined)throw new Error('Invalid query filter');
    // Equality queries use only needed indexes; server operations perform bounded projection afterward.
    const fieldFilters=Object.entries(filter).map(([k,v])=>({fieldFilter:{field:{fieldPath:k},op:'EQUAL',value:scalar(v)}}));
    const query={from:[{collectionId:table}]};if(fieldFilters.length)query.where=fieldFilters.length===1?fieldFilters[0]:{compositeFilter:{op:'AND',filters:fieldFilters}};
    const response=await this.read(`${this.root}:runQuery`,{structuredQuery:query,transaction:this.token});
    const rows=new Map();for(const item of response||[]){if(!item.document)continue;const row=fromDocument(item.document);if(row)rows.set(item.document.name,row);if(!this.cache.has(item.document.name))this.cache.set(item.document.name,row);}
    for(const [name,w]of this.writes){if(!name.startsWith(this.root+'/'+table+'/'))continue;const row=this.cache.get(name);if(row&&matches(row,filter))rows.set(name,row);else rows.delete(name);}
    return structuredClone([...rows.values()]);
  }
  historyBase(table,uid){return {from:[{collectionId:table}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:scalar(uid)}}};}
  async historyProbe(base){
    this.historyProbes||=new Map();const key=JSON.stringify(base);
    if(!this.historyProbes.has(key))this.historyProbes.set(key,this.read(`${this.root}:runQuery`,{structuredQuery:{...base,limit:128},transaction:this.token})
      .then(response=>(response||[]).filter(x=>x.document).map(x=>x.document)));
    return this.historyProbes.get(key);
  }
  async historyCount(query){
    this.historyCounts||=new Map();const key=JSON.stringify(query);
    if(!this.historyCounts.has(key))this.historyCounts.set(key,this.read(`${this.root}:runAggregationQuery`,{structuredAggregationQuery:{structuredQuery:query,aggregations:[{alias:'total',count:{}}]},transaction:this.token}).then(response=>{
      const rows=Array.isArray(response)?response:[response],value=rows.find(x=>x.result?.aggregateFields?.total)?.result.aggregateFields.total.integerValue;
      const total=Number(value);if(value===undefined||!Number.isSafeInteger(total)||total<0)throw new Error('Invalid history count');return total;
    }));
    return this.historyCounts.get(key);
  }
  async dungeonWindow(filter){
    const key=Object.hasOwn(filter,'day')?'day':'status',base=this.historyBase('hd3d_dungeon_runs',filter.user_id);
    const fallback=async()=> (await this.list('hd3d_dungeon_runs',{user_id:filter.user_id},true)).filter(r=>r[key]===filter[key]);
    if([...this.writes.keys()].some(n=>n.startsWith(this.root+'/hd3d_dungeon_runs/')))return fallback();
    const probe=await this.historyProbe(base);
    if(probe.length<128)return probe.map(fromDocument).filter(r=>r&&r[key]===filter[key]);
    try{
      const typed={...base,where:{compositeFilter:{op:'AND',filters:[base.where,{fieldFilter:{field:{fieldPath:key},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:''}}}]}},orderBy:[{field:{fieldPath:key},direction:'ASCENDING'}]};
      const [all,indexed]=await Promise.all([this.historyCount(base),this.historyCount(typed)]);
      if(all!==indexed)return fallback();
      return this.list('hd3d_dungeon_runs',filter,true);
    }catch(e){if(['FAILED_PRECONDITION','UNIMPLEMENTED'].includes(e.code))return fallback();throw e;}
  }
  // Mail only: small accounts keep one query. Large accounts use a bounded
  // ordered scan. Archive state stays in payload so legacy unmarked mail remains
  // visible; never filter on a newly introduced field or rewrite old documents.
  async mailWindow(filter,{limit,archived}){
    this.check();
    if(Object.keys(filter).length!==1||typeof filter.user_id!=='string'||!Number.isInteger(limit)||limit<1||limit>1000||
       [...this.writes.keys()].some(n=>n.startsWith(this.root+'/hd3d_mail/')))return null;
    const base=this.historyBase('hd3d_mail',filter.user_id);
    const fetch=async q=>{
      const response=await this.read(`${this.root}:runQuery`,{structuredQuery:q,transaction:this.token});
      return (response||[]).filter(x=>x.document).map(x=>x.document);
    };
    const visible=row=>archived===undefined||!!row.archived_at===archived;
    const finish=docs=>docs.map(fromDocument).filter(Boolean).filter(visible)
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,limit);
    const pageSize=128;
    const probe=await this.historyProbe(base);
    if(probe.length<pageSize)return finish(probe);
    const orderBy=[{field:{fieldPath:'created_at'},direction:'DESCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}];
    try{
      // orderBy excludes missing fields. Compare within this same transaction
      // snapshot before using it, otherwise legacy mail could silently disappear.
      const [all,ordered]=await Promise.all([this.historyCount(base),this.historyCount({...base,where:{compositeFilter:{op:'AND',filters:[base.where,{fieldFilter:{field:{fieldPath:'created_at'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:''}}}]}},orderBy})]);
      if(all!==ordered)return null;
      let cursor=null,scanned=0;const rows=[];
      while(scanned<all&&rows.length<limit){
        const docs=await fetch({...base,orderBy,limit:pageSize,...(cursor?{startAt:{values:cursor,before:false}}:{})});
        if(!docs.length)throw new Error('Incomplete mail page');
        for(const doc of docs){const row=fromDocument(doc);if(row&&visible(row))rows.push(row);}
        scanned+=docs.length;
        const last=docs.at(-1),field=last.fields?.created_at;
        // Current server writes ISO strings. Do not impose new semantics on
        // unusual legacy field types; use the original complete-list path.
        if(!field||typeof field.stringValue!=='string')return null;
        cursor=[field,{referenceValue:last.name}];
        if(docs.some(d=>!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(d.fields?.created_at?.stringValue||'')||fromDocument(d)?.created_at!==d.fields.created_at.stringValue))return null;
      }
      return rows.slice(0,limit);
    }catch(e){
      // Index rollout must not break access. Permission, network and transaction
      // failures still propagate; only unsupported/not-ready query plans fall back.
      if(['FAILED_PRECONDITION','UNIMPLEMENTED'].includes(e.code))return null;
      throw e;
    }
  }
  async put(table,row){this.requireWrite();const doc=toDocument(table,row,this.root);this.cache.set(doc.name,structuredClone(row));this.writes.set(doc.name,{update:doc});return structuredClone(row);}
  async remove(table,id){this.requireWrite();const name=documentName(table,id,this.root);this.cache.set(name,null);this.writes.set(name,{delete:name});}
  async insert(table,row){
    this.requireWrite();
    if(numericTables.has(table)&&row.id==null){const seq=await this.get('hd3d_sequences',table)||{id:table,value:0};seq.value++;row={...row,id:seq.value};await this.put('hd3d_sequences',seq);}
    const id=rowId(table,row);if(await this.get(table,id))throw Object.assign(new Error('Already exists'),{code:'23505'});return this.put(table,row);
  }
}
