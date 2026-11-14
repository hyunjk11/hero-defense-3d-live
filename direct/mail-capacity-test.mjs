import {assert,fs,test,rows,rest,seed,client,get,user,deniedWrite} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT,decodeFields,encodeFields} from '../src/account/direct-store.js';
import * as E from '../src/account/equip.js';
import {itemCatalog,mailItemCatalog} from './catalog.mjs';
// Standalone capacity fixtures require the same immutable item catalog as live bootstrap.
await rest(':commit',{writes:[...itemCatalog(),...mailItemCatalog()].map(update=>({update}))});
const CAP=1000000000,suffix=Date.now().toString(36),id=x=>'mc10-'+x+'-'+suffix,iso=new Date().toISOString();
async function putSave(uid,s){const old=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:s,merged:true,created_at:old.created_at,updated_at:old.updated_at})}]});}
async function mail(uid,reward,mid=7007){await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_mail',mid,{id:mid,user_id:uid,title:'capacity fixture',body:'',reward,claimed:false,revoked:false,claimed_at:null,order_id:null,broadcast_id:null,created_at:iso})}]});}
function boxes(n){return Array.from({length:n},(_,i)=>{const it=E.makeItem('armor',undefined,0,()=>.3,1);it.id='old-'+i;return E.chestOf(it,'chest');});}
await test('currency-only upper bound defers without grant or final claim',async()=>{const uid=id('cash'),f=await seed(uid);f.save.souls=CAP;await putSave(uid,f.save);await mail(uid,{souls:1});const before=await get(uid,'progress'),r=await client(uid).rpc('claim_mail',{p_mail_id:7007});assert(r.deferred);assert.deepEqual(await get(uid,'progress'),before);assert.equal((await get(uid,'mail',7007)).claimed,false);});
for(const n of [0,199,200])await test('ten items at capacity '+n+' preserve items or exact material suffix',async()=>{
 const uid=id('ten'+n),f=await seed(uid);f.save.chests=boxes(n);const count=Math.max(0,10-(200-n));f.save.mat.steel=CAP-count*20-1;f.save.mat.crystal=CAP-count*8-1;await putSave(uid,f.save);
 const items=Array.from({length:10},()=>({k:'gear',s:'armor',g:4,c:1}));await mail(uid,{items,steel:1,crystal:1});
 const r=await client(uid).rpc('claim_mail',{p_mail_id:7007});assert(r.ok);const after=(await get(uid,'progress')).authority;
 assert.equal(after.gear.chests.length,Math.min(200,n+10));assert.equal(after.mat.steel,CAP);assert.equal(after.mat.crystal,CAP);assert.equal(r.got.filter(x=>x.auto).length,count);
});
for(const k of ['steel','crystal','essence'])await test(k+' overflow rejects whole new mail before first item',async()=>{
 const uid=id(k),f=await seed(uid);f.save.chests=boxes(200);f.save.mat[k]=CAP;await putSave(uid,f.save);await mail(uid,{[k]:1,items:[{k:'gear',s:'armor',g:4,c:1}]});const before=await get(uid,'progress');
 const r=await client(uid).rpc('claim_mail',{p_mail_id:7007});assert(r.deferred);assert.deepEqual(await get(uid,'progress'),before);assert.equal((await get(uid,'mail',7007)).claimed,false);
});
await test('two devices filling capacity between items defer known remainder then resume once',async()=>{
 const uid=id('race'),f=await seed(uid);f.save.souls=CAP-2;await putSave(uid,f.save);await mail(uid,{souls:1,items:[{k:'gear',s:'armor',g:0,c:1},{k:'gear',s:'armor',g:0,c:1}]});await mail(uid,{souls:2},7008);
 let injected=false;const second=client(uid,{fetcher:async(url,o)=>{if(url.endsWith(':commit'))await fs.writeFile('../direct-firestore-evidence-22/cap-race-last-commit.json',o.body);return fetch(url,o);}}),c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(!injected&&url.endsWith(':commit')&&r.ok&&JSON.parse(o.body).writes.some(w=>w.update?.fields.row?.mapValue?.fields?.result?.mapValue?.fields?.action?.stringValue==='mail_item')){injected=true;assert((await second.rpc('claim_mail',{p_mail_id:7008})).ok);}return r;}});
 const first=await c.rpc('claim_mail',{p_mail_id:7007});assert(first.deferred);assert.equal(first.got.length,1);let p=await get(uid,'progress');assert.equal(p.authority.souls,CAP);assert.equal(p.authority.gear.chests.length,1);
 // Real purchase through exact legacy one-step training transition.
 const {authoritativeSave}=await import('../src/account/direct-authority.js');const next=authoritativeSave(p.cosmetic,p.authority);next.heroLv.mage.hp++;next.souls-=30;
 await second.query({table:'hd3d_progress',action:'update',filters:{user_id:uid,updated_at:p.updated_at},values:{data:next,merged:true},returning:true});
 const done=await c.rpc('claim_mail',{p_mail_id:7007});assert(done.ok);p=await get(uid,'progress');assert.equal(p.authority.gear.chests.length,2);assert.equal(p.authority.souls,CAP-29);
 await second.rpc('claim_mail',{p_mail_id:7007});assert.deepEqual(await get(uid,'progress'),p);
});
await test('raw client cannot omit material budget, or issue item when final currency overflows',async()=>{
 const uid=id('raw'),f=await seed(uid);await mail(uid,{souls:1,items:[{k:'gear',s:'armor',g:0,c:1}]});let body;
 const c=client(uid,{fetcher:async(url,o)=>{if(url.endsWith(':commit')&&JSON.parse(o.body).writes.some(w=>w.update?.fields.row?.mapValue?.fields?.result?.mapValue?.fields?.action?.stringValue==='mail_item')){body=JSON.parse(o.body);throw Error('capture before send');}return fetch(url,o);}});
 await assert.rejects(c.rpc('claim_mail',{p_mail_id:7007}),/capture/);assert(body);
 await deniedWrite(uid,body.writes.filter(w=>!w.update.name.includes('~mailbudget~')));
 f.save.souls=CAP;await putSave(uid,f.save);
 for(const w of body.writes){if(w.update.name.includes('/hd3d_progress/')){const d=decodeFields(w.update.fields);d.row.authority.souls=CAP;w.update.fields=encodeFields(d);}}
 await deniedWrite(uid,body.writes);assert.equal((await get(uid,'progress')).authority.gear.chests.length,0);assert.equal((await get(uid,'mail',7007)).claimed,false);
});
await fs.writeFile('../direct-firestore-evidence-22/mail-capacity-results.json',JSON.stringify({production:false,rows},null,2));console.log('RESULT',rows.filter(x=>x.pass).length+'/'+rows.length);if(rows.some(x=>!x.pass))process.exitCode=1;
