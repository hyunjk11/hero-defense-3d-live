// Synthetic users and local emulator only. Never production Auth or data.
import {assert,fs,root,config,user,rest,get,client,rows,test,raw} from './emulator-harness.mjs';
import * as catalog from './catalog.mjs';
import {ensureDirectAccount,bootstrapDirect,bootstrapDocuments} from '../src/account/direct-bootstrap.js';
import {encodeFields,decodeFields} from '../src/account/direct-store.js';
const evidence=new URL('../../direct-fresh-live-evidence-2/',import.meta.url);
await rest(':commit',{writes:[...Object.values(catalog).flatMap(fn=>fn()),{name:root+'/hd3d_live_order_counter/main',fields:encodeFields({value:0})}].map(update=>({update}))});
const oldNames=['hd3d_progress/same-auth','hd3d_users/same-auth','hd3d_admins/same-auth','hd3d_direct/same-auth/hd3d_progress/same-auth'];
await rest(':commit',{writes:oldNames.map(name=>({update:{name:root+'/'+name,fields:encodeFields({sentinel:'unchanged synthetic legacy',souls:777777})}}))});
const oldBefore=await Promise.all(oldNames.map(n=>rest('/'+n,null,'owner','GET')));
const calls=[];
const tracked=async(url,o={})=>{
 const names=[url,...(o.body?JSON.stringify(JSON.parse(o.body)).match(/projects\/[^"\s]+/g)||[]:[])];
 assert(names.every(n=>!n.includes('/documents/hd3d_direct/')&&!/\/documents\/hd3d_(progress|users|admins)\//.test(n)));
 calls.push({method:o.method||'GET',commit:url.endsWith(':commit')});return fetch(url,o);
};
const options=uid=>{const u=user(uid);return {auth:{currentUser:u},user:u,fetcher:tracked};};
await test('existing Auth UID with old save/admin records starts zero in live namespace',async()=>{
 await ensureDirectAccount(config,options('same-auth'));
 const p=await get('same-auth','progress');assert.equal(p.authority.souls,0);assert.deepEqual(p.authority.st,{});
 assert.equal((await get('same-auth','growth_wallet')).balance,0);
 assert.equal((await client('same-auth').rpc('is_admin')),false);
});
await test('old roots and old direct namespace are byte-identical after fresh initialization',async()=>{
 assert.deepEqual(await Promise.all(oldNames.map(n=>rest('/'+n,null,'owner','GET'))),oldBefore);
});
await test('repeat login does not rewrite live activation/save',async()=>{
 const before=await get('same-auth','progress'),n=calls.filter(x=>x.commit).length;
 await ensureDirectAccount(config,options('same-auth'));assert.equal(calls.filter(x=>x.commit).length,n);assert.deepEqual(await get('same-auth','progress'),before);
});
await test('bootstrap committed response loss recovers by reading activation',async()=>{
 const opt=options('lost-bootstrap');let lost=0;
 await assert.rejects(ensureDirectAccount(config,{...opt,fetcher:async(url,o)=>{const r=await tracked(url,o);if(url.endsWith(':commit')&&r.ok){lost++;throw Error('synthetic reply loss');}return r;}}),/reply loss/);
 assert.equal(lost,1);const before=await get('lost-bootstrap','progress');await ensureDirectAccount(config,opt);assert.deepEqual(await get('lost-bootstrap','progress'),before);
});
await test('simultaneous bootstrap creates one zero account without overwrite',async()=>{
 const opt=options('double-bootstrap'),rs=await Promise.allSettled([bootstrapDirect(config,opt),bootstrapDirect(config,opt)]);
 assert.equal(rs.filter(r=>r.status==='fulfilled').length,1);assert.equal((await get('double-bootstrap','sequences','_revision')).value,0);
});
await test('account change while acquiring token stops before network',async()=>{
 let network=0;const opt=options('switch-a');opt.user.getIdToken=async()=>{opt.auth.currentUser=user('switch-b');return 'unused';};
 await assert.rejects(ensureDirectAccount(config,{...opt,fetcher:async()=>{network++;throw Error('must not fetch');}}),e=>e.code==='ACCOUNT_CHANGED');assert.equal(network,0);
});
await test('partial existing live document cannot be reset by bootstrap',async()=>{
 const uid='partial';await rest(':commit',{writes:[{update:raw(uid,'progress',uid,{sentinel:'keep'},0)}]});
 const before=await get(uid,'progress');await assert.rejects(bootstrapDirect(config,options(uid)));assert.deepEqual(await get(uid,'progress'),before);
});
await test('cross-account/legacy/catalog reads and writes remain protected',async()=>{
 const token=await user('lost-bootstrap').getIdToken();
 for(const n of ['hd3d_live/same-auth/hd3d_progress/same-auth',...oldNames])await assert.rejects(rest('/'+n,null,token,'GET'),e=>e.status===403);
 await assert.rejects(rest('/hd3d_live/same-auth/hd3d_progress/same-auth',null,'','GET'),e=>e.status===403);
 for(const name of ['hd3d_live/lost-bootstrap/hd3d_admins/lost-bootstrap','hd3d_live_catalog/_bootstrap','hd3d_progress/lost-bootstrap'])await assert.rejects(rest(':commit',{writes:[{update:{name:root+'/'+name,fields:encodeFields({owner:true,souls:999999})}}]},token),e=>e.status===403);
});
await test('cash/XP bootstrap forgery and missing atomic wallet are rejected',async()=>{
 for(const kind of ['cash','xp','missing']){
  const uid='fresh-forge-'+kind,ds=bootstrapDocuments(uid,user(uid).email);
  if(kind==='cash')ds.find(d=>d.name.endsWith('/hd3d_progress/'+uid)).fields.row.mapValue.fields.authority.mapValue.fields.souls={integerValue:'1'};
  if(kind==='xp')ds.find(d=>d.name.endsWith('/hd3d_growth_wallet/'+uid)).fields.row.mapValue.fields.granted={integerValue:'500'};
  await assert.rejects(rest(':commit',{writes:ds.filter(d=>kind!=='missing'||!d.name.includes('/hd3d_growth_wallet/')).map(update=>({update,currentDocument:{exists:false}}))},await user(uid).getIdToken()),e=>e.status===403);
 }
});
await test('fresh account metadata save survives new client and preserves empty economy',async()=>{
 const uid='same-auth',q=await client(uid).query({table:'hd3d_progress',action:'select',single:true}),save=structuredClone(q.data.data);
 save.settings={audio:{sfxOn:false}};
 const result=await client(uid).query({table:'hd3d_progress',action:'update',returning:true,filters:{user_id:uid,updated_at:q.data.updated_at},values:{data:save,merged:true}});
 assert.equal(result.data.length,1);const after=(await client(uid).query({table:'hd3d_progress',action:'select',single:true})).data.data;
 assert.equal(after.settings.audio.sfxOn,false);assert.equal(after.souls,0);
 assert.deepEqual(await Promise.all(oldNames.map(n=>rest('/'+n,null,'owner','GET'))),oldBefore);
});
await fs.writeFile(new URL('fresh-live-emulator-results.json',evidence),JSON.stringify({tests:rows,trackedCalls:calls.length,productionReads:0,productionWrites:0,identity:'synthetic emulator JWT'},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length,failed:rows.filter(x=>!x.pass).map(x=>x.name)}));
process.exitCode=rows.some(x=>!x.pass)?1:0;
