import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeLiveRules,LIVE_ROOTS} from '../direct/merge-live-rules.mjs';
import {releaseArtifacts} from '../direct/release-artifacts.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base=read('direct/current-rules-deny-all.rules');
const add=releaseArtifacts(read('direct/firestore.rules'),JSON.parse(read('direct/firestore.indexes.json'))).rules;
const rows=[],test=(name,fn)=>{fn();rows.push(name);};
test('optional envelope time fields require timestamp types',()=>{
 for(const field of ['issuedAt','pingAt','closedAt'])assert(add.includes("(!('"+field+"' in d)||"+(field==='issuedAt'?'':'d.'+field+'==null||')+'d.'+field+' is timestamp)'));
});
test('preserves the entire original database deny body including comments',()=>{
 const m=mergeLiveRules(base,add);assert(m.metadata.baselineBodyPreserved);assert(m.metadata.newLogicUnchanged);assert.equal(m.metadata.roots.length,19);assert.deepEqual(m.metadata.roots,[...LIVE_ROOTS].sort());
 assert.equal(m.metadata.productionReady,false);assert.equal(m.metadata.network,false);assert(m.metadata.bytes<256*1024);
 assert.equal((m.rules.match(/match \/\{document=\*\*\}/g)||[]).length,1);
 assert(m.rules.includes('// Game records are accessed only by the server'));
});
test('comment and whitespace variants preserve deny semantics',()=>assert(mergeLiveRules(base.replace('rules_version', '// supplied\n rules_version').replaceAll('\n','\r\n'),add).metadata.baselineBodyPreserved));
for(const [name,modified] of [
 ['allow true',base.replace('if false','if true')],
 ['additional old-path grant',base.replace('match /{document=**}',"match /legacy/{id} { allow read: if request.auth != null; }\nmatch /{document=**}")],
 ['version1',base.replace("'2'","'1'")],
 ['service mismatch',base.replace('cloud.firestore','firebase.storage')],
 ['malformed source',base.slice(0,-3)]
])test('refuses changed baseline: '+name,()=>assert.throws(()=>mergeLiveRules(modified,add),/Baseline/));
test('refuses legacy collection introduced into dispatch',()=>assert.throws(()=>mergeLiveRules(base,add.replaceAll("collection=='hd3d_live_notices'","collection=='hd3d_notices'")),/roots/));
test('refuses similar prefix root',()=>assert.throws(()=>mergeLiveRules(base,add.replaceAll("collection=='hd3d_live_notices'","collection=='hd3d_live_notices_evil'")),/roots/));
test('refuses recursive new scope',()=>assert.throws(()=>mergeLiveRules(base,add.replace('match /{collection}/{id}','match /{collection}/{id=**}')),/Recursive/));
test('refuses omitted owner guard in the consolidated source',()=>assert.throws(()=>mergeLiveRules(base,add.replace('request.auth.uid == uid','true')),/roots/));
test('refuses a new unconditional allow clause',()=>assert.throws(()=>mergeLiveRules(base,add.replace('match /{collection}/{id} {','match /{collection}/{id} { allow read,write: if true;')),/roots/));
test('refuses test audience',()=>assert.throws(()=>mergeLiveRules(base,add.replace('hero-defense-3d-independent','demo-hd3d-direct')),/audience/));
test('refuses missing fallback',()=>assert.throws(()=>mergeLiveRules(base,add.replace('match /{document=**} { allow read, write: if false; }','')),/default-deny/));

test('refuses an unreviewed literal-root replacement even with the exact root names',()=>{
 const alternate="rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\nfunction audience() { return request.auth.token.aud == 'hero-defense-3d-independent'; }\n"+
  LIVE_ROOTS.map(root=>'match /'+root+'/{id} { allow read, write: if true; }').join('\n')+
  '\nmatch /{document=**} { allow read, write: if false; }\n}}';
 assert.throws(()=>mergeLiveRules(base,alternate),/Unreviewed/);
});
test('refuses a literal-root replacement even when every grant denies',()=>{
 const alternate="rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\nfunction audience() { return request.auth.token.aud == 'hero-defense-3d-independent'; }\n"+
  LIVE_ROOTS.map(root=>'match /'+root+'/{id} { allow read, write: if false; }').join('\n')+
  '\nmatch /{document=**} { allow read, write: if false; }\n}}';
 assert.throws(()=>mergeLiveRules(base,alternate),/Unreviewed/);
});
test('refuses even comment-only changes without a new review',()=>assert.throws(()=>mergeLiveRules(base,add+'\n// unreviewed edit\n'),/Unreviewed/));

console.log(JSON.stringify({passed:rows.length,failed:0,cases:rows}));
