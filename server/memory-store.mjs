import { rowId, numericTables } from './firestore.mjs';
export class MemoryStore{
  constructor(tables={}){this.tables=structuredClone(tables);this.tail=Promise.resolve();}
  readOnly(fn){return Promise.resolve().then(()=>fn(new MemoryTransaction(this.tables,true)));}
  transaction(fn){const run=this.tail.then(async()=>{const tx=new MemoryTransaction(this.tables);const result=await fn(tx);this.tables=tx.tables;return result;});this.tail=run.catch(()=>{});return run;}
}
class MemoryTransaction{
  constructor(tables,readOnly=false){this.tables=structuredClone(tables);this.readOnly=readOnly;}
  requireWrite(){if(this.readOnly)throw new Error('Write attempted in read-only snapshot');}
  async get(table,id){return structuredClone((this.tables[table]||[]).find(x=>rowId(table,x)===String(id))||null);}
  async list(table,filters={}){return structuredClone((this.tables[table]||[]).filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v)));}
  async put(table,row){this.requireWrite();const rows=this.tables[table]||=[];const i=rows.findIndex(x=>rowId(table,x)===rowId(table,row));if(i<0)rows.push(structuredClone(row));else rows[i]=structuredClone(row);return structuredClone(row);}
  async remove(table,id){this.requireWrite();this.tables[table]=(this.tables[table]||[]).filter(x=>rowId(table,x)!==String(id));}
  async insert(table,row){this.requireWrite();if(numericTables.has(table)&&row.id==null)row={...row,id:Math.max(0,...(this.tables[table]||[]).map(x=>x.id))+1};if(await this.get(table,rowId(table,row)))throw Object.assign(new Error('Already exists'),{code:'23505'});return this.put(table,row);}
}
