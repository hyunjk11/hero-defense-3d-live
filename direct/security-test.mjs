import {testHost} from './test-endpoint.mjs';
import {assert,fs,root,test,rows,user,rest,seed,client,get,deniedWrite,raw,commit} from './emulator-harness.mjs';
import {stageCatalog,bootstrapTemplate,treeCatalog} from './catalog.mjs';
import {encodeFields,decodeFields} from '../src/account/direct-store.js';
import {rankingDocuments} from './ranking-migration.mjs';
import {bootstrapDirect,bootstrapDocuments} from '../src/account/direct-bootstrap.js';
import {buyPerm} from '../src/account/progress.js';
await rest(':commit',{writes:[...stageCatalog(),...treeCatalog(),bootstrapTemplate()].map(update=>({update}))});
const proof=(op,extra={})=>({op,request:'',token:'',hero:'',level:0,stat:'',...extra});
function writes(uid,table,id,row,rev,p) {const w=commit(uid,table,id,row,rev);w[1].update.fields.row.mapValue.fields.proof={mapValue:{fields:encodeFields(p)}};return w;}
async function age(uid,id,seconds){
 const path=`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${id}`;
 const d=await rest(path,null,'owner','GET');
 d.fields.issuedAt={timestampValue:new Date(Date.now()-seconds*1000).toISOString()};delete d.createTime;delete d.updateTime;
 // Explicit trusted emulator fixture only. No client-time bypass is used by Rules.
 await rest(':commit',{writes:[{update:d}]});
}
async function save(uid,data,stamp){return client(uid).query({table:'hd3d_progress',action:'update',returning:true,filters:{user_id:uid,updated_at:stamp},values:{data,merged:true}});}
await test('typed migration preserves legacy save, inventory and codex',async()=>{const x=await seed('migration');const q=await client('migration').query({table:'hd3d_progress',action:'select',single:true});assert.deepEqual(q.data.data,x.save);});
await test('currency forgery through normal client is rejected atomically',async()=>{const uid='currency';await seed(uid);const p=await get(uid,'progress'),d=JSON.parse(p.saveJson);d.souls=999999;await assert.rejects(save(uid,d,p.updated_at),e=>e.code==='DIRECT_ACTION_REQUIRED'||e.status===403);assert.equal((await get(uid,'progress')).authority.souls,1000);assert.equal((await get(uid,'sequences','_revision')).value,0);});
await test('raw legacy blob currency and item forgery cannot affect effective save',async()=>{const uid='blob';await seed(uid);const p=await get(uid,'progress'),d=JSON.parse(p.saveJson);d.souls=999999;d.inv=[{id:'forged'}];d.st={'10-6':3};p.saveJson=JSON.stringify(d);p.updated_at='2026-02-01T00:00:00.000Z';await rest(':commit',{writes:writes(uid,'progress',uid,p,1,proof('save'))},await user(uid).getIdToken());const out=(await client(uid).query({table:'hd3d_progress',action:'select',single:true})).data.data;assert.equal(out.souls,1000);assert.deepEqual(out.inv,[]);assert.deepEqual(out.st,{});});
await test('raw authority cash, inventory, codex and stage forgeries are denied',async()=>{const uid='authority';await seed(uid);const p=await get(uid,'progress');for(const delta of [{souls:99999},{sealed:'{"inv":[{"id":"fake"}]}'},{st:{'10-6':3}},{mat:{steel:999,crystal:0}}])await deniedWrite(uid,writes(uid,'progress',uid,{...p,updated_at:'2026-02-01',authority:{...p.authority,...delta}},1,proof('save')));});
await test('metadata settings save works and retains economic state',async()=>{const uid='settings';await seed(uid);const p=await get(uid,'progress'),d=JSON.parse(p.saveJson);d.settings={audio:{sfxOn:false}};assert.equal((await save(uid,d,p.updated_at)).data.length,1);assert.equal((await get(uid,'progress')).authority.souls,1000);});
await test('legitimate town HP training uses exact atomic cost',async()=>{const uid='training';await seed(uid);const p=await get(uid,'progress');const [d,ok]=buyPerm(JSON.parse(p.saveJson),'mage','hp');assert.equal(ok,true);assert.equal((await save(uid,d,p.updated_at)).data.length,1);const a=(await get(uid,'progress')).authority;assert.equal(a.souls,970);assert.equal(a.heroLv.mage.hp,1);});
await test('two-device training consumes one stale snapshot at most once',async()=>{const uid='trainrace';await seed(uid);const p=await get(uid,'progress'),[d]=buyPerm(JSON.parse(p.saveJson),'mage','hp');const rs=await Promise.all([save(uid,d,p.updated_at),save(uid,d,p.updated_at)]);assert.equal(rs.filter(x=>x.data.length===1).length,1);assert.equal((await get(uid,'progress')).authority.souls,970);});
await test('free training, multi-stat training and wrong price rejected',async()=>{const uid='free';await seed(uid);const p=await get(uid,'progress');for(const change of [0,29,31]){const a=structuredClone(p.authority);a.heroLv.mage.hp++;a.souls-=change;await deniedWrite(uid,writes(uid,'progress',uid,{...p,authority:a,updated_at:'2026-02-01'},1,proof('economy_perm',{hero:'mage',stat:'hp'})));}});
await test('forged earned XP without an actual run delta is denied',async()=>{const uid='xpforge';await seed(uid);const w=await get(uid,'growth_wallet');for(const p of [proof('save'),proof('growth_invest',{hero:'mage',level:2,request:'forged'}),proof('growth_progress',{token:'missing-run'})])await deniedWrite(uid,writes(uid,'growth_wallet',uid,{...w,earned:1,balance:w.balance+1,rev:1},1,p));});
await test('two simultaneous investments cannot spend the same balance',async()=>{const uid='invest';await seed(uid,{balance:100});const rs=await Promise.all(['mage','archer'].map((h,i)=>client(uid).rpc('growth_invest',{p_id:'invest-id-'+i,p_hero:h,p_level:2,p_revision:0})));assert.equal(rs.filter(x=>x.ok).length,1);assert.equal((await get(uid,'growth_wallet')).balance,0);});
await test('investment receipt replay and different body cannot mint XP',async()=>{const uid='retry';await seed(uid);const c=client(uid),a={p_id:'invest-retry',p_hero:'mage',p_level:2,p_revision:0};assert.equal((await c.rpc('growth_invest',a)).ok,true);assert.equal((await c.rpc('growth_invest',a)).already,true);assert.equal((await c.rpc('growth_invest',{...a,p_hero:'archer'})).reason,'id_reused');assert.equal((await get(uid,'growth_wallet')).spent,100);});
await test('investment commit lost response recovers without replaying debit',async()=>{const uid='lost';await seed(uid);let n=0;const c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){n++;throw new TypeError('lost after commit');}return r;}});const a={p_id:'lost-invest',p_hero:'mage',p_level:2,p_revision:0};await assert.rejects(c.rpc('growth_invest',a),/lost after commit/);assert.equal(n,1);assert.equal((await client(uid).rpc('growth_invest',a)).already,true);});
await test('normal run start stores server-issued timestamp',async()=>{const uid='run';await seed(uid);const r=await client(uid).rpc('growth_start',{p_id:'normal-run',p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});assert.equal(r.ok,true);const d=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~normal-run`,null,'owner','GET');assert.ok(Date.now()-Date.parse(d.fields.issuedAt.timestampValue)<5000);});
await test('client clock advance cannot bypass server elapsed floor',async()=>{const c=client('run');c.setNow(Date.now()+100000);await assert.rejects(c.rpc('growth_progress',{p_token:'normal-run',p_completed:10,p_win:false,p_finish:false}),e=>e.status===403);assert.equal((await get('run','growth_wallet')).earned,0);});
await test('aged emulator run credits exact XP and retry cannot credit twice',async()=>{const uid='aged';await seed(uid);const c=client(uid),id='normal-aged';await c.rpc('growth_start',{p_id:id,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});await age(uid,id,60);c.setNow(Date.now()+60000);const a={p_token:id,p_completed:1,p_win:false,p_finish:true};assert.equal((await c.rpc('growth_progress',a)).xp,10);assert.equal((await c.rpc('growth_progress',a)).already,true);assert.equal((await get(uid,'growth_wallet')).earned,10);});
await test('raw forged run and wallet XP must agree with catalog formula',async()=>{const uid='formulaforge';await seed(uid);const c=client(uid),id='formula-run';await c.rpc('growth_start',{p_id:id,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});await age(uid,id,60);const rd=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${id}`,null,'owner','GET'),r=decodeFields(rd.fields).row,w=await get(uid,'growth_wallet'),rev=(await get(uid,'sequences','_revision')).value+1;
 const d=raw(uid,'growth_runs',r.id,{...r,completed:1,xp:999,done:true},rev);d.fields.issuedAt=rd.fields.issuedAt;
 await deniedWrite(uid,[{update:d},...writes(uid,'growth_wallet',uid,{...w,earned:999,balance:w.balance+999,rev:w.rev+1},rev,proof('growth_progress',{token:id}))]);});
await test('cross-account read, role escalation and legacy writes remain denied',async()=>{await seed('bob');await assert.rejects(rest('/hd3d_live/bob/hd3d_progress/bob',null,await user('run').getIdToken(),'GET'),e=>e.status===403);await deniedWrite('run',writes('run','admins','run',{user_id:'run',owner:true},2,proof('save')));await deniedWrite('run',[{update:{name:root+'/hd3d_progress/run',fields:encodeFields({payload:'{}'})}}]);});
await test('fresh ban blocks ordinary economy transactions',async()=>{const uid='ban';await seed(uid);await rest(':commit',{writes:[{update:raw(uid,'bans',uid,{user_id:uid,reason:'fixture'},0)}]});await assert.rejects(client(uid).rpc('growth_invest',{p_id:'banned-invest',p_hero:'mage',p_level:2,p_revision:0}),/banned/);});

await test('new account bootstrap is zero-valued and survives fresh client',async()=>{
 const uid='new-account',u=user(uid);await bootstrapDirect({firebase:{projectId:'demo-hd3d-direct'},firestoreEmulator:testHost},{auth:{currentUser:u},user:u});
 assert.equal((await get(uid,'progress')).authority.souls,0);assert.equal((await client(uid).rpc('growth_status')).growth.balance,0);
 assert.equal((await client(uid).query({table:'hd3d_progress',action:'select',single:true})).data.data.inv.length,0);
});
await test('bootstrap cannot reset a live account; legacy data does not block a fresh live save',async()=>{
 const uid='existing';await seed(uid);const u=user(uid),cfg={firebase:{projectId:'demo-hd3d-direct'},firestoreEmulator:testHost};
 await assert.rejects(bootstrapDirect(cfg,{auth:{currentUser:u},user:u}));assert.equal((await get(uid,'progress')).authority.souls,1000);
 const old=user('legacy-only');await rest(':commit',{writes:[{update:{name:root+'/hd3d_progress/legacy-only',fields:encodeFields({payload:'preserve'})}}]});
 await bootstrapDirect(cfg,{auth:{currentUser:old},user:old});
 assert.equal((await get(old.uid,'progress')).authority.souls,0);
 assert.equal(decodeFields((await rest('/hd3d_progress/legacy-only',null,'owner','GET')).fields).payload,'preserve');
});
await test('bootstrap inflation, omitted wallet and self-admin are denied',async()=>{
 for(const kind of ['cash','xp','missing','admin']){const uid='boot-'+kind;let ds=bootstrapDocuments(uid,user(uid).email);
 if(kind==='cash')ds.find(d=>d.name.endsWith('/hd3d_progress/'+uid)).fields.row.mapValue.fields.authority.mapValue.fields.souls={integerValue:'1'};
 if(kind==='xp')ds.find(d=>d.name.endsWith('/hd3d_growth_wallet/'+uid)).fields.row.mapValue.fields.granted={integerValue:'500'};
 if(kind==='missing')ds=ds.filter(d=>!d.name.includes('/hd3d_growth_wallet/'));
 if(kind==='admin')ds.push(raw(uid,'admins',uid,{user_id:uid,owner:true},0));
 await deniedWrite(uid,ds.map(update=>({update,currentDocument:{exists:false}})));}
});
await test('two concurrent new account bootstraps cannot overwrite the winner',async()=>{
 const uid='new-race',u=user(uid),cfg={firebase:{projectId:'demo-hd3d-direct'},firestoreEmulator:testHost};
 const rs=await Promise.allSettled([1,2].map(()=>bootstrapDirect(cfg,{auth:{currentUser:u},user:u})));assert.equal(rs.filter(x=>x.status==='fulfilled').length,1);assert.equal((await get(uid,'growth_wallet')).granted,0);
});
async function mailFixture(uid,id=6000,reward={souls:200,steel:40,crystal:10,essence:3}){
 await rest(':commit',{writes:[{update:raw(uid,'mail',String(id),{id,user_id:uid,title:'Fixture',body:'',reward,claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:null,created_at:'2026-01-01'},0)}]});
}
await test('trusted legacy currency mail claim and save are one atomic transaction',async()=>{
 const uid='mail';await seed(uid);await mailFixture(uid);const r=await client(uid).rpc('claim_mail',{p_mail_id:6000});assert.equal(r.serverSaved,true);
 const p=await get(uid,'progress');assert.equal(p.authority.souls,1200);assert.deepEqual(p.authority.mat,{steel:40,crystal:10,essence:3});assert.equal((await get(uid,'mail','6000')).claimed,true);
});
await test('mail concurrent claims, reconnect and stale saves cannot duplicate reward',async()=>{
 const uid='mail-race';await seed(uid);await mailFixture(uid);const old=await get(uid,'progress');const rs=await Promise.all([1,2].map(()=>client(uid).rpc('claim_mail',{p_mail_id:6000})));assert.equal(rs.filter(x=>!x.already).length,1);
 assert.equal((await save(uid,JSON.parse(old.saveJson),old.updated_at)).data.length,0);assert.equal((await client(uid).rpc('claim_mail',{p_mail_id:6000})).already,true);assert.equal((await get(uid,'progress')).authority.souls,1200);
});
await test('mail lost commit response recovers by immutable claim state',async()=>{
 const uid='mail-lost';await seed(uid);await mailFixture(uid);let count=0;const c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){count++;throw new TypeError('mail response lost');}return r;}});
 await assert.rejects(c.rpc('claim_mail',{p_mail_id:6000}),/response lost/);assert.equal(count,1);assert.equal((await client(uid).rpc('claim_mail',{p_mail_id:6000})).already,true);assert.equal((await get(uid,'progress')).authority.souls,1200);
});
await test('raw forged mail credit and own mail creation are denied',async()=>{
 const uid='mail-forged';await seed(uid);await mailFixture(uid);const p=await get(uid,'progress'),a=structuredClone(p.authority);a.souls+=9999;
 await deniedWrite(uid,writes(uid,'progress',uid,{...p,authority:a,updated_at:'2026-02-01'},1,proof('claim_mail',{request:'6000'})));
 const m=await get(uid,'mail','6000');await deniedWrite(uid,writes(uid,'mail','6001',{...m,id:6001,reward:{souls:999999}},1,proof('save')));
});
await test('revoked and foreign item mail cannot be consumed',async()=>{
 const uid='mail-block';await seed(uid);await mailFixture(uid,6100,{items:[{k:'gear',s:'armor',g:4,c:1}]});
 const m=await get(uid,'mail','6100');await rest(':commit',{writes:[{update:raw(uid,'mail','6100',{...m,revoked:true},0)}]});await assert.rejects(client(uid).rpc('claim_mail',{p_mail_id:6100}),/unavailable/);assert.equal((await get(uid,'mail','6100')).claimed,false);
 await assert.rejects(client('new-account').rpc('claim_mail',{p_mail_id:6000}),/unavailable/);
});

async function ageDungeon(uid,seconds){
 const run=(await client(uid).query({table:'hd3d_dungeon_runs',action:'select'})).data[0];
 const d=await rest(`/hd3d_live/${uid}/hd3d_dungeon_runs/${run.id}`,null,'owner','GET');
 d.fields.issuedAt={timestampValue:new Date(Date.now()-seconds*1000).toISOString()};delete d.createTime;delete d.updateTime;
 await rest(':commit',{writes:[{update:d}]});return run;
}
await test('dungeon status preserves medals and new entry consumes one daily slot',async()=>{
 const uid='dg-start';await seed(uid);const c=client(uid);assert.equal((await c.rpc('dungeon_status')).left,1);
 const r=await c.rpc('dungeon_start',{p_growth:1});assert.equal(r.ok,true);assert.equal((await c.rpc('dungeon_status')).left,0);assert.equal((await c.rpc('dungeon_start',{p_growth:1})).reason,'daily_limit');
});
await test('two-device dungeon entry cannot acquire two daily slots',async()=>{
 const uid='dg-race';await seed(uid);const r=await Promise.all([1,2].map(()=>client(uid).rpc('dungeon_start',{p_growth:1})));assert.equal(r.filter(x=>x.ok).length,1);
});
await test('dungeon server time blocks forged client-clock XP progression',async()=>{
 const uid='dg-clock';await seed(uid);const c=client(uid),r=await c.rpc('dungeon_start',{p_growth:1});c.setNow(Date.now()+120000);await assert.rejects(c.rpc('dungeon_ping',{p_token:r.token,p_floors:5}),e=>e.status===403);assert.equal((await get(uid,'growth_wallet')).earned,0);
});
await test('dungeon ping and finish preserve cumulative XP and medal/soul receipts',async()=>{
 const uid='dg-done';await seed(uid);const c=client(uid),r=await c.rpc('dungeon_start',{p_growth:1});await ageDungeon(uid,120);c.setNow(Date.now()+120000);
 const ping=await c.rpc('dungeon_ping',{p_token:r.token,p_floors:3});assert.equal(ping.xp,120);
 const done=await c.rpc('dungeon_finish',{p_token:r.token,p_floors:5,p_win:true});assert.equal(done.xp,300);assert.equal(done.medals,15);assert.equal(done.souls,2000);
 assert.equal((await get(uid,'growth_wallet')).earned,300);assert.equal((await get(uid,'dungeon_wallet')).medals,15);
 const again=await client(uid).rpc('dungeon_finish',{p_token:r.token,p_floors:5,p_win:true});assert.equal(again.mail,done.mail);assert.equal((await get(uid,'growth_wallet')).earned,300);
 assert.equal((await client(uid).rpc('claim_mail',{p_mail_id:done.mail})).ok,true);assert.equal((await get(uid,'progress')).authority.souls,3000);
});
await test('dungeon forged medal balance is rejected',async()=>{
 const uid='dg-done',w=await get(uid,'dungeon_wallet'),rev=(await get(uid,'sequences','_revision')).value+1;
 await deniedWrite(uid,writes(uid,'dungeon_wallet',uid,{...w,medals:w.medals+100,earned:w.earned+100},rev,proof('dungeon_finish',{request:'5001',token:'fake'})));
});
await test('dungeon commit response loss does not create a second run',async()=>{
 const uid='dg-lost';await seed(uid);let n=0;const c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){n++;throw new TypeError('dungeon response lost');}return r;}});
 await assert.rejects(c.rpc('dungeon_start',{p_growth:1}),/response lost/);assert.equal(n,1);assert.equal((await client(uid).rpc('dungeon_status')).used,1);assert.equal((await client(uid).rpc('dungeon_start',{p_growth:1})).reason,'daily_limit');
});

await test('unparseable untrusted blob cannot corrupt authoritative reload',async()=>{
 const uid='blob-json';await seed(uid);const p=await get(uid,'progress');p.saveJson='not-json';p.updated_at='2026-02-01';await rest(':commit',{writes:writes(uid,'progress',uid,p,1,proof('save'))},await user(uid).getIdToken());
 assert.equal((await client(uid).query({table:'hd3d_progress',action:'select',single:true})).data.data.souls,1000);
});
await test('ranking projection omits email/save and preserves ties/exclusion',async()=>{
 const rows=[{uid:'rank-a',nick:'A',floor:20,at:'2026-01-01',kind:'all',email:'never-published@example.invalid'}, {uid:'rank-b',nick:'B',floor:20,at:'2026-01-02',kind:'all'}, {uid:'rank-hidden',nick:'H',floor:999,at:'2026-01-01',kind:'all',excluded:true}];
 const ds=rankingDocuments(rows);assert.ok(ds.every(x=>!('email' in decodeFields(x.fields))));await rest(':commit',{writes:ds.map(update=>({update}))});
 await seed('rank-b');const r=await client('rank-b').rpc('spire_rank',{p_kind:'all'});assert.equal(r.top.length,2);assert.deepEqual(r.top.map(x=>x.nick),['A','B']);assert.equal(r.me.rank,2);
 await deniedWrite('rank-b',[{update:{...ds[0],fields:encodeFields({...decodeFields(ds[0].fields),floor:99999})}}]);
 await assert.rejects(rest('/hd3d_live_ranks/all~all~rank-a',null,null,'GET'),e=>e.status===403);
});

if(process.env.HD3D_AUTH_UNAVAILABLE==='1'){rows.push({name:'actual Auth emulator signup/login/refresh uses a zero bootstrap and same UID',pass:false,blocked:true,reason:'Auth 127.0.0.1:9199 currently not listening; protected startup not retried'});}else await test('actual Auth emulator signup/login/refresh uses a zero bootstrap and same UID',async()=>{
 const email='direct2-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+'aB7!';
 const call=async(action,body)=>{const r=await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:'+action+'?key=demo-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.ok,true);return r.json();};
 const a=await call('signUp',{email,password,returnSecureToken:true}),b=await call('signInWithPassword',{email,password,returnSecureToken:true});assert.equal(a.localId,b.localId);
 const u={uid:b.localId,email,getIdToken:async()=>b.idToken},auth={currentUser:u},cfg={firebase:{projectId:'demo-hd3d-direct'},firestoreEmulator:testHost};
 await bootstrapDirect(cfg,{auth,user:u});const p=await rest('/hd3d_live/'+u.uid+'/hd3d_progress/'+u.uid,null,b.idToken,'GET');assert.equal(decodeFields(p.fields).row.authority.souls,0);
 const r=await fetch('http://127.0.0.1:9199/securetoken.googleapis.com/v1/token?key=demo-key',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:b.refreshToken})});assert.equal(r.ok,true);assert.equal((await r.json()).user_id,u.uid);
 // Credentials remain in this function's memory and are never written or logged.
});
await test('Lv1 to 50 exact 51940 cost and invalid level requests cannot grant free levels',async()=>{
 const uid='max';await seed(uid,{balance:51940});const c=client(uid);assert.equal((await c.rpc('growth_invest',{p_id:'max-invest',p_hero:'mage',p_level:50,p_revision:0})).cost,51940);assert.equal((await get(uid,'growth_wallet')).balance,0);
 for(const level of [0,-1,51,1.5,'50',null])assert.equal((await c.rpc('growth_invest',{p_id:'bad-level-'+String(level),p_hero:'mage',p_level:level,p_revision:1})).ok,false);
});
await test('late committed response is discarded after A to B account change',async()=>{
 const uid='account-switch';await seed(uid);const c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok)c.auth.currentUser=user('bob');return r;}});
 await assert.rejects(c.rpc('growth_invest',{p_id:'switch-late',p_hero:'mage',p_level:2,p_revision:0}),e=>e.code==='ACCOUNT_CHANGED');assert.equal((await get('bob','growth_wallet')).balance,1000);
});
await test('trusted hero and medal mail grants atomically once with currency',async()=>{
 const uid='mail-mixed';await seed(uid);await mailFixture(uid,6200,{hero:'gunner',medals:12,souls:200});
 const c=client(uid),r=await c.rpc('claim_mail',{p_mail_id:6200});assert.equal(r.serverSaved,true);
 assert.equal((await get(uid,'owned',uid+'~hero_gunner')).source_mail,6200);
 assert.equal((await get(uid,'dungeon_wallet')).medals,12);assert.equal((await get(uid,'progress')).authority.souls,1200);
 assert.equal((await c.rpc('claim_mail',{p_mail_id:6200})).already,true);assert.equal((await get(uid,'dungeon_wallet')).medals,12);
 await mailFixture(uid,6201,{hero:'gunner',medals:1});await c.rpc('claim_mail',{p_mail_id:6201});assert.equal((await get(uid,'owned',uid+'~hero_gunner')).source_mail,6200);assert.equal((await get(uid,'dungeon_wallet')).medals,13);
});
await test('forged entitlement and unclaimed medal reward cannot be self-granted',async()=>{
 const uid='mail-grant-forge';await seed(uid);await mailFixture(uid,6300,{hero:'gunner',medals:10});
 await deniedWrite(uid,writes(uid,'owned',uid+'~hero_gunner',{user_id:uid,item:'hero_gunner',source_mail:6300,created_at:'2026-01-01'},1,proof('claim_mail',{request:'6300'})));
 const w={user_id:uid,medals:10,earned:10,spent:0,titles:[],uniques:[],uq_pity:0,updated_at:'2026-01-01'};
 await deniedWrite(uid,writes(uid,'dungeon_wallet',uid,w,1,proof('claim_mail',{request:'6300'})));
});
await test('empty informational mail can be consumed without economic change',async()=>{
 const uid='mail-empty';await seed(uid);await mailFixture(uid,6400,null);await client(uid).rpc('claim_mail',{p_mail_id:6400});assert.equal((await get(uid,'mail','6400')).claimed,true);assert.equal((await get(uid,'progress')).authority.souls,1000);
});
await test('expired dungeon is abandoned without XP, medals or reward mail',async()=>{
 const uid='dg-expired';await seed(uid);const c=client(uid),r=await c.rpc('dungeon_start',{p_growth:1});await ageDungeon(uid,11000);c.setNow(Date.now()+11000000);
 assert.equal((await c.rpc('dungeon_finish',{p_token:r.token,p_floors:5,p_win:true})).reason,'expired');assert.equal((await get(uid,'growth_wallet')).earned,0);assert.equal((await c.query({table:'hd3d_dungeon_runs',action:'select'})).data[0].status,'abandoned');
});
await test('next-day entry abandons prior active run and binds new token',async()=>{
 const uid='dg-old';await seed(uid);const old={id:4999,user_id:uid,day:'2026-01-01',token:'old-active',growth:true,status:'active',started_at:'2026-01-01T00:00:00.000Z',finished_at:null,floors:null,win:null,medals:0,uq:null,boss_reward:null,soul_reward:null,created_at:'2026-01-01'};
 const d=raw(uid,'dungeon_runs','4999',old,0);d.fields.issuedAt={timestampValue:old.started_at};await rest(':commit',{writes:[{update:d}]});
 const c=client(uid),r=await c.rpc('dungeon_start',{p_growth:1});assert.equal(r.ok,true);assert.equal((await get(uid,'dungeon_runs','4999')).status,'abandoned');
 assert.equal((await get(uid,'dungeon_runs','5001')).token,r.token);assert.equal((await c.rpc('dungeon_ping',{p_token:'old-active',p_floors:1})).reason,'used');
});
await test('zero-floor dungeon return grants nothing and is idempotent',async()=>{
 const uid='dg-zero';await seed(uid);const c=client(uid),r=await c.rpc('dungeon_start',{p_growth:1});const a={p_token:r.token,p_floors:0,p_win:false};
 const f=await c.rpc('dungeon_finish',a);assert.equal(f.souls,0);assert.equal(f.medals,0);assert.equal(f.mail,null);assert.equal((await get(uid,'growth_wallet')).earned,0);assert.equal((await c.rpc('dungeon_finish',a)).mail,null);
});
async function treeFixture(uid,level=50,hero='mage',branch='frost'){
 await seed(uid,{balance:60000});const p=await get(uid,'progress'),save=JSON.parse(p.saveJson);save.adv[hero]={b:branch};
 const w=await get(uid,'growth_wallet');w.xp[hero]=100*(level-1)+20*(level-1)*(level-2);w.spent=w.xp[hero];w.balance=w.granted-w.spent;
 const {packRow}=await import('../src/account/direct-store.js');await rest(':commit',{writes:[{update:raw(uid,'progress',uid,packRow('hd3d_progress',{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:p.updated_at}),0)},{update:raw(uid,'growth_wallet',uid,w,0)}]});
}
await test('all tree tiers and preset changes use bounded choices without spending XP',async()=>{
 const uid='tree';await treeFixture(uid);const c=client(uid),{treeOptions}=await import('../src/data/skill-tree.js');let rev=0;
 for(const tier of [15,20,30,40,50])for(const preset of [0,1]){
  const choice=treeOptions('mage','frost',tier)[preset].id,r=await c.rpc('growth_build',{p_id:`tree-${tier}-${preset}`,p_hero:'mage',p_branch:'frost',p_preset:preset,p_tier:tier,p_choice:choice,p_revision:rev++});assert.equal(r.ok,true);
 }
 const a={p_id:'tree-preset',p_hero:'mage',p_branch:'frost',p_preset:1,p_tier:null,p_choice:null,p_revision:rev};assert.equal((await c.rpc('growth_build',a)).ok,true);assert.equal((await c.rpc('growth_build',a)).already,true);
 const w=await get(uid,'growth_wallet');assert.equal(w.trees.mage.frost.active,1);assert.equal(w.spent,51940);assert.equal(w.balance,8060);
});
await test('tree level, branch, invalid choice and multi-node forgery are denied',async()=>{
 const uid='tree-locked';await treeFixture(uid,14);const c=client(uid),base={p_id:'tree-locked',p_hero:'mage',p_branch:'frost',p_preset:0,p_tier:15,p_choice:'wide',p_revision:0};
 assert.equal((await c.rpc('growth_build',base)).reason,'locked');assert.equal((await c.rpc('growth_build',{...base,p_branch:'flame'})).reason,'advancement');
 const w=await get(uid,'growth_wallet'),p=proof('growth_build',{request:'raw-tree',hero:'mage',branch:'frost',preset:0,tier:50,choice:'weave'});
 const tw={...w,rev:1,trees:{mage:{frost:{active:0,presets:[{'50':'weave'},{}]}}}};
 const receipt={id:uid+'~tree~raw-tree',user_id:uid,body:'[]',at:'2026-01-01'};
 await deniedWrite(uid,[...writes(uid,'growth_wallet',uid,tw,1,p),{update:raw(uid,'growth_investments',receipt.id,receipt,1)}]);
});
await test('tree concurrent requests and lost response retain a single selected revision',async()=>{
 const uid='tree-race';await treeFixture(uid);const make=(id,choice)=>({p_id:id,p_hero:'mage',p_branch:'frost',p_preset:0,p_tier:15,p_choice:choice,p_revision:0});
 const a=await Promise.all(['wide','dense'].map((choice,i)=>client(uid).rpc('growth_build',make('tree-race-'+i,choice))));assert.equal(a.filter(x=>x.ok).length,1);assert.equal((await get(uid,'growth_wallet')).rev,1);
 const c=client(uid,{fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok)throw new Error('tree lost response');return r;}}),request={...make('tree-lost','dense'),p_revision:1};
 await assert.rejects(c.rpc('growth_build',request),/lost response/);assert.equal((await client(uid).rpc('growth_build',request)).already,true);assert.equal((await get(uid,'growth_wallet')).rev,2);
});
await test('legacy claimed mail without a saved receipt is flagged, never silently treated as applied',async()=>{
 const uid='legacy-claim';await seed(uid);await assert.rejects(client(uid).rpc('claim_mail',{p_mail_id:900}),e=>e.code==='DIRECT_LEGACY_CLAIM_UNRESOLVED');assert.equal((await get(uid,'progress')).authority.souls,1000);
});
await test('high-level raw tree writes cannot add a second preset, branch or arbitrary choice',async()=>{
 const uid='tree-raw';await treeFixture(uid);const w=await get(uid,'growth_wallet'),p=proof('growth_build',{request:'raw-tree',hero:'mage',branch:'frost',preset:0,tier:15,choice:'wide'});
 const baseline={mage:{frost:{active:0,presets:[{'15':'wide'},{}]}}};
 for(const mutation of [t=>t.mage.frost.presets[0]['15']='invalid',t=>t.mage.frost.presets[1]['20']='control',t=>t.mage.flame={active:0,presets:[{},{}]}]){
  const trees=structuredClone(baseline);mutation(trees);const receipt={id:uid+'~tree~raw-tree',user_id:uid,body:'[]',at:'2026-01-01'};
  await deniedWrite(uid,[...writes(uid,'growth_wallet',uid,{...w,rev:1,trees},1,p),{update:raw(uid,'growth_investments',receipt.id,receipt,1)}]);
 }
});
await test('proof pollution, oversized optional fields and missing authority fields are rejected',async()=>{
 const uid='schema';await seed(uid);const p=await get(uid,'progress');
 for(const extra of [{branch:'x'.repeat(1000)},{preset:2},{tier:999},{choice:[]},{extra:'privileged'}])await deniedWrite(uid,writes(uid,'progress',uid,{...p,updated_at:'2026-02-01'},1,proof('save',extra)));
 for(const k of ['authority','cosmetic','user_id']){const broken={...p,updated_at:'2026-02-01'};delete broken[k];await deniedWrite(uid,writes(uid,'progress',uid,broken,1,proof('save')));}
 const ws=writes(uid,'progress',uid,{...p,updated_at:'2026-02-01'},1,proof('save'));ws[0].update.fields.owner={stringValue:'another-user'};await deniedWrite(uid,ws);
});
await test('all five heroes and ten branches accept only their five tiers/two choices',async()=>{
 const matrix=[],bs={archer:['wind','hawk'],mage:['flame','frost'],warrior:['paladin','berserk'],gunner:['duel','thorn'],fighter:['tiger','dragon']}, {treeOptions}=await import('../src/data/skill-tree.js');
 for(const [hero,branches]of Object.entries(bs))for(const branch of branches){
  const uid='matrix-'+branch;await treeFixture(uid,50,hero,branch);
  if(hero==='gunner')await rest(':commit',{writes:[{update:raw(uid,'owned',uid+'~hero_gunner',{user_id:uid,item:'hero_gunner'},0)}]});
  const c=client(uid);let rev=0;
  for(const tier of [15,20,30,40,50])for(const [preset,o]of treeOptions(hero,branch,tier).entries()){
   const r=await c.rpc('growth_build',{p_id:`matrix-${tier}-${preset}`,p_hero:hero,p_branch:branch,p_preset:preset,p_tier:tier,p_choice:o.id,p_revision:rev++});assert.equal(r.ok,true);matrix.push({hero,branch,tier,preset,choice:o.id,pass:true});
  }
  const w=await get(uid,'growth_wallet');assert.equal(w.spent,51940);assert.equal(w.balance,8060);
 }
 assert.equal(matrix.length,100);await fs.writeFile(new URL('../../direct-fresh-live-evidence-2/emulator/tree-matrix-results.json',import.meta.url),JSON.stringify(matrix,null,2));
});
await fs.writeFile(new URL('../../direct-fresh-live-evidence-2/emulator/security-results.json',import.meta.url),JSON.stringify({scope:'real local Firestore Rules; server time aging only via trusted emulator fixtures',tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length,failed:rows.filter(x=>!x.pass).map(x=>x.name)}));process.exitCode=rows.some(x=>!x.pass)?1:0;
