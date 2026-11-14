// Pure, offline preflight. No database client, credentials, upload or activation.
// Declared export completeness must come from a trusted coordinated exporter;
// a checksum cannot establish that omitted source documents never existed.
import {createHash} from 'node:crypto';
import {accountTables,convertAccount} from './migration.mjs';
import {PROJECT,fromDocument} from '../server/firestore.mjs';
import {DEMO_PROJECT,decodeFields} from '../src/account/direct-store.js';
import {authoritativeSave,stable} from '../src/account/direct-authority.js';
import {unpackItem} from '../src/account/storpack.js';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
const fail=message=>{throw new Error(message);};
function inventory(save){
 const seen=new Map();
 for(const [place,items] of [['inv',save.inv||[]],['stor',save.stor||[]],['chests',(save.chests||[]).map(c=>c.it)]]){
  if(!Array.isArray(items))fail('Malformed inventory export');
  for(const raw of items){const it=typeof raw==='string'?unpackItem(raw):raw;
   if(!it||typeof it.id!=='string'||!it.id)fail('Missing item identity in '+place);
   if(seen.has(it.id))fail('Duplicate item identity across '+seen.get(it.id)+' and '+place);
   seen.set(it.id,place);
  }
 }
 const chests=save.chests||[];if(new Set(chests.map(c=>c.id)).size!==chests.length)fail('Duplicate chest identity');
}
export function planAccountMigration(bundle){
 if(!bundle||bundle.format!==1||!Array.isArray(bundle.documents))fail('Versioned trusted export required');
 const {uid,documents,snapshot}=bundle;
 if(!snapshot||snapshot.sourceProject!==PROJECT||snapshot.database!=='(default)'||!Number.isFinite(Date.parse(snapshot.readTime)))fail('Source snapshot identity required');
 if(snapshot.writersStopped!==true||snapshot.pendingClientJournals!==0)fail('Unfinished cutover or client journal');
 if(!snapshot.tables||Object.keys(snapshot.tables).sort().join()!==[...accountTables].sort().join())fail('Explicit complete account collection inventory required');
 const counts=Object.fromEntries(accountTables.map(t=>[t,0])),sourceRows=[];
 for(const d of documents){
  if(!d.name?.startsWith(`projects/${PROJECT}/databases/(default)/documents/`))fail('Unexpected source project/database');
  const table=d.name.split('/').at(-2);if(!(table in counts))fail('Unexpected source collection');counts[table]++;
  const row=fromDocument(d);if(!row)fail('Unreadable source row');sourceRows.push({table,row});
  if((table==='hd3d_growth_runs'&&!row.done)||(table==='hd3d_dungeon_runs'&&row.status==='active')||(table==='hd3d_spire_runs'&&row.status==='active'))fail('Unfinished run requires reconciliation before cutover');
  if(table==='hd3d_progress')inventory(row.data);
 }
 for(const t of accountTables)if(!Number.isSafeInteger(snapshot.tables[t])||snapshot.tables[t]!==counts[t])fail('Export count mismatch: '+t);
 if(counts.hd3d_progress!==1)fail('One existing authoritative save required');
 const converted=convertAccount(uid,documents,{project:DEMO_PROJECT,sequenceHighWater:bundle.sequenceHighWater});
 const before=sourceRows.find(x=>x.table==='hd3d_progress').row.data;
 const progress=converted.find(d=>d.name.includes('/hd3d_progress/'));const row=decodeFields(progress.fields).row;
 if(stable(authoritativeSave(row.cosmetic,row.authority))!==stable(before))fail('Save round-trip mismatch');
 const activation=converted.at(-1);if(!activation.name.endsWith('/_activation'))fail('Activation ordering');
 const data=converted.slice(0,-1);
 return {version:1,uid,targetProject:DEMO_PROJECT,productionReady:false,noExternalWrites:true,
  sourceHash:hash(bundle),saveHash:hash(before),sourceCounts:counts,
  dataHash:hash(data),activationHash:hash(activation),data,activation,
  sourceBackup:structuredClone(bundle),
  requiredBeforeActivation:['Trusted consistent export and exclusive writer cutover','Review all converted documents and trusted role/ban history','Verify uploaded data hash before the separately approved activation','Do not re-import over an active direct account'],
  rollback:{preserveSource:true,freezeDirectFirst:true,reverseReconciliationRequired:true,
   reason:'Once direct writes exist, switching back without reconciling them loses new progress. Never replace with the stale source backup.'}};
}
