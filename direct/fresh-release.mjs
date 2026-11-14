// Offline, create-only deployment plan. This module never authenticates or calls a service.
import {releaseArtifacts} from './release-artifacts.mjs';
import {LIVE_PROJECT} from '../src/account/direct-config.js';
import {encodeFields,decodeFields} from '../src/account/direct-store.js';
import {getPrivateOwnerEmail} from '../server/common.mjs';
export const FRESH_ROOT = `projects/${LIVE_PROJECT}/databases/(default)/documents`;
// Helpers can be specialized into several collection scopes. Inspect every
// declaration, independent of order/comments, instead of slicing to a marker.
export function ruleFunctionBodies(source,name) {
  const tokens=[...source.matchAll(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_][A-Za-z_0-9]*|\s+|./g)]
    .map(m=>m[0]).filter(t=>!/^\s+$/.test(t)&&!t.startsWith('//')&&!t.startsWith('/*'));
  const bodies=[];
  for(let i=0;i<tokens.length;i++){
    if(tokens[i]!=='function'||tokens[i+1]!==name||tokens[i+2]!=='(')continue;
    let j=i+2,depth=0;
    do {if(tokens[j]==='(')depth++;else if(tokens[j]===')')depth--;j++;} while(j<tokens.length&&depth);
    if(depth||tokens[j]!=='{')throw Error('Invalid Rules function declaration');
    const start=++j;depth=1;
    while(j<tokens.length&&depth){if(tokens[j]==='{')depth++;else if(tokens[j]==='}')depth--;j++;}
    if(depth)throw Error('Unclosed Rules function');
    bodies.push(tokens.slice(start,j-1).join(''));i=j-1;
  }
  return bodies;
}
export function freshRelease(rules,indexes) {
  const base=releaseArtifacts(rules,indexes);
  const bootstraps=ruleFunctionBodies(rules,'bootstrap');
  if(!bootstraps.length||bootstraps.some(body=>!body.includes("!exists(path(uid,'hd3d_sequences','_activation'))")||body.includes('/documents/hd3d_progress/')))throw Error('Fresh bootstrap not isolated');
  const docs=[...base.catalog,{name:FRESH_ROOT+'/hd3d_live_order_counter/main',fields:encodeFields({value:0})}];
  if(docs.some(d=>!/^hd3d_live(?:_|\/)/.test(d.name.slice(FRESH_ROOT.length+1))))throw Error('Non-live destination');
  return {format:'hd3d-fresh-live-plan-v1',project:LIVE_PROJECT,database:'(default)',namespace:'hd3d_live',
    repositoryName:'hero-defense-3d-live',network:false,productionReady:false,
    rulesCandidate:base.rules,indexes:base.indexes,
    initialWrites:docs.map(update=>({update,currentDocument:{exists:false}})),
    oldDataReads:0,oldDataWrites:0,oldDataDeletion:false,accountImport:false,
    runtimeActivation:'pending-rules-and-data',
    required:['verify only the NEW hd3d_live* destinations are empty; stop on collisions',
      'merge and review new-scope Rules against the current deployed Rules; preserve all old scopes',
      'verify all catalog fields and create-only counter after approved provisioning',
      'test new login/bootstrap/save/recovery; no legacy reads or browser journal reuse',
      'designate verified existing Auth UID for initial owner; no automatic email-only privilege',
      'approve exact new repository/Pages and any required Auth origin change; preserve existing stag',
      'set client activation only after Rules/catalog/account checks pass'],
    rollback:'Disable the new site/profile; retain its new data. No reverse migration or legacy overwrite.'};
}
export function initialOwnerPlan({uid,verifiedEmail,activation,revision,at}) {
  const expectedOwner=getPrivateOwnerEmail();
  if(!expectedOwner||!/^[A-Za-z0-9_-]{1,128}$/.test(uid||'')||verifiedEmail?.toLowerCase()!==expectedOwner)throw Error('Verified owner identity required');
  const prefix=FRESH_ROOT+'/hd3d_live/'+uid+'/';
  if(activation?.name!==prefix+'hd3d_sequences/_activation'||revision?.name!==prefix+'hd3d_sequences/_revision'||!activation.updateTime||!revision.updateTime)throw Error('Exact current live account snapshots required');
  const a=decodeFields(activation.fields),r=decodeFields(revision.fields);
  if(a.owner!==uid||r.owner!==uid||a.row?.enabled!==true||a.row.schema!==1||!Number.isSafeInteger(r.row?.value)||r.row.value<0)throw Error('Active live account required');
  if(typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(at)||!Number.isFinite(Date.parse(at)))throw Error('Explicit operator timestamp required');
  return {network:false,requiresSeparateApproval:true,uid,writes:[
    {verify:activation.name,currentDocument:{updateTime:activation.updateTime}},
    {verify:revision.name,currentDocument:{updateTime:revision.updateTime}},
    {update:{name:prefix+'hd3d_admins/'+uid,fields:encodeFields({owner:uid,version:1,commitRevision:r.row.value,row:{user_id:uid,owner:true,added_by:uid,created_at:at}})},currentDocument:{exists:false}}
  ]};
}
