import assert from 'node:assert/strict';
import {planAccountMigration} from '../direct/migration-plan.mjs';
import {accountTables} from '../direct/migration.mjs';
import {toDocument,numericTables,PROJECT} from '../server/firestore.mjs';
import {empty} from '../src/account/progress.js';
import {makeItem,chestOf} from '../src/account/equip.js';
import {packItem} from '../src/account/storpack.js';
const uid='offline-plan-account',save=empty();save.unknown={kept:['nested',7]};
const it=makeItem('armor',null,1,()=>.4,1);it.id='offline-item';delete it.e;save.stor=[packItem(it)];
const chest=makeItem('weapon','mage',2,()=>.3,1);chest.id='offline-chest';save.chests=[chestOf(chest,'boss')];
function bundle(){return {format:1,uid,snapshot:{sourceProject:PROJECT,database:'(default)',readTime:'2026-11-04T00:00:00.000Z',writersStopped:true,pendingClientJournals:0,tables:Object.fromEntries(accountTables.map(t=>[t,t==='hd3d_progress'?1:0]))},
 sequenceHighWater:Object.fromEntries([...numericTables].map(t=>[t,100])),documents:[toDocument('hd3d_progress',{user_id:uid,data:structuredClone(save),merged:true,updated_at:'2026-11-04T00:00:00.000Z'})]};}
const input=bundle(),frozen=structuredClone(input),p=planAccountMigration(input);assert.deepEqual(input,frozen);assert.deepEqual(p,planAccountMigration(input));assert.equal(p.noExternalWrites,true);assert.equal(p.productionReady,false);assert.ok(p.data.every(d=>!d.name.endsWith('/_activation')));assert.ok(p.activation.name.endsWith('/_activation'));assert.deepEqual(p.sourceBackup,input);
console.log('PASS offline plan deterministic, source preserved, activation separate and production disabled');
for(const change of [b=>delete b.snapshot.tables.hd3d_mail,b=>b.snapshot.tables.hd3d_mail=1,b=>b.snapshot.tables.extra=0,b=>b.snapshot.sourceProject='other',b=>b.snapshot.pendingClientJournals=1,b=>b.snapshot.writersStopped=false,b=>delete b.sequenceHighWater.hd3d_mail,b=>b.documents[0].name=b.documents[0].name.replace(PROJECT,'other'),b=>b.uid='another-account']){const b=bundle();change(b);assert.throws(()=>planAccountMigration(b));}
console.log('PASS missing tables, count mismatch, wrong project/owner, live writer and missing high-water fail closed');
for(const table of ['hd3d_growth_runs','hd3d_dungeon_runs','hd3d_spire_runs']){const b=bundle(),row={id:1,user_id:uid,status:'active',done:false,token:'pending'};b.documents.push(toDocument(table,row));b.snapshot.tables[table]=1;assert.throws(()=>planAccountMigration(b),/Unfinished run/);}
console.log('PASS active ordinary/dungeon/tower histories require reconciliation before activation');
for(const place of ['inv','stor','chests']){const b=bundle(),s=structuredClone(save);s[place]=place==='chests'?[...s.chests,chestOf({...chest},'boss')]:[...(s[place]||[]),{...chest}];b.documents=[toDocument('hd3d_progress',{user_id:uid,data:s})];assert.throws(()=>planAccountMigration(b),/Duplicate/);}
console.log('PASS item identity collision across bag/storage/unopened chest is reported, never silently repaired');
const changed=bundle();changed.documents[0].fields.payload.stringValue=changed.documents[0].fields.payload.stringValue.replace('nested','different');assert.notEqual(planAccountMigration(changed).sourceHash,p.sourceHash);
assert.equal(p.rollback.reverseReconciliationRequired,true);assert.equal(p.rollback.preserveSource,true);
console.log('PASS source checksum detects change; rollback explicitly requires reconciling newer direct writes');
