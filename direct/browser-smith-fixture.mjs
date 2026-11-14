// Synthetic local Auth-emulator account only, after a normal signup.
// Not gameplay, not migration, and never allowed to target production.
import {rest,root,get,fs,assert} from './emulator-harness.mjs';
import {decodeFields,directDocument,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {makeItem,codexAdd} from '../src/account/equip.js';
assert.equal(DEMO_PROJECT,'demo-hd3d-direct');
const users=await rest(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_users',allDescendants:true}]}});
const found=users.filter(x=>x.document).map(x=>decodeFields(x.document.fields).row).filter(x=>/^smith6-\d+@example\.invalid$/.test(x.email)).sort((a,b)=>a.email.localeCompare(b.email)).at(-1);
assert.ok(found);const uid=found.id,p=await get(uid,'progress'),data=authoritativeSave(p.cosmetic,p.authority);
assert.equal(data.souls,0);assert.equal(data.inv.length,0);
data.souls=10000;data.mat={steel:1000,crystal:1000};
const it=makeItem('armor',null,3,()=>.4,1);it.id='smith-armor';it.e=1;data.inv=[it];codexAdd(data,it);
await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data,merged:true,created_at:p.created_at,updated_at:new Date().toISOString()})}]});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/browser-smith-fixture.json',import.meta.url),JSON.stringify({scope:'local synthetic resource fixture; not normal play',uid,before:authoritativeSave(p.cosmetic,p.authority),after:data},null,2));
console.log('One local synthetic smith fixture prepared; no credentials recorded.');
