import assert from 'node:assert/strict';
import {source} from './direct-global-migration.test.mjs';
import {planGlobalMigration,directRoot} from '../direct/global-migration-plan.mjs';
import {planGlobalReverse} from '../direct/global-reverse-plan.mjs';
import {encodeFields,decodeFields} from '../src/account/direct-store.js';
import {fromDocument} from '../server/firestore.mjs';
const s=source(),p=planGlobalMigration(s),ds=structuredClone([...p.data,...p.activations]);
for(const d of ds.filter(d=>d.name.endsWith('/_activation'))){const v=decodeFields(d.fields);v.row.enabled=false;d.fields=encodeFields(v);}
const at='2026-11-10T00:00:00Z',job='global-a~broadcast-123',bid=1000000;
const add=(col,id,x)=>ds.push({name:directRoot+'/'+col+'/'+id,fields:encodeFields(x)});
add('hd3d_live_admin_actions','global-a~grant-123',{actor:'global-a',request:'grant-123',target:'global-b',action:'admin_grant_hero',logAction:'hero_grant',result:{ok:true},detail:{item:'hero_gunner'},at});
add('hd3d_live_broadcast_jobs',job,{actor:'global-a',request:'broadcast-123',bid,title:'test',body:'test',reward:{souls:1},targets:['global-a','global-b'],at});
const make=()=>{const counts={};for(const d of ds){const col=d.name.slice(directRoot.length+1).split('/').slice(0,-1).join('/');counts[col]=(counts[col]||0)+1;}return {forward:p,target:s,direct:{format:1,documents:ds,snapshot:{project:'demo-hd3d-direct',database:'(default)',readTime:at,writersStopped:true,pendingClientJournals:0,complete:true,collections:counts}}};};
assert.throws(()=>planGlobalReverse(make()),/Incomplete broadcast/);
for(const [index,target] of ['global-a','global-b'].entries())add('hd3d_live_broadcast_deliveries',job+'~'+index,{job,index,target,actor:'global-a',request:'broadcast-123_'+index,mail:1000+index,at});
assert.throws(()=>planGlobalReverse(make()),/receipt\/mail integrity/);
for(const [index,target] of ['global-a','global-b'].entries())add('hd3d_live/'+target+'/hd3d_mail',1000+index,{owner:target,version:1,row:{id:1000+index,user_id:target,title:'test',body:'test',reward:{souls:1},claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:bid,created_at:at}});
const reverse=planGlobalReverse(make());assert(reverse.documents.some(d=>d.name.includes('/hd3d_admin_log/')&&fromDocument(d).action==='hero_grant'));assert(reverse.documents.some(d=>d.name.endsWith('/hd3d_broadcasts/'+bid)&&fromDocument(d).recipients===2));assert(reverse.archivedDirectSnapshot.documents.some(d=>d.name.endsWith('/'+job)));
console.log('PASS admin action audit and completed broadcast reverse into legacy history; incomplete broadcast blocks reversal');
