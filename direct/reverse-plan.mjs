// OFFLINE REVIEW PLAN ONLY: no SDK, credentials, HTTP, writes or activation.
// Requires a trusted full export and exclusive writers; hashes do not establish
// completeness. Scoped direct numeric IDs can collide in legacy global tables.
import {createHash} from 'node:crypto';
import {accountTables} from './migration.mjs';
import {planAccountMigration} from './migration-plan.mjs';
import {PROJECT,numericTables,rowId,toDocument,fromDocument} from '../server/firestore.mjs';
import {DEMO_PROJECT,decodeFields,unpackRow} from '../src/account/direct-store.js';
import {stable} from '../src/account/direct-authority.js';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
const fail=s=>{throw Error(s);};
export function planReverseMigration({original,direct,target,newAccount=false,reviewedRemovals=[]}){
 const uid=original?.uid;
 if(newAccount&&(original?.format!==1||!/^[-A-Za-z0-9_]{1,128}$/.test(uid)||original.documents?.length!==0||original.snapshot?.sourceProject!==PROJECT||original.snapshot.database!=='(default)'||original.snapshot.writersStopped!==true||original.snapshot.pendingClientJournals!==0||!Number.isFinite(Date.parse(original.snapshot.readTime))||Object.keys(original.snapshot.tables||{}).sort().join()!==accountTables.slice().sort().join()||Object.values(original.snapshot.tables).some(x=>x!==0)))fail('Empty trusted legacy namespace required for a new direct account');
 const forward=newAccount?{sourceHash:hash(original)}:planAccountMigration(original);
 const tables=[...accountTables,'hd3d_sequences'],counts=Object.fromEntries(tables.map(t=>[t,0]));
 if(direct?.uid!==uid||direct?.snapshot?.project!==DEMO_PROJECT||direct.snapshot.database!=='(default)'||!Number.isFinite(Date.parse(direct.snapshot.readTime)))fail('Trusted direct snapshot identity required');
 if(direct.snapshot.writersStopped!==true||direct.snapshot.pendingClientJournals!==0)fail('Direct writers/journals must be reconciled');
 if(target?.project!==PROJECT||target.database!=='(default)'||target.writersStopped!==true||!Number.isFinite(Date.parse(target.readTime))||target.numericOccupancyComplete!==true)fail('Trusted frozen target and complete numeric occupancy required');
 if(Object.keys(direct.snapshot.tables||{}).sort().join()!==tables.sort().join())fail('Direct complete collection counts required');
 const rows=new Map(),sequences=new Map(),saved=[];
 for(const doc of direct.documents||[]){
  const prefix=`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live/${uid}/`;
  if(!doc.name?.startsWith(prefix))fail('Cross-account direct snapshot');
  const [table,id,...tail]=doc.name.slice(prefix.length).split('/');if(tail.length||!(table in counts)||rows.has(table+'/'+id))fail('Invalid duplicate direct identity');
  const env=decodeFields(doc.fields);if(env.owner!==uid||env.version!==1)fail('Invalid direct envelope');
  const row=unpackRow(table,env.row);counts[table]++;rows.set(table+'/'+id,row);
  if(table==='hd3d_sequences'){if(row.id!==id)fail('Sequence identity mismatch');sequences.set(id,row);continue;}
  if((row.user_id??row.id)!==uid||rowId(table,row)!==id)fail('Cross-account row or identity mismatch');
  if((table==='hd3d_growth_runs'&&(!row.done||row.directReward&&row.hardSaved!==true))||(table==='hd3d_dungeon_runs'||table==='hd3d_spire_runs')&&row.status==='active'||table==='hd3d_growth_investments'&&row.status==='pending')fail('Unfinished run/reward must be reconciled');
  saved.push(toDocument(table,row));
 }
 for(const t of tables)if(counts[t]!==direct.snapshot.tables[t])fail('Direct export count mismatch: '+t);
 if(counts.hd3d_progress!==1||sequences.get('_activation')?.schema!==1||!Number.isSafeInteger(sequences.get('_revision')?.value))fail('Missing direct activation, revision or save');
 if(sequences.get('_activation').enabled!==false)fail('Direct activation must be disabled in the trusted frozen snapshot before reversal');
 for(const [key,r] of rows)if(key.startsWith('hd3d_growth_investments/')&&r.result?.action==='mail_item'){
  if(!rows.get('hd3d_mail/'+r.result.mail)?.claimed)fail('Partially applied mail requires completion before reversal');
 }
 // Original legacy rows must still exist byte-equivalently in the frozen target.
 // Switching to a stale backup after direct play would lose all new progress.
 const targets=new Map((target.accountDocuments||[]).map(d=>[d.name,d]));
 if(targets.size!==target.accountDocuments?.length||targets.size!==original.documents.length)fail('Target account changed or incomplete');
 for(const d of original.documents){if(hash(targets.get(d.name))!==hash(d))fail('Legacy target changed since cutover');const key=d.name.split('/').slice(-2).join('/');if(!rows.has(key)&&!reviewedRemovals.some(x=>key.startsWith('hd3d_spire_weeks/'+uid+'~')&&x.key===key&&x.target===uid&&x.action==='admin_spire_reset'&&x.audit))fail('Historical row missing in direct snapshot');}
 const highWater={};
 for(const t of numericTables){
  const high=target.sequenceHighWater?.[t],local=sequences.get(t)?.value,owners=target.numericOwners?.[t];
  if(!Number.isSafeInteger(high)||high<0||!Number.isSafeInteger(local)||local<0||!owners||typeof owners!=='object')fail('Trusted numeric sequence/occupancy required: '+t);
  highWater[t]=Math.max(high,local);
 }
 for(const doc of saved){const t=doc.name.split('/').at(-2),r=fromDocument(doc);if(!numericTables.has(t))continue;
  if(!Number.isSafeInteger(r.id)||r.id<=0)fail('Invalid numeric row');const occupant=target.numericOwners[t][r.id];
  if(occupant!==undefined&&occupant!==uid)fail('Global numeric ID collision requires reviewed remapping: '+t+'/'+r.id);
  if(occupant===uid&&!targets.has(doc.name))fail('Untracked target account numeric row');highWater[t]=Math.max(highWater[t],r.id);
 }
 // Reuse forward inventory/legacy consistency checks on the reconstructed data.
 const accountCounts=Object.fromEntries(accountTables.map(t=>[t,saved.filter(d=>d.name.split('/').at(-2)===t).length]));
 const reconstructed={format:1,uid,documents:saved,sequenceHighWater:highWater,snapshot:{sourceProject:PROJECT,database:'(default)',readTime:direct.snapshot.readTime,writersStopped:true,pendingClientJournals:0,tables:accountCounts}};
 planAccountMigration(reconstructed);
 return {version:1,uid,productionReady:false,noExternalWrites:true,sourceHash:forward.sourceHash,directHash:hash(direct),targetHash:hash(target),
  reviewedRemovals:structuredClone(reviewedRemovals),dataHash:hash(saved),documents:saved,sequenceHighWater:highWater,revision:sequences.get('_revision').value,
  preserved:['Latest typed save, inventory, codex and rewards','Claimed/server_applied mail and receipt history','Original numeric IDs when globally collision-free'],
  exclusions:['Global notices/admin audit/rank projection need a separate coordinated export','No automatic ID remapping','No credential, deployment, activation or database write'],
  requiredBeforeApply:['Review both frozen exports and this plan','Reverify target hash/sequence CAS immediately before approved application','Upload all account data and global sequence high-water marks under exclusive writer fence','Verify reads before client switch; retain both complete snapshots']};
}
