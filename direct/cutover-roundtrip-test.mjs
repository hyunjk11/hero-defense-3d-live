// Trusted setup/import is restricted by emulator-harness to loopback/demo.
// All play/economy calls use ordinary owner Rules; only fixture export/import
// and explicit timestamp aging use the emulator's test owner credential.
import {assert,fs,rest,root,client,get,raw} from './emulator-harness.mjs';
import {accountTables} from './migration.mjs';
import {planAccountMigration} from './migration-plan.mjs';
import {planImportBatches,verifyImportedAccount} from './cutover-plan.mjs';
import {planReverseMigration} from './reverse-plan.mjs';
import {PROJECT,numericTables,toDocument,fromDocument} from '../server/firestore.mjs';
import {DEMO_PROJECT,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {empty} from '../src/account/progress.js';
import {initialGrowth} from '../src/data/hero-growth.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {stageCatalog,treeCatalog,itemCatalog,mailItemCatalog} from './catalog.mjs';
const uid='roundtrip11-'+Date.now().toString(36),time=new Date().toISOString(),save=empty();save.souls=1000;save.codex={'1':{mage:1}};save.keepLegacy={untouched:['field',7]};
const docs=[toDocument('hd3d_progress',{user_id:uid,data:save,merged:true,created_at:time,updated_at:time}),toDocument('hd3d_growth_wallet',{user_id:uid,...initialGrowth(save)}),toDocument('hd3d_profiles',{id:uid,nickname:'Roundtrip',created_at:time,updated_at:time}),toDocument('hd3d_mail',{id:7101,user_id:uid,title:'fixture',body:'',reward:{souls:7,items:[{k:'gear',s:'armor',g:0,c:1}]},claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:null,created_at:time})];
const original={format:1,uid,documents:docs,sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,10000])),snapshot:{sourceProject:PROJECT,database:'(default)',readTime:time,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(accountTables.map(t=>[t,docs.filter(d=>d.name.split('/').at(-2)===t).length]))}};
const plan=planAccountMigration(original),tables=[...accountTables,'hd3d_sequences'];
await rest(':commit',{writes:[...stageCatalog(),...treeCatalog(),...itemCatalog(),...mailItemCatalog()].map(update=>({update}))});
async function snapshot(){const documents=[];for(const t of tables){const r=await rest(`/hd3d_live/${uid}/${t}`,null,'owner','GET');documents.push(...(r.documents||[]));}return {uid,project:DEMO_PROJECT,database:'(default)',readTime:new Date().toISOString(),writersStopped:true,complete:true,documents};}
let snap=await snapshot();const first=planImportBatches(plan,snap,{batchSize:3});await rest(':commit',{writes:first.batches[0]});
snap=await snapshot();await fs.writeFile('../direct-firestore-evidence-22/cutover-first-read.json',JSON.stringify({expected:plan.data,snap},null,2));assert.throws(()=>verifyImportedAccount(plan,snap),/count/);const resumed=planImportBatches(plan,snap,{batchSize:3});assert.equal(resumed.existingData,3);for(const writes of resumed.batches)await rest(':commit',{writes});
snap=await snapshot();const verified=verifyImportedAccount(plan,snap);const c=client(uid);await assert.rejects(c.rpc('spire_start',{p_from:1,p_growth:1}));await rest(':commit',{writes:[verified.activation]});
assert(verifyImportedAccount(plan,await snapshot(),{activated:true}).ok);assert.equal(planImportBatches(plan,await snapshot()).batches.length,0);
const mail=await c.rpc('claim_mail',{p_mail_id:7101});assert(mail.ok);let p=await get(uid,'progress');assert.equal(p.authority.souls,1007);assert.equal(p.authority.gear.chests.length,1);
// Open the granted chest through the existing gear operation contract.
const chest=p.authority.gear.chests[0];const opened=await c.rpc('gear_action',{p_id:crypto.randomUUID(),p_action:'open',p_item:chest.id});
assert(opened.ok);p=await get(uid,'progress');assert.equal(p.authority.gear.chests.length,0);assert.equal(p.authority.gear.inv.length,1);
const afterMail=authoritativeSave(p.cosmetic,p.authority);assert.deepEqual(afterMail.keepLegacy,save.keepLegacy);assert.notDeepEqual(afterMail.codex,save.codex);
const start=await c.rpc('spire_start',{p_id:crypto.randomUUID(),p_from:1,p_growth:1});assert(start.ok);
const runs=(await c.query({table:'hd3d_spire_runs',action:'select',filters:{},columns:'*'})).data,run=runs[0];const doc=await rest(`/hd3d_live/${uid}/hd3d_spire_runs/${run.id}`,null,'owner','GET'),env=decodeFields(doc.fields);env.row.started_at=new Date(Date.now()-35000).toISOString();const update={name:doc.name,fields:encodeFields(env)};update.fields.issuedAt={timestampValue:env.row.started_at};await rest(':commit',{writes:[{update}]});c.setNow(Date.now());assert((await c.rpc('spire_finish',{p_token:start.token,p_top:1})).ok);assert.equal((await get(uid,'growth_wallet')).balance,8);
snap=await snapshot();const target={project:PROJECT,database:'(default)',writersStopped:true,readTime:new Date().toISOString(),numericOccupancyComplete:true,accountDocuments:docs,numericOwners:Object.fromEntries([...numericTables].map(t=>[t,Object.fromEntries(docs.filter(d=>d.name.split('/').at(-2)===t).map(d=>[fromDocument(d).id,uid]))])),sequenceHighWater:original.sequenceHighWater};
function reverseInput(s){return {original,target,direct:{uid,documents:s.documents,snapshot:{project:DEMO_PROJECT,database:'(default)',readTime:s.readTime,writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(tables.map(t=>[t,s.documents.filter(d=>d.name.split('/').at(-2)===t).length]))}}};}
assert.throws(()=>planReverseMigration(reverseInput(snap)),/disabled/);
const activation=await get(uid,'sequences','_activation');await rest(':commit',{writes:[{update:raw(uid,'sequences','_activation',{...activation,enabled:false},0)}]});
await assert.rejects(c.rpc('spire_start',{p_id:crypto.randomUUID(),p_from:1,p_growth:1}));snap=await snapshot();const reverse=planReverseMigration(reverseInput(snap));
// Apply ONLY into this local emulator's legacy tables, never PROJECT's host.
const legacy=reverse.documents.map(d=>({...d,name:root+'/'+d.name.split('/documents/')[1]}));await rest(':commit',{writes:legacy.map(update=>({update,currentDocument:{exists:false}}))});
const reread=[];for(const d of legacy){const r=await rest('/'+d.name.split('/documents/')[1],null,'owner','GET');reread.push(fromDocument(r));assert.deepEqual(fromDocument(r),fromDocument(d));}
const backSave=fromDocument(reverse.documents.find(d=>d.name.includes('/hd3d_progress/'))).data;assert.deepEqual(backSave,authoritativeSave((await get(uid,'progress')).cosmetic,(await get(uid,'progress')).authority));
assert.equal(fromDocument(reverse.documents.find(d=>d.name.includes('/hd3d_mail/'))).claimed,true);assert.equal(fromDocument(reverse.documents.find(d=>d.name.includes('/hd3d_spire_best/'))).best_floor,1);
await fs.writeFile('../direct-firestore-evidence-22/cutover-roundtrip.json',JSON.stringify({pass:true,scope:'local emulator only; trusted synthetic export/import; ordinary Rules economy; tower fixture aged35s, not actual combat',uid,import:{documents:plan.data.length,interruptedAfter:3,resumeBatches:resumed.batches.length,activationLast:true},latest:{save:backSave,wallet:await get(uid,'growth_wallet'),entryCount:1},reverse:{documents:reverse.documents.length,readBackEqual:true,activationDisabled:true,sourcePreserved:true,sequenceHighWater:reverse.sequenceHighWater},limitations:reverse.exclusions},null,2));console.log('PASS interrupted import -> exact verification -> activation -> claim/open/codex/tower XP -> freeze -> reverse -> exact emulator legacy reads');
