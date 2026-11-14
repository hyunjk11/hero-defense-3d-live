import assert from 'node:assert/strict';
import {adminReadDocuments} from '../direct/admin-read-migration.mjs';
import {decodeFields} from '../src/account/direct-store.js';
import {isAdminReadOperation} from '../src/account/direct-admin-read.js';
const s={project:'demo-hd3d-direct',complete:true,writersStopped:true,uids:['a','b'],audit:[{id:1,admin_id:'a',target_user:'b',action:'ban',created_at:'2026-01-01T00:00:00Z'}]};
const p=adminReadDocuments(s);assert.equal(p.productionReady,false);assert.equal(p.noExternalWrites,true);assert.equal(p.documents.length,3);assert.deepEqual(decodeFields(p.documents[0].fields),{uid:'a'});assert.deepEqual(decodeFields(p.documents[2].fields).row,s.audit[0]);assert.deepEqual(p,adminReadDocuments(structuredClone(s)));
for(const v of [{project:'real'},{complete:false},{writersStopped:false},{uids:['a','a']},{uids:['a/xx']},{audit:[{...s.audit[0],target_user:'missing'}]},{audit:[s.audit[0],s.audit[0]]},{audit:[{...s.audit[0],created_at:'bad'}]}])assert.throws(()=>adminReadDocuments({...s,...v}));
for(const name of ['admin_users','admin_user','admin_orders','admin_log_list','admin_spire','owner_admins'])assert(isAdminReadOperation({name:'hd3d_'+name}));for(const name of ['admin_grant_hero','owner_add_admin','admin_refund'])assert(!isAdminReadOperation({name}));
console.log('PASS trusted offline admin UID/audit import validation, no external writes, immutable export and read-only operation whitelist');
