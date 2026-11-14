// Pure offline plans. Caller-supplied exports are NOT an authorization boundary.
// No network, credentials, DB writes, process launch or activation occur here.
import {createHash} from 'node:crypto';
import {planAccountMigration} from './migration-plan.mjs';
import {stable} from '../src/account/direct-authority.js';
import {decodeFields} from '../src/account/direct-store.js';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
const fail=s=>{throw Error(s);};
// REST omits empty arrayValue.values/mapValue.fields. Normalize only those
// protobuf-equivalent forms; preserve Firestore scalar types and all values.
function wire(v){
 if(Array.isArray(v))return v.map(wire);
 if(!v||typeof v!=='object')return v;
 if(Object.keys(v).length===1&&'arrayValue' in v)return {arrayValue:{values:(v.arrayValue.values||[]).map(wire)}};
 if(Object.keys(v).length===1&&'mapValue' in v)return {mapValue:{fields:wire(v.mapValue.fields||{})}};
 return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,wire(x)]));
}
const value=d=>({name:d.name,fields:wire(d.fields)});
function checkedPlan(plan){
 const rebuilt=planAccountMigration(plan?.sourceBackup);
 if(plan.sourceHash!==rebuilt.sourceHash||hash(plan.data)!==rebuilt.dataHash||hash(plan.activation)!==rebuilt.activationHash||plan.uid!==rebuilt.uid)
  fail('Migration plan differs from its trusted source backup');
 return rebuilt;
}
function snapshotMap(plan,snapshot){
 if(!snapshot||snapshot.project!==plan.targetProject||snapshot.uid!==plan.uid||snapshot.database!=='(default)'||snapshot.complete!==true||snapshot.writersStopped!==true||!Number.isFinite(Date.parse(snapshot.readTime))||!Array.isArray(snapshot.documents))fail('Complete frozen target snapshot required');
 const prefix=`projects/${plan.targetProject}/databases/(default)/documents/hd3d_live/${plan.uid}/`,map=new Map();
 for(const d of snapshot.documents){
  if(!d.name?.startsWith(prefix)||d.name.slice(prefix.length).split('/').length!==2||map.has(d.name)||!d.fields)fail('Unexpected or duplicate target document');
  map.set(d.name,value(d));
 }
 return map;
}
export function planImportBatches(input,snapshot,{batchSize=400}={}){
 const plan=checkedPlan(input),actual=snapshotMap(plan,snapshot);
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>400)fail('Batch size must be 1..400');
 const expected=new Map([...plan.data,plan.activation].map(d=>[d.name,value(d)]));
 const enabled=actual.has(plan.activation.name)&&decodeFields(actual.get(plan.activation.name).fields).row.enabled;
 for(const [name,d] of actual){if(!expected.has(name)||hash(d)!==hash(expected.get(name)))fail('Target drift; never overwrite an existing account');}
 if(enabled&&actual.size!==expected.size)fail('Partially activated namespace must be investigated, not reimported');
 const missing=plan.data.filter(d=>!actual.has(d.name));
 const batches=[];for(let i=0;i<missing.length;i+=batchSize)batches.push(missing.slice(i,i+batchSize).map(d=>({update:structuredClone(d),currentDocument:{exists:false}})));
 return {version:1,productionReady:false,noExternalWrites:true,uid:plan.uid,sourceHash:plan.sourceHash,targetHash:hash(snapshot),
  alreadyActive:!!enabled,batches,existingData:plan.data.length-missing.length,missingData:missing.length,
  activation:enabled?null:{update:structuredClone(plan.activation),currentDocument:{exists:false}},
  next:'Re-read and verify the complete exact data snapshot before sending the separate activation write. Never activate from this planning result alone.'};
}
export function verifyImportedAccount(input,snapshot,{activated=false}={}){
 const plan=checkedPlan(input),actual=snapshotMap(plan,snapshot),expected=[...plan.data,...(activated?[plan.activation]:[])];
 if(actual.size!==expected.length)fail('Imported count mismatch or activation out of order');
 for(const d of expected)if(!actual.has(d.name)||hash(actual.get(d.name))!==hash(value(d)))fail('Imported content mismatch: '+d.name.split('/').slice(-2).join('/'));
 return {ok:true,uid:plan.uid,sourceHash:plan.sourceHash,dataHash:plan.dataHash,activated,documents:actual.size,
  noExternalWrites:true,productionReady:false,...(!activated?{activation:{update:structuredClone(plan.activation),currentDocument:{exists:false}}}:{})};
}
