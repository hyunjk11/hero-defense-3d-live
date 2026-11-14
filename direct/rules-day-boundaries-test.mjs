// Isolated Rules arithmetic probe. Restores product Rules in finally.
// It does not alter the clock or any game/user documents.
import {assert,fs,host,root,rest,user} from './emulator-harness.mjs';
const source=await fs.readFile(new URL('./firestore.rules',import.meta.url),'utf8');
const expression='int((request.time.toMillis() + 32400000) / 86400000)';assert.equal(source.split(expression).length-1,3);
const probe=`rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /day_probe11/{id} { allow create: if request.auth!=null && request.auth.token.aud=='demo-hd3d-direct' && request.resource.data.day==${expression.replace('request.time','request.resource.data.at')}; } } }`;
async function load(content){const r=await fetch(host+'/emulator/v1/projects/demo-hd3d-direct:securityRules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ignore_errors:false,rules:{files:[{name:'firestore.rules',content}]}})});const d=await r.json();assert(r.ok&&!d.issues?.some(i=>i.severity==='ERROR'),JSON.stringify(d));return d;}
const rows=[],auth=await user('day-probe-only').getIdToken();
try{
 await load(probe);
 for(const t of ['2026-11-04T14:59:59.999Z','2026-11-04T15:00:00.000Z','2026-11-04T23:59:59.999Z','2026-11-05T00:00:00.000Z','2026-11-05T14:59:59.999Z','2026-11-05T15:00:00.000Z','2026-11-08T15:00:00.000Z']){
  const day=Math.floor((Date.parse(t)+32400000)/86400000),id=crypto.randomUUID(),doc={name:root+'/day_probe11/'+id,fields:{at:{timestampValue:t},day:{integerValue:String(day)}}};
  await rest(':commit',{writes:[{update:doc}]},auth);doc.name+='-bad';doc.fields.day.integerValue=String(day-1);await assert.rejects(rest(':commit',{writes:[{update:doc}]},auth),e=>e.status===403);rows.push({time:t,koreanDay:day,acceptedExpected:true,rejectedPriorDay:true});
 }
}finally{await load(source);}
await fs.writeFile('../direct-firestore-evidence-22/rules-day-boundaries.json',JSON.stringify({pass:true,scope:'same source arithmetic in isolated emulator-only probe; fixed time inputs, no game clock spoofing',rows,productRulesRestored:true},null,2));console.log('PASS 7 date boundaries / 14 authenticated write decisions, product Rules restored');
