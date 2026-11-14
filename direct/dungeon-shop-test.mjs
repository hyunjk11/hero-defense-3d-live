import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,config,raw} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT,createDirectTransport,decodeFields,encodeFields} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {dungeonShopCatalog,mailItemCatalog,itemCatalog} from './catalog.mjs';
import {dungeonItems} from '../server/dungeon.mjs';
import * as E from '../src/account/equip.js';
import {seeded} from '../src/account/rewarditems.js';
import {mailItemId} from '../src/account/direct-mail-items.js';

await rest(':commit',{writes:[dungeonShopCatalog(),...itemCatalog(),...mailItemCatalog()].map(update=>({update}))});
const suffix=Date.now().toString(36),id=n=>'shop9-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
async function putSave(uid,s){const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:s,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});}
async function fixture(uid,medals=1000){const {save}=await seed(uid);await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_dungeon_wallet',uid,{user_id:uid,medals,earned:medals,spent:0,titles:[],uniques:['legacy'],uq_pity:3,updated_at:new Date().toISOString()})}]});return save;}
async function mail(uid,n,reward){await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_mail',n,{id:n,user_id:uid,title:'synthetic legacy mail',body:'fixture',reward,claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:null,created_at:new Date().toISOString()})}]});}
let seq=0;const buyArgs=item=>({p_id:'dungeon-buy-'+(++seq),p_item:item});
const claim=(uid,n,c=client(uid))=>c.rpc('claim_mail',{p_mail_id:n});
await test('all twelve original products keep price, title, descriptor and one debit',async()=>{
 const uid=id('catalog'),start=await fixture(uid),c=client(uid);let spent=0;const matrix=[];
 for(const [key,it] of Object.entries(dungeonItems)){
  const args=buyArgs(key),r=await c.rpc('dungeon_buy',args);assert.ok(r.ok);spent+=it.price;
  assert.equal(r.medals,1000-spent);assert.equal((await c.rpc('dungeon_buy',args)).already,true);
  if(it.reward){assert.deepEqual((await get(uid,'mail',r.mail)).reward,it.reward);const got=await claim(uid,r.mail);assert.ok(got.serverSaved);assert.equal((await claim(uid,r.mail)).already,true);
   if(it.reward.items){const x=it.reward.items[0],entry=got.got[0];assert.equal(entry.it.set,'morvia');assert.equal(entry.it.g,3);assert.equal(entry.it.s,x.s);assert.equal(entry.it.h,x.h);}}
  matrix.push({item:key,price:it.price,mail:r.mail,medals:r.medals});
 }
 assert.equal(matrix.length,12);const w=await get(uid,'dungeon_wallet');assert.equal(w.spent,spent);assert.deepEqual(w.titles,['lich_hunter']);assert.deepEqual(w.uniques,['legacy']);assert.equal(w.uq_pity,3);
 const after=await effective(uid);assert.equal(after.souls,start.souls+400);assert.equal(after.mat.steel,start.mat.steel+40);assert.equal(after.mat.crystal,start.mat.crystal+10);assert.equal(after.mat.essence,3);assert.equal(after.chests.length,7);
 await fs.writeFile(new URL('../../direct-firestore-evidence-22/shop-matrix.json',import.meta.url),JSON.stringify(matrix,null,2));
});
await test('poor wallet, already-owned title, bad product and reused command do not debit',async()=>{
 const uid=id('invalid');await fixture(uid,60);const c=client(uid),a=buyArgs('dg_title');assert.ok((await c.rpc('dungeon_buy',a)).ok);const before=await get(uid,'dungeon_wallet');
 assert.equal((await c.rpc('dungeon_buy',buyArgs('dg_title'))).reason,'already');assert.equal((await c.rpc('dungeon_buy',buyArgs('dg_steel'))).reason,'not_enough');assert.equal((await c.rpc('dungeon_buy',buyArgs('__proto__'))).reason,'bad_item');await assert.rejects(c.rpc('dungeon_buy',{...a,p_item:'dg_souls'}));assert.deepEqual(await get(uid,'dungeon_wallet'),before);
});
await test('lost purchase response and simultaneous same receipt charge exactly once',async()=>{
 const uid=id('purchase-loss');await fixture(uid);const a=buyArgs('dg_morvia_fighter');let lost=false;
 const c=client(uid,{fetcher:async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok&&!lost){lost=true;await r.clone().json();throw Error('lost purchase response');}return r;}});
 await assert.rejects(c.rpc('dungeon_buy',a),/lost/);const pair=await Promise.all([client(uid).rpc('dungeon_buy',a),client(uid).rpc('dungeon_buy',a)]);assert.ok(pair.every(x=>x.already));assert.equal(pair[0].mail,pair[1].mail);assert.equal((await get(uid,'dungeon_wallet')).medals,955);
 await Promise.all(pair.map(x=>claim(uid,x.mail)));assert.equal((await effective(uid)).chests.length,1);
});
await test('simultaneous distinct purchases serialize and cannot overspend',async()=>{
 const uid=id('race');await fixture(uid,8);const out=await Promise.all([client(uid).rpc('dungeon_buy',buyArgs('dg_steel')),client(uid).rpc('dungeon_buy',buyArgs('dg_souls'))]);assert.equal(out.filter(x=>x.ok).length,1);const w=await get(uid,'dungeon_wallet');assert.ok(w.medals>=0);assert.equal(w.medals+w.spent,8);
});
await test('ten-item legacy mail, materials, hidden hero fallback, g0 and legendary open with codex',async()=>{
 const uid=id('ten');const before=await fixture(uid);const items=Array.from({length:10},(_,i)=>({k:'gear',s:i%3===0?'weapon':i%3===1?'armor':'acc',g:i%5,c:1+(i%10),...(i%3===0?{h:i===0?'mechanic':'fighter'}:{})}));await mail(uid,7001,{items,souls:30,steel:5,medals:2});
 const r=await claim(uid,7001);assert.equal(r.got.length,10);const after=await effective(uid);assert.equal(after.chests.length,10);assert.equal(after.souls,before.souls+30);assert.equal(after.mat.steel,before.mat.steel+5);assert.equal((await get(uid,'dungeon_wallet')).medals,1002);assert.equal(after.chests[0].it.h,'archer');assert.ok(after.chests.every(x=>x.it.id.length<=16));
 for(const ch of after.chests){assert.ok((await client(uid).rpc('gear_action',{p_id:'open-mail-'+(++seq),p_action:'open',p_item:ch.id})).ok);}
 assert.equal((await effective(uid)).inv.length,10);assert.equal((await effective(uid)).codex['1'].archer,1);assert.equal((await claim(uid,7001)).already,true);assert.equal((await effective(uid)).chests.length,0);
});
await test('199/200 chest boundary applies one stored item then one exact automatic dismantle',async()=>{
 const uid=id('capacity'),s=await fixture(uid);s.chests=Array.from({length:199},(_,i)=>{const it=E.makeItem('armor',undefined,0,()=>.2,1);it.id='old-'+i;return E.chestOf(it,'chest');});await putSave(uid,s);
 await mail(uid,7002,{items:[{k:'gear',s:'armor',g:3,set:'morvia'},{k:'gear',s:'acc',g:3,set:'morvia'}]});const r=await claim(uid,7002);assert.equal(r.got[0].auto,false);assert.equal(r.got[1].auto,true);const after=await effective(uid);assert.equal(after.chests.length,200);assert.deepEqual(after.chests.slice(0,199),s.chests);assert.equal(after.mat.steel,s.mat.steel+12);assert.equal(after.mat.crystal,s.mat.crystal+3);assert.deepEqual(after.codex,s.codex);
});
await test('item and final claim response loss resume receipts without another item or currency',async()=>{
 for(const loseAt of [1,2,3]){const uid=id('mail-loss-'+loseAt);await fixture(uid);await mail(uid,7003,{souls:19,items:[{k:'gear',s:'armor',g:2,c:5},{k:'gear',s:'weapon',h:'mage',g:4,c:2}]});let commits=0;
  const c=client(uid,{fetcher:async(u,o)=>{const r=await fetch(u,o);if(u.endsWith(':commit')&&r.ok&&++commits===loseAt){await r.clone().json();throw Error('lost grant response');}return r;}});
  await assert.rejects(claim(uid,7003,c),e=>e.code==='DIRECT_MAIL_PENDING');const out=await claim(uid,7003);assert.ok(out.ok);const after=await effective(uid);assert.equal(after.chests.length,2);assert.equal(after.souls,1019);await claim(uid,7003);assert.deepEqual(await effective(uid),after);
 }
});
await test('invalid final descriptor rejects before any earlier item or currency is credited',async()=>{
 const uid=id('invalid-mail'),s=await fixture(uid);await mail(uid,7004,{souls:50,items:[{k:'gear',s:'armor',g:2,c:1},{k:'gear',s:'armor',g:5,c:1}]});await assert.rejects(claim(uid,7004),e=>e.code==='DIRECT_INVALID_MAIL');assert.deepEqual(await effective(uid),s);assert.equal((await get(uid,'mail',7004)).claimed,false);
});
await test('high numeric legacy ID and deterministic ID collision do not lose or shorten gear',async()=>{
 const uid=id('large-id'),s=await fixture(uid);const mid=Number.MAX_SAFE_INTEGER-1;await mail(uid,mid,{items:[{k:'gear',s:'armor',g:3,c:3}]});const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(mailItemId(uid,mid,0)));const collision='m'+Buffer.from(bytes).toString('hex').slice(0,15);const it=E.makeItem('armor',undefined,1,()=>.2,1);it.id=collision;s.inv=[it];await putSave(uid,s);await claim(uid,mid);const after=await effective(uid);assert.deepEqual(after.inv,s.inv);assert.notEqual(after.chests[0].it.id,collision);assert.equal(after.chests[0].it.id.length,16);
});
await test('raw forged free purchase, duplicate receipt and upgraded mail rarity are independently denied',async()=>{
 for(const mode of ['free','grade','skip']){const uid=id('raw-'+mode);await fixture(uid);const u=user(uid),auth={currentUser:u};let captured;
  if(mode!=='free')await mail(uid,7005,{items:[{k:'gear',s:'armor',g:1,c:1}]});
  const transport=createDirectTransport(config,{auth,fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body);throw Error('captured');}return fetch(url,o);}});
  await assert.rejects(transport({kind:'rpc',name:mode==='free'?'hd3d_dungeon_buy':'hd3d_claim_mail',args:mode==='free'?buyArgs('dg_steel'):{p_mail_id:7005}},u));assert.ok(captured);
  for(const w of captured.writes){const d=decodeFields(w.update.fields);if(mode==='free'&&w.update.name.includes('/hd3d_dungeon_wallet/')){d.row.medals=1000;d.row.spent=0;}
   if(mode==='grade'&&w.update.name.includes('/hd3d_growth_investments/')&&d.row.result?.it)d.row.result.it.g=4;
   w.update.fields=encodeFields(d);}
  if(mode==='skip')captured.writes=captured.writes.filter(w=>!w.update.name.includes('/hd3d_growth_investments/'));
  await deniedWrite(uid,captured.writes);assert.equal((await effective(uid)).chests.length,0);assert.equal((await get(uid,'dungeon_wallet')).medals,1000);
 }
});
await test('banned and other accounts cannot buy or claim another users mail',async()=>{
 const uid=id('owner'),other=id('other');await fixture(uid);await fixture(other);await mail(uid,7006,{items:[{k:'gear',s:'armor',g:3,c:1}]});await assert.rejects(claim(other,7006));
 await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_bans',uid,{user_id:uid,reason:'fixture'})}]});await assert.rejects(client(uid).rpc('dungeon_buy',buyArgs('dg_steel')));await assert.rejects(claim(uid,7006));assert.equal((await effective(uid)).chests.length,0);
});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/dungeon-shop-results.json',import.meta.url),JSON.stringify(rows,null,2));
console.log(JSON.stringify({passed:rows.filter(x=>x.pass).length,total:rows.length}));if(rows.some(x=>!x.pass))process.exitCode=1;
