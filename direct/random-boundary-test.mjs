import {assert,fs,rest,seed,get,raw,commit,user,deniedWrite} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT,encodeFields} from '../src/account/direct-store.js';
import {makeItem} from '../src/account/equip.js';
const uid='enhancement-rng-forgery';
const {save}=await seed(uid);save.souls=5000;save.mat={steel:5000,crystal:1000};
const item=makeItem('armor',null,4,()=>.4,3);item.id='existing-plus-five';item.e=5;save.inv=[item];
const original=await get(uid,'progress');
await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:original.created_at,updated_at:original.updated_at})}]});
const before=await get(uid,'progress'),after=structuredClone(before);
after.updated_at='2026-05-01';after.authority.souls-=360;after.authority.mat.steel-=12;after.authority.mat.crystal--;
// A malicious client chooses success without making a random draw.
after.authority.gear.inv[0].e=6;
const request='force-success',writes=commit(uid,'progress',uid,after,1);
writes[1].update.fields.row.mapValue.fields.proof={mapValue:{fields:encodeFields({op:'gear_enhance',request,token:item.id,hero:'',level:0,stat:'',slot:'',pay:'',pos:0})}};
writes.push({update:raw(uid,'growth_investments',uid+'~gear~'+request,{id:uid+'~gear~'+request,user_id:uid,at:'2026-05-01',body:'{}',result:{ok:true,id:request,action:'enhance'}},1)});
let denied=false;try{await deniedWrite(uid,writes);denied=true;}catch{}
const actual=await get(uid,'progress');
const result={scope:'demo emulator only; limitation intentionally matching original client-RNG enhancement, not fairness proof',denied,enhancement:actual.authority.gear.inv[0].e,souls:actual.authority.souls};
await fs.writeFile(new URL('../../direct-firestore-evidence-22/random-boundary.json',import.meta.url),JSON.stringify(result,null,2));
console.log(result);assert.equal(denied,false,'ordinary v34 paid success can be selected by a modified browser; this limitation must remain explicit');
assert.equal(actual.authority.gear.inv[0].e,6);assert.equal(actual.authority.souls,before.authority.souls-360);
assert.equal(actual.authority.mat.steel,before.authority.mat.steel-12);assert.equal(actual.authority.mat.crystal,before.authority.mat.crystal-1);
