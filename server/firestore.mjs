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
  async list(table,filter={}){
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
  async put(table,row){this.requireWrite();const doc=toDocument(table,row,this.root);this.cache.set(doc.name,structuredClone(row));this.writes.set(doc.name,{update:doc});return structuredClone(row);}
  async remove(table,id){this.requireWrite();const name=documentName(table,id,this.root);this.cache.set(name,null);this.writes.set(name,{delete:name});}
  async insert(table,row){
    this.requireWrite();
    if(numericTables.has(table)&&row.id==null){const seq=await this.get('hd3d_sequences',table)||{id:table,value:0};seq.value++;row={...row,id:seq.value};await this.put('hd3d_sequences',seq);}
    const id=rowId(table,row);if(await this.get(table,id))throw Object.assign(new Error('Already exists'),{code:'23505'});return this.put(table,row);
  }
}
