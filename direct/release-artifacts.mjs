// Offline release preparation. No service, CLI config, credential or database access.
import {LIVE_PROJECT,DEMO_PROJECT} from '../src/account/direct-config.js';
import * as catalog from './catalog.mjs';
export function releaseArtifacts(rules,indexes) {
  const gate="function demo() { return request.auth.token.aud == '"+DEMO_PROJECT+"'; }";
  const gates=[...rules.matchAll(/\bfunction\s+demo\s*\(\s*\)\s*\{[^}]*\}/g)].map(m=>m[0]);
  if(!gates.length||gates.some(g=>g!==gate)||rules.split(gate).length-1!==gates.length||rules.split("request.auth.token.aud == '"+DEMO_PROJECT+"'").length-1!==gates.length)throw Error('Unexpected Rules audience gate; manual review required');
  const productionRules=rules.replaceAll(gate,"function demo() { return request.auth.token.aud == '"+LIVE_PROJECT+"'; }")
    .replace('// PROTOTYPE, EMULATOR ONLY. Not a production replacement for server adjudication.',
      '// RELEASE CANDIDATE; not deployed. Client randomness is not server adjudication.');
  const from=`projects/${DEMO_PROJECT}/databases/(default)/documents/`,to=`projects/${LIVE_PROJECT}/databases/(default)/documents/`;
  const documents=Object.values(catalog).flatMap(fn=>fn()).map(d=>{
    if(!d.name.startsWith(from+'hd3d_live_catalog/'))throw Error('Unexpected catalog destination');
    // Only the resource name changes. All game rules/values remain identical.
    return {...d,name:to+d.name.slice(from.length)};
  });
  if(new Set(documents.map(d=>d.name)).size!==documents.length)throw Error('Duplicate catalog destination');
  return {project:LIVE_PROJECT,productionReady:false,rules:productionRules,indexes:structuredClone(indexes),catalog:documents,
    firebaseConfig:{firestore:{rules:'firestore.rules',indexes:'firestore.indexes.json'}},
    required:['fresh namespace only; do not export/import/delete legacy data','preserve current deployed Rules outside hd3d_live scopes','review Rules/catalog and create-only initial counter before provisioning','verify fresh account and catalog integrity before activation','verified UID and separate authorization for initial owner','real Auth/browser verification on the new site']};
}
