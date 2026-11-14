// Offline only. A complete UID index is required for accurate global admin
// totals/search; owner self-registration on future login cannot replace it.
import {DEMO_PROJECT,encodeFields} from '../src/account/direct-store.js';
export function adminReadDocuments(snapshot){
 if(snapshot?.project!==DEMO_PROJECT||snapshot.complete!==true||snapshot.writersStopped!==true||!Array.isArray(snapshot.uids)||!Array.isArray(snapshot.audit))throw Error('Trusted frozen demo export required');
 const root=`projects/${DEMO_PROJECT}/databases/(default)/documents`,seen=new Set();
 const accounts=snapshot.uids.map(uid=>{if(typeof uid!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(uid)||seen.has(uid))throw Error('Invalid duplicate UID');seen.add(uid);return {name:root+'/hd3d_live_accounts/'+uid,fields:encodeFields({uid})};});
 const logs=new Set();const audit=snapshot.audit.map(row=>{if(!row||!Number.isSafeInteger(row.id)||row.id<1||logs.has(row.id)||!seen.has(row.admin_id)||(row.target_user&&!seen.has(row.target_user))||!Number.isFinite(Date.parse(row.created_at)))throw Error('Invalid audit export');logs.add(row.id);return {name:root+'/hd3d_live_legacy_audit/'+row.id,fields:encodeFields({row})};});
 return {productionReady:false,noExternalWrites:true,documents:[...accounts,...audit]};
}
