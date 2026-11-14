import {assert,fs,test,rows,user,rest,seed,client,get,deniedWrite,root,config} from './emulator-harness.mjs';
import {directDocument,createDirectTransport,decodeFields,encodeFields,unpackRow,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {packTypedItem} from '../src/account/direct-gear.js';
import {STAGES} from '../src/data/stages.js';
import {waveBoss} from '../src/core/roster.js';
import * as E from '../src/account/equip.js';
const suffix=Date.now().toString(36),id=n=>'df7fix-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
const item=(name='drop-good',ch=1)=>({...E.makeItem('armor',null,3,()=>.4,ch),id:name});
const input=(token,drops,wave=5)=>({p_token:token,p_wave:wave,p_kills:0,p_stars:0,p_drops:drops});
async function fixture(uid,token,stage='1-1',wave=5,mutate=()=>{}){
 const {save}=await seed(uid);save.st=Object.fromEntries(Object.keys(STAGES).map(k=>[k,3]));mutate(save);
 const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:p.updated_at})}]});
 const c=client(uid);assert.ok((await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_stage:stage,p_hero:'mage'})).ok);
 // Explicitly isolated timestamp-aging fixture; no actual combat is claimed.
 const d=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');d.fields.issuedAt={timestampValue:new Date(Date.now()-300000).toISOString()};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});c.setNow(Date.now()+300000);
 assert.ok((await c.rpc('growth_progress',{p_token:token,p_completed:wave,p_win:false,p_finish:true})).ok);return c;
}
async function capture(uid,a){const u=user(uid);let writes;const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){const w=JSON.parse(o.body).writes;if(w.some(x=>decodeFields(x.update.fields).row.action==='normal_settle')){writes=w;throw Error('capture');}}return fetch(url,o);}});await assert.rejects(t({kind:'rpc',name:'hd3d_normal_settle',args:a},u),/capture/);return writes;}
await test('DF7-01 wrong chapter rejected before currency/progression/receipt; same token can correct input',async()=>{
 const uid=id('context'),token='wrong-context-08',c=await fixture(uid,token),before=await get(uid,'progress');
 await assert.rejects(c.rpc('normal_settle',input(token,[item('bad-chapter',2)])),/contextual/);assert.deepEqual(await get(uid,'progress'),before);assert.deepEqual(await c.rpc('normal_pending'),[]);
 const r=await c.rpc('normal_settle',input(token,[item()]));assert.equal(r.total,2);await c.rpc('normal_loot',{p_token:token,p_index:0});assert.equal((await c.rpc('normal_loot',{p_token:token,p_index:1})).next,2);assert.deepEqual(await c.rpc('normal_pending'),[]);
});
await test('API rejects grade0, wrong hero, illegal stats, oversize/duplicate/colliding item IDs before grants',async()=>{
 const uid=id('api'),token='drop-input-08',c=await fixture(uid,token,'1-1',10,s=>{s.inv=[item('in-bag')];s.stor=[item('in-store')];s.chests=[E.chestOf(item('in-chest'),'chest')];});const before=await get(uid,'progress');
 const bad=[{...item(),g:0},{...E.makeItem('weapon','warrior',2,()=>.4,1),id:'wrong-hero'},{...item(),m:['hp',99999]},item('01234567890123456'),item('in-bag'),item('in-store'),item('in-chest')];
 for(const it of bad)await assert.rejects(c.rpc('normal_settle',input(token,[it],10)));
 await assert.rejects(c.rpc('normal_settle',input(token,[item('duplicate'),item('duplicate')],10)));assert.deepEqual(await get(uid,'progress'),before);assert.deepEqual(await c.rpc('normal_pending'),[]);
});
await test('authenticated raw malformed/foreign/duplicate drops are rejected atomically, including last of four',async()=>{
 const uid=id('raw'),token='raw-drop-input-08',wave=STAGES['10-6'].waves,c=await fixture(uid,token,'10-6',wave);
 assert.equal(Math.max(...Object.values(STAGES).map(s=>Array.from({length:s.waves},(_,i)=>i+1).filter(n=>waveBoss(s,n)).length)),4);
 const drops=Array.from({length:4},(_,i)=>item('drop-four-'+i,10)),writes=await capture(uid,input(token,drops,wave)),before=await get(uid,'progress');
 for(const change of [d=>d[3].c=2,d=>d[3].g=0,d=>d[3].id=d[0].id,d=>d[3].id='x'.repeat(17),d=>d[3].spec.m[1]=999,d=>d[3].spec.sub.push({k:'hp',v:999}),d=>d[3]={},d=>d[3]=null,d=>d[3].h='warrior']){
  const w=structuredClone(writes),r=w.find(w=>w.update.name.includes('/hd3d_growth_investments/')),v=decodeFields(r.update.fields);change(v.row.result.drops);r.update.fields=encodeFields(v);await deniedWrite(uid,w);
 }
 assert.deepEqual(await get(uid,'progress'),before);await rest(':commit',{writes},await user(uid).getIdToken());let r=await c.rpc('normal_status',{p_token:token});while(r.next<r.total)r=await c.rpc('normal_loot',{p_token:token,p_index:r.next});assert.equal(r.next,r.total);assert.equal(r.loot.filter(x=>x.src==='boss').length,4);
});
await test('new random chest IDs avoid reserved later boss drop IDs',async()=>{
 const uid=id('reserved'),token='reserved-id-test8',c=await fixture(uid,token);const drop=item('reservedfuture');await c.rpc('normal_settle',input(token,[drop]));let calls=0;const u=user(uid);
 const t=createDirectTransport(config,{auth:{currentUser:u},uuid:()=>++calls===1?drop.id:'safe-new-id-08'});
 const r=(await t({kind:'rpc',name:'hd3d_normal_loot',args:{p_token:token,p_index:0}},u)).data;assert.equal(calls,2);assert.notEqual(r.loot[0].it.id,drop.id);
 const end=await c.rpc('normal_loot',{p_token:token,p_index:1});assert.equal(end.next,end.total);assert.equal(end.loot.at(-1).it.id,drop.id);
});
await test('actual pre-fix pending receipt terminates without replaying its already granted currency/chest',async()=>{
 const found=await rest(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_growth_investments',allDescendants:true}],where:{fieldFilter:{field:{fieldPath:'row.token'},op:'EQUAL',value:{stringValue:'audit-bad-drop-context'}}}}});
 const matches=found.filter(x=>x.document).map(x=>decodeFields(x.document.fields).row);assert.equal(matches.length,1,'Run df7-reproduce once before changing Rules');const old=matches[0],uid=old.user_id,c=client(uid),before=await effective(uid);
 if(old.status==='done'){
  const saved=JSON.parse(await fs.readFile(new URL('../../direct-firestore-evidence-22/df7-recovered.json',import.meta.url),'utf8'));assert.equal(saved.old.status,'pending');assert.equal(saved.old.result.next,1);assert.deepEqual(saved.before,saved.after);assert.deepEqual(before,saved.after);
  assert.ok((await c.rpc('normal_loot',{p_token:old.token,p_index:1})).already);assert.deepEqual(await effective(uid),before);assert.deepEqual(await c.rpc('normal_pending'),[]);return;
 }
 assert.equal(old.status,'pending');assert.equal(old.result.next,1);const result=await c.rpc('normal_loot',{p_token:old.token,p_index:1});assert.equal(result.next,2);assert.equal(result.last.skipped,true);assert.deepEqual(await effective(uid),before);assert.deepEqual(await c.rpc('normal_pending'),[]);
 assert.ok((await c.rpc('normal_loot',{p_token:old.token,p_index:1})).already);assert.deepEqual(await effective(uid),before);
 await fs.writeFile(new URL('../../direct-firestore-evidence-22/df7-recovered.json',import.meta.url),JSON.stringify({uid,before,old,result,after:await effective(uid)},null,2));
});
await test('a valid unpaid boss item cannot be skipped or exchanged for extra resources via raw repair',async()=>{
 const uid=id('noskip'),token='cannot-skip-valid',c=await fixture(uid,token);await c.rpc('normal_settle',input(token,[item()]));await c.rpc('normal_loot',{p_token:token,p_index:0});const u=user(uid);let captured;
 const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body).writes;throw Error('capture');}return fetch(url,o);}});await assert.rejects(t({kind:'rpc',name:'hd3d_normal_loot',args:{p_token:token,p_index:1}},u),/capture/);
 const p=await get(uid,'progress');for(const w of captured){const d=decodeFields(w.update.fields);if(w.update.name.includes('/hd3d_progress/'))d.row.authority=p.authority;if(w.update.name.includes('/hd3d_growth_investments/')){const skip={src:'boss',skipped:true,reason:'invalid_drop'};d.row.result.last=skip;d.row.result.loot[1]=skip;}w.update.fields=encodeFields(d);}
 await deniedWrite(uid,captured);assert.equal((await c.rpc('normal_loot',{p_token:token,p_index:1})).next,2);
});
await test('raw preflight bypass rejects foreign chapter, wrong stats/schema, missing manifest references and reserved investment IDs',async()=>{
 const uid=id('preflight'),token='preflight-raw-08',c=await fixture(uid,token),u=user(uid),before=await get(uid,'progress');let captured;
 const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body).writes;throw Error('capture');}return fetch(url,o);}});
 await assert.rejects(t({kind:'rpc',name:'hd3d_normal_settle',args:input(token,[item()])},u),/capture/);
 for(const change of [d=>d.c=2,d=>d.g=0,d=>d.h='warrior',d=>d.spec.m[1]=999,d=>d.spec.sub.push({k:'hp',v:999}),d=>d.id='x'.repeat(17),d=>d.e=1,d=>d.spec.u='fake',d=>d.s='fake']){
  const w=structuredClone(captured),r=w.find(w=>w.update.name.includes('/hd3d_growth_investments/')),v=decodeFields(r.update.fields);change(v.row.result.drop);r.update.fields=encodeFields(v);await deniedWrite(uid,w);
 }
 const w=structuredClone(captured);for(const x of w){const d=decodeFields(x.update.fields);if(x.update.name.includes('/hd3d_sequences/')){d.row.proof.op='normal_manifest';}else{d.row.id=d.row.id.replace('~drop~','~drops~');x.update.name=x.update.name.replace('~drop~','~drops~');const z=d.row.result;d.row.result={ok:true,action:'normal_manifest',token,ref:z.ref,refs:[z.ref],drops:[z.drop]};}x.update.fields=encodeFields(d);}await deniedWrite(uid,w);
 let invest;const ti=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){invest=JSON.parse(o.body).writes;throw Error('capture');}return fetch(url,o);}});
 await assert.rejects(ti({kind:'rpc',name:'hd3d_growth_invest',args:{p_id:'honest-invest-08',p_hero:'mage',p_level:2,p_revision:(await get(uid,'growth_wallet')).rev}},u),/capture/);
 const fake='drop~12345678~'+'a'.repeat(64);for(const x of invest){const d=decodeFields(x.update.fields);if(x.update.name.includes('/hd3d_sequences/'))d.row.proof.request=fake;else if(x.update.name.includes('/hd3d_growth_investments/')){d.row.id=uid+'~'+fake;d.row.result.id=fake;Object.assign(d.row.result,{action:'normal_drop',token:'12345678',drop:packTypedItem(item()),ref:'a'.repeat(64)});x.update.name=x.update.name.replace('honest-invest-08',fake);}x.update.fields=encodeFields(d);}await deniedWrite(uid,invest);
 assert.deepEqual(await get(uid,'progress'),before);assert.deepEqual(await c.rpc('normal_pending'),[]);
});
await test('lost preflight and root replies reconcile; concurrent retry grants only once',async()=>{
 const uid=id('lost'),token='lost-preflight08',c=await fixture(uid,token),u=user(uid),before=await effective(uid);let lost='normal_drop';
 const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok){const writes=JSON.parse(o.body).writes;const row=writes.map(x=>decodeFields(x.update.fields).row).find(x=>x.result?.action===lost||x.action===lost);if(row){lost='';throw Error('lost response');}}return r;}});
 const op={kind:'rpc',name:'hd3d_normal_settle',args:input(token,[item()])};await assert.rejects(t(op,u),/lost response/);assert.deepEqual(await effective(uid),before);assert.deepEqual(await c.rpc('normal_pending'),[]);
 lost='normal_settle';await assert.rejects(t(op,u),/lost response/);const committed=await effective(uid);assert.equal(committed.souls,before.souls+40);
 const replies=await Promise.all([c.rpc('normal_settle',op.args),c.rpc('normal_settle',op.args)]);assert.ok(replies.every(x=>x.already));assert.deepEqual(await effective(uid),committed);
 let r=replies[0];while(r.next<r.total)r=await c.rpc('normal_loot',{p_token:token,p_index:r.next});assert.equal(r.loot.length,2);assert.deepEqual(await c.rpc('normal_pending'),[]);
});
await test('legacy malformed sealed entries recover with a lost reply; at most four preflight slots and original 80-char investment IDs',async()=>{
 const saved=JSON.parse(await fs.readFile(new URL('../../direct-firestore-evidence-22/df7-recovered.json',import.meta.url),'utf8'));
 for(const [n,bad] of [null,{}, {...saved.old.result.drops[0],s:'invalid'}, {...saved.old.result.drops[0],g:9}, {...saved.old.result.drops[0],spec:null}].entries()){
  const uid=id('oldbad'+n),token='legacy-malformed08',c=await fixture(uid,token),p=await get(uid,'progress');const old={...saved.old,id:uid+'~normal~'+token,user_id:uid,token,result:{...saved.old.result,drops:[bad]}};
  // Explicit reconstruction of the historical sealed row in local test setup.
  await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_growth_investments',old.id,unpackRow('hd3d_growth_investments',old))}]});const before=await effective(uid);let lost=true;
  const u=user(uid),t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&lost){lost=false;throw Error('lost repair reply');}return r;}});
  await assert.rejects(t({kind:'rpc',name:'hd3d_normal_loot',args:{p_token:token,p_index:1}},u),/lost repair reply/);assert.ok((await c.rpc('normal_loot',{p_token:token,p_index:1})).already);assert.deepEqual(await effective(uid),before);assert.deepEqual(await c.rpc('normal_pending'),[]);
 }
 const uid=id('slot'),token='bounded-slots-08',c=await fixture(uid,token),u=user(uid);let captured;
 const t=createDirectTransport(config,{auth:{currentUser:u},fetcher:async(url,o)=>{if(url.endsWith(':commit')){captured=JSON.parse(o.body).writes;throw Error('capture');}return fetch(url,o);}});await assert.rejects(t({kind:'rpc',name:'hd3d_normal_settle',args:input(token,[item()])},u),/capture/);
 for(const w of captured){const d=decodeFields(w.update.fields);if(w.update.name.includes('/hd3d_sequences/'))d.row.proof.pos=4;else{d.row.result.index=4;d.row.id=d.row.id.replace(/~0$/,'~4');w.update.name=w.update.name.replace(/~0$/,'~4');}w.update.fields=encodeFields(d);}await deniedWrite(uid,captured);
 assert.ok((await c.rpc('growth_invest',{p_id:'x'.repeat(80),p_hero:'mage',p_level:2,p_revision:(await get(uid,'growth_wallet')).rev})).ok);
});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/drop-validation-results.json',import.meta.url),JSON.stringify({scope:'local emulator; synthetic aged runs, not actual combat',tests:rows},null,2));
console.log(JSON.stringify({tests:rows.length,passed:rows.filter(x=>x.pass).length}));process.exitCode=rows.some(x=>!x.pass)?1:0;
