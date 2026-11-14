// Offline conversion only. Takes an explicitly supplied export, never opens a DB.
// Review output before a separately approved, coordinated cutover. Client imports
// are not trusted to establish historical XP, ownership, bans or claimed mail.
import { fromDocument,rowId,numericTables } from '../server/firestore.mjs';
import { directDocument,DEMO_PROJECT } from '../src/account/direct-store.js';
import {normalizeLegacyTimestamp} from './legacy-timestamp.mjs';
export const accountTables=['profiles','progress','admins','owned','orders','mail','bans','dungeon_wallet','dungeon_runs','dungeon_buys','spire_runs','spire_best','spire_weeks','users','growth_wallet','growth_receipts','growth_investments','growth_runs'].map(t=>'hd3d_'+t);
const tables=new Set(accountTables);
export function convertAccount(uid,documents,{project=DEMO_PROJECT,sequenceHighWater={}}={}) {
  if(project!==DEMO_PROJECT)throw new Error('Prototype migration is restricted to demo project');
  const rows=[],sequences=new Map(),dungeonDays=new Map(),spireDays=new Map(),seen=new Set();
  for(const doc of documents){
    const parts=doc.name.split('/'),table=parts.at(-2),id=parts.at(-1);
    if(!tables.has(table))throw new Error('Unsupported migration collection: '+table);
    const row=fromDocument(doc);
    if(['hd3d_spire_best','hd3d_spire_weeks'].includes(table)&&row?.best_at!=null)normalizeLegacyTimestamp(row.best_at);
    if(!row|| (row.user_id??row.id)!==uid)throw new Error('Cross-account or malformed export');
    if(rowId(table,row)!==id||seen.has(table+'/'+id))throw new Error('Duplicate/mismatched identity');
    seen.add(table+'/'+id);rows.push(directDocument(project,uid,table,id,row));
    if(numericTables.has(table)){if(!Number.isSafeInteger(row.id)||row.id<=0)throw new Error('Invalid historical numeric ID');sequences.set(table,Math.max(sequences.get(table)||0,row.id));}
    if(table==='hd3d_spire_runs'){
      const ms=typeof row.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.day)?Date.parse(row.day+'T00:00:00.000Z'):NaN;
      if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==row.day)throw new Error('Invalid historical spire day');
      const key='spire-'+ms/86400000;spireDays.set(key,(spireDays.get(key)||0)+1);
    }
    if(table==='hd3d_dungeon_runs'){
      // Every historical entry consumes its Korean calendar day, regardless of
      // completion/abandonment. Use the stored day, not the UTC started_at date.
      const ms=typeof row.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.day)?Date.parse(row.day+'T00:00:00.000Z'):NaN;
      if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==row.day)throw new Error('Invalid historical dungeon day');
      const key='dungeon-'+ms/86400000;
      dungeonDays.set(key,Math.max(dungeonDays.get(key)||0,row.id));
    }
  }
  // Rows can be pruned while inventory IDs/mailLog still refer to them. Require
  // trusted legacy sequence high-water marks, not just the largest surviving row.
  for(const id of numericTables){
    const value=sequenceHighWater[id];
    if(!Number.isSafeInteger(value)||value<0||value<(sequences.get(id)||0))throw new Error('Trusted sequence high-water mark required: '+id);
    rows.push(directDocument(project,uid,'hd3d_sequences',id,{id,value}));
  }
  for(const [id,value] of [...dungeonDays,...spireDays].sort(([a],[b])=>a.localeCompare(b)))
    rows.push(directDocument(project,uid,'hd3d_sequences',id,{id,value}));
  rows.push(directDocument(project,uid,'hd3d_sequences','_revision',{id:'_revision',value:0}));
  // Activation is uploaded last and only by a trusted migration operator.
  rows.push(directDocument(project,uid,'hd3d_sequences','_activation',{id:'_activation',schema:1,enabled:true,spireVersion:1}));
  return rows;
}
