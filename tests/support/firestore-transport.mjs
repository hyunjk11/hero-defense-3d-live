// Offline REST contract model. MVCC conflicts and optional read locks are derived
// from concurrently executed calls, never scripted HTTP409 responses.
import { ROOT, toDocument, fromDocument, rowId } from '../../server/firestore.mjs';
export const pause = ms => new Promise(r => setTimeout(r, ms));
export function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
export class FirestoreTransport {
  constructor(tables={}, {latency=0, locks=false, root=ROOT}={}){
    this.root=root;
    this.docs=new Map();this.versions=new Map();this.txs=new Map();this.calls=[];this.serial=0;this.latency=latency;this.locks=locks;this.waiters=[];
    for(const [table,rows] of Object.entries(tables))for(const row of rows)this.seed(table,row);
    this.request=this.request.bind(this);
  }
  seed(table,row){const doc=toDocument(table,row,this.root);this.docs.set(doc.name,doc);this.versions.set(doc.name,(this.versions.get(doc.name)||0)+1);}
  remove(table,id){const name=this.root+'/'+table+'/'+id;this.docs.delete(name);this.versions.set(name,(this.versions.get(name)||0)+1);}
  rows(table){return [...this.docs].filter(([n])=>n.startsWith(this.root+'/'+table+'/')).map(([,d])=>fromDocument(d));}
  begin(readOnly){const token='tx-'+(++this.serial);this.txs.set(token,{token,readOnly,docs:structuredClone(this.docs),versions:new Map(this.versions),reads:new Set()});return token;}
  release(token){this.txs.delete(token);for(const wake of this.waiters.splice(0))wake();}
  read(tx,name){if(!tx.readOnly)tx.reads.add(name);return tx.docs.get(name);}
  async request(method,path,body){
    const action=path.slice(path.lastIndexOf(':')+1);this.calls.push({action,path,body:structuredClone(body)});
    if(this.latency)await pause(this.latency);
    if(action==='beginTransaction')return {transaction:this.begin(!!body.options.readOnly)};
    if(action==='batchGet'){
      const fresh=body.newTransaction?this.begin(!!body.newTransaction.readOnly):null;
      const tx=this.txs.get(fresh||body.transaction);if(!tx)throw Error('Missing transaction');
      const rows=body.documents.map(name=>{const d=this.read(tx,name);return d?{found:structuredClone(d)}:{missing:name};}).reverse();
      const result=[...(fresh?[{transaction:fresh}]:[]),...rows];
      return this.transformBatch?this.transformBatch(result):result;
    }
    const tx=this.txs.get(body.transaction);if(!tx)throw Error('Missing transaction');
    if(action==='runQuery'){
      const table=body.structuredQuery.from[0].collectionId,w=body.structuredQuery.where;
      const filters=w?.compositeFilter?.filters||(w?[w]:[]);
      if(path!==this.root+':runQuery')throw Error('Wrong query namespace');
      const rows=[...tx.docs].filter(([name,doc])=>name.startsWith(this.root+'/'+table+'/')&&filters.every(f=>JSON.stringify(doc.fields[f.fieldFilter.field.fieldPath])===JSON.stringify(f.fieldFilter.value)));
      for(const [name]of rows)this.read(tx,name);
      if(this.queryGate){this.queryGate.enter.resolve();await this.queryGate.release.promise;}
      return rows.map(([,document])=>({document:structuredClone(document)}));
    }
    if(action==='rollback'){this.release(tx.token);if(this.failRollback)throw Error('rollback failed');return {};}
    if(action==='commit'){
      if(tx.readOnly)throw Error('Write in read-only transaction');
      if(this.failCommit)throw this.failCommit;
      const names=body.writes.map(w=>w.update?.name||w.delete);
      while(this.locks&&[...this.txs.values()].some(o=>o!==tx&&!o.readOnly&&names.some(n=>o.reads.has(n))))await new Promise(r=>this.waiters.push(r));
      if([...tx.reads].some(n=>tx.versions.get(n)!==this.versions.get(n)))throw Object.assign(Error('Concurrent version changed'),{status:409,code:'ABORTED'});
      for(const w of body.writes){const n=w.update?.name||w.delete;w.update?this.docs.set(n,structuredClone(w.update)):this.docs.delete(n);this.versions.set(n,(this.versions.get(n)||0)+1);}
      this.release(tx.token);if(this.loseCommitResponse){this.loseCommitResponse=false;throw Object.assign(Error('response lost'),{status:503});}return {};
    }
    throw Error('Unexpected REST operation '+action);
  }
  counts(){const count=fn=>this.calls.filter(fn).length;return {calls:this.calls.length,begin:count(c=>c.action==='beginTransaction'),batchGet:count(c=>c.action==='batchGet'),query:count(c=>c.action==='runQuery'),commit:count(c=>c.action==='commit'),rollback:count(c=>c.action==='rollback'),readOnly:count(c=>!!c.body?.newTransaction?.readOnly||!!c.body?.options?.readOnly),readWrite:count(c=>!!c.body?.options?.readWrite),writes:count(c=>c.action==='commit'&&c.body.writes.length>0)};}
}
