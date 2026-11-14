// Offline prototype merger for the exact deny-all baseline supplied by the owner.
// No credentials, network, CLI, deployment, data initialization or activation.
import {createHash} from 'node:crypto';
export const LIVE_ROOTS=Object.freeze(['hd3d_live','hd3d_live_accounts','hd3d_live_admin_actions','hd3d_live_admin_requests','hd3d_live_broadcast_control','hd3d_live_broadcast_deliveries','hd3d_live_broadcast_jobs','hd3d_live_catalog','hd3d_live_legacy_audit','hd3d_live_mail_audit','hd3d_live_mail_specs','hd3d_live_moderation','hd3d_live_notice_audit','hd3d_live_notices','hd3d_live_order_counter','hd3d_live_order_requests','hd3d_live_rank_blocks','hd3d_live_ranks','hd3d_live_spire_resets']);
const digest=s=>createHash('sha256').update(s).digest('hex');
// Every source shape is accepted only as this exact reviewed addition.
// Any validator/guard/path change requires a new review, not prefix inference.
// Archived PUBLIC fixture only: the three owner identity literals use example.invalid.
// This checksum preserves tamper rejection; it is not approval to deploy these Rules.
const PUBLIC_FIXTURE_SHA256='80fe52d8e76ba6e5faba909cf905da2eab88de0f9bc43688a2cf41c213949a87';
const canonicalDeny="rules_version='2';servicecloud.firestore{match/databases/{database}/documents{match/{document=**}{allowread,write:iffalse;}}}";
function maskComments(text){
 let out='',quote='',line=false,block=false;
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(line){if(c==='\n')line=false;out+=c==='\n'?'\n':' ';continue;}
  if(block){if(c==='*'&&n==='/'){out+='  ';i++;block=false;}else out+=c==='\n'?'\n':' ';continue;}
  if(quote){out+=c;if(c==='\\'&&n){out+=n;i++;}else if(c===quote)quote='';continue;}
  if(c==='/'&&n==='/'){out+='  ';i++;line=true;continue;}
  if(c==='/'&&n==='*'){out+='  ';i++;block=true;continue;}
  if(c==='"'||c==="'")quote=c;
  out+=c;
 }
 if(block||quote)throw Error('Unclosed Rules comment/string');
 return out;
}
function dbBody(text){
 const clean=maskComments(text),head=/\bmatch\s+\/databases\/\{database\}\/documents\s*\{/g;
 const matches=[...clean.matchAll(head)];if(matches.length!==1)throw Error('Exactly one database scope required');
 const start=matches[0].index+matches[0][0].length;let depth=1,quote='';
 for(let i=start;i<clean.length;i++){
  const c=clean[i];if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
  if(c==='"'||c==="'"){quote=c;continue;}if(c==='{')depth++;
  if(c==='}'&&!--depth)return {start,end:i,text:text.slice(start,i)};
 }
 throw Error('Unclosed database scope');
}
export function mergeLiveRules(current,addition){
 if(typeof current!=='string'||typeof addition!=='string')throw Error('Rules source strings required');
 if(maskComments(current).replace(/\s/g,'')!==canonicalDeny)throw Error('Baseline is not the reviewed deny-all Rules; stop for review');
 const old=dbBody(current),fresh=dbBody(addition),clean=maskComments(addition);
 if(!/^rules_version\s*=\s*'2';/.test(clean.trim())||!clean.includes("request.auth.token.aud == 'hero-defense-3d-independent'"))throw Error('Version 2 and production audience required');
 if(clean.includes("request.auth.token.aud == 'demo-hd3d-direct'"))throw Error('Demo audience cannot be published');
 const tail=/\s*match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;\s*\}\s*$/;
 const found=tail.exec(fresh.text);if(!found)throw Error('Reviewed final default-deny required');
 const body=fresh.text.slice(0,found.index),paths=[...maskComments(body).matchAll(/\bmatch\s+(\/[^\s]+)\s*\{/g)].map(m=>m[1]);
 let roots=[...new Set(paths.map(p=>p.split('/')[1]))].sort();
 if(paths.some(p=>p.includes('=**')))throw Error('Recursive allow scope not reviewed');
 if(digest(addition)!==PUBLIC_FIXTURE_SHA256)throw Error('Unreviewed roots or predicates');
 if(paths.some(p=>p.startsWith('/{'))){
  roots=[...LIVE_ROOTS].sort();
 }else if(JSON.stringify(roots)!==JSON.stringify([...LIVE_ROOTS].sort()))throw Error('Unexpected new-scope match roots');
 const header=addition.slice(addition.indexOf('\n')+1,addition.indexOf('service cloud.firestore'));
 const merged=current.slice(0,old.start)+'\n'+header+'\n  // New live scopes only. The original deny-all block remains below.\n'+body+'\n  // Original published baseline follows; no old-path permission is added.\n'+old.text+current.slice(old.end);
 if(Buffer.byteLength(merged)>256*1024)throw Error('Rules source exceeds 256KiB');
 return {rules:merged,metadata:{format:'hd3d-deny-all-live-merge-v1',project:'hero-defense-3d-independent',database:'(default)',
  baselineSHA256:digest(current),additionSHA256:digest(addition),mergedSHA256:digest(merged),bytes:Buffer.byteLength(merged),
  roots,baselineBodyPreserved:merged.includes(old.text),newLogicUnchanged:merged.includes(body),
  publicationTime:'not provided',network:false,productionReady:false,activation:'pending-rules-and-data'}};
}
