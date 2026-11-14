import {assert,fs,test,rows,user,rest,seed,client,get,config,root} from './emulator-harness.mjs';
import {createDirectTransport,decodeFields,encodeFields} from '../src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import {authoritativeSave} from '../src/account/direct-authority.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const suffix=Date.now().toString(36),id=n=>'boss14-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
const C=(uid,random=()=>0,fetcher=fetch)=>{const u=user(uid),auth={currentUser:u},t=createDirectTransport(config,{auth,random,fetcher});return {u,auth,rpc:(name,args={})=>t({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data)};};
async function fixture(n,seconds=120){const uid=id(n);await seed(uid);const c=C(uid),r=await c.rpc('dungeon_start',{p_growth:1});assert(r.ok);
 const [d]=(await rest(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_dungeon_runs',allDescendants:true}],where:{fieldFilter:{field:{fieldPath:'row.user_id'},op:'EQUAL',value:{stringValue:uid}}}}})).filter(x=>x.document).map(x=>x.document);
 const value=decodeFields(d.fields),at=new Date(Date.now()-seconds*1000).toISOString();value.row.started_at=at;d.fields=encodeFields(value);d.fields.issuedAt={timestampValue:at};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});return {uid,c,token:r.token,runId:value.row.id};}
const args=f=>({p_token:f.token,p_hero:'fighter'});
await test('original miss and three slot outcomes preserve descriptor/rarity and one reward',async()=>{
 const matrix=[];
 for(const [n,draw] of [['miss',[.30]],['weapon',[.299999,0]],['armor',[0,.5]],['acc',[0,.999999]]]){const f=await fixture(n),before=await effective(f.uid);let index=0;const c=C(f.uid,()=>draw[index++]??.5),r=await c.rpc('dungeon_boss_drop',args(f));assert(r.ok);
  if(n==='miss'){assert.equal(r.item,null);assert.equal(r.mail,null);}else{assert.equal(r.item.s,n);assert.equal(r.item.g,3);assert.equal(r.item.set,'morvia');assert.equal(r.item.h,n==='weapon'?'fighter':undefined);assert.deepEqual((await get(f.uid,'mail',r.mail)).reward,{items:[r.item]});
   assert((await c.rpc('claim_mail',{p_mail_id:r.mail})).serverSaved);const after=await effective(f.uid);assert.equal(after.chests.length,1);assert.equal(after.chests[0].it.set,'morvia');assert.equal(after.souls,before.souls);}
  const replay=await C(f.uid,()=>.99).rpc('dungeon_boss_drop',{...args(f),p_hero:'mage'});assert.deepEqual(replay,r);matrix.push({outcome:n,result:r});
 }
 await fs.writeFile('../direct-firestore-evidence-22/dungeon-boss-matrix.json',JSON.stringify(matrix,null,2));
});
await test('lost success/miss response and concurrent retries recover the committed outcome',async()=>{
 for(const hit of [true,false]){const f=await fixture('loss'+hit);let lost=false;const c=C(f.uid,()=>hit?0:.99,async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&r.ok&&!lost){lost=true;throw Error('lost boss response');}return r;});
  await assert.rejects(c.rpc('dungeon_boss_drop',args(f)),/lost boss/);assert(lost);const rs=await Promise.all([C(f.uid,()=>.99).rpc('dungeon_boss_drop',args(f)),C(f.uid,()=>0).rpc('dungeon_boss_drop',args(f))]);assert.deepEqual(rs[0],rs[1]);assert.equal(!!rs[0].mail,hit);
  const mails=await rest(`/hd3d_live/${f.uid}:runQuery`,{structuredQuery:{from:[{collectionId:'hd3d_mail'}]}});assert.equal(mails.filter(x=>x.document).length,hit?2:1);
 }
});
await test('too early, expired, bad hero/token and abandoned run cannot draw',async()=>{
 const early=await fixture('early',1);assert.equal((await early.c.rpc('dungeon_boss_drop',args(early))).reason,'too_early');
 const old=await fixture('old',10801);assert.equal((await old.c.rpc('dungeon_boss_drop',args(old))).reason,'expired');
 assert.equal((await early.c.rpc('dungeon_boss_drop',{...args(early),p_hero:'mechanic'})).reason,'bad_item');
 assert.equal((await early.c.rpc('dungeon_boss_drop',{p_token:'absent',p_hero:'mage'})).reason,'bad_token');
 const f=await fixture('abandoned'),p=`/hd3d_live/${f.uid}/hd3d_dungeon_runs/${f.runId}`,d=await rest(p,null,'owner','GET');const v=decodeFields(d.fields);v.row.status='abandoned';d.fields=encodeFields(v);d.fields.issuedAt={timestampValue:v.issuedAt};d.fields.closedAt={nullValue:null};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});assert.equal((await f.c.rpc('dungeon_boss_drop',args(f))).reason,'used');
});
await test('finish then boss draw uses server closure time; finish/replay never removes boss receipt',async()=>{
 const f=await fixture('finish');const done=await f.c.rpc('dungeon_finish',{p_token:f.token,p_floors:5,p_win:true});assert(done.ok);assert.equal(done.xp,300);
 const r=await f.c.rpc('dungeon_boss_drop',args(f));assert(r.mail);const end=await f.c.rpc('dungeon_finish',{p_token:f.token,p_floors:5,p_win:true});assert.equal(end.mail,done.mail);assert.equal((await get(f.uid,'dungeon_runs',f.runId)).boss_reward.mail,r.mail);
 const g=await fixture('closed-window');await g.c.rpc('dungeon_finish',{p_token:g.token,p_floors:5,p_win:true});const p=`/hd3d_live/${g.uid}/hd3d_dungeon_runs/${g.runId}`,d=await rest(p,null,'owner','GET');d.fields.closedAt={timestampValue:new Date(Date.now()-601000).toISOString()};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});await assert.rejects(g.c.rpc('dungeon_boss_drop',args(g)),e=>e.status===403);assert.equal((await get(g.uid,'dungeon_runs',g.runId)).boss_reward,null);
});
await test('simultaneous finish and boss draw keep both receipts without double currency',async()=>{
 const f=await fixture('race');const [done,boss]=await Promise.all([f.c.rpc('dungeon_finish',{p_token:f.token,p_floors:5,p_win:true}),C(f.uid).rpc('dungeon_boss_drop',args(f))]);assert(done.ok&&boss.ok);assert.equal((await get(f.uid,'growth_wallet')).earned,300);assert.equal((await get(f.uid,'dungeon_wallet')).medals,15);assert.equal((await get(f.uid,'dungeon_runs',f.runId)).boss_reward.mail,boss.mail);
});
await test('raw rarity, added currency, extra descriptor, detached mail and altered clocks are denied',async()=>{
 const f=await fixture('raw');let original;const capture=C(f.uid,()=>0,async(url,o)=>{if(url.endsWith(':commit')){original=JSON.parse(o.body);throw Error('capture');}return fetch(url,o);});await assert.rejects(capture.rpc('dungeon_boss_drop',args(f)),/capture/);assert(original);
 for(const mode of ['grade','currency','itemExtra','detached','clock','hero']){const b=structuredClone(original);
  for(const w of b.writes){const d=decodeFields(w.update.fields),run=w.update.name.includes('/hd3d_dungeon_runs/'),mail=w.update.name.includes('/hd3d_mail/');
   if(mode==='grade'){if(run)d.row.boss_reward.item.g=4;if(mail)d.row.reward.items[0].g=4;}
   if(mode==='currency'&&mail)d.row.reward.souls=999;
   if(mode==='itemExtra'){if(run)d.row.boss_reward.item.free=true;if(mail)d.row.reward.items[0].free=true;}
   if(mode==='hero'&&run)d.row.boss_reward.item.h='mage';
   w.update.fields=encodeFields(d);if(d.issuedAt)w.update.fields.issuedAt={timestampValue:d.issuedAt};if(d.closedAt)w.update.fields.closedAt={timestampValue:d.closedAt};if(mode==='clock'&&run)w.update.fields.issuedAt={timestampValue:'2000-01-01T00:00:00Z'};
  }
  if(mode==='detached')b.writes=b.writes.filter(w=>!w.update.name.includes('/hd3d_dungeon_runs/'));
  await assert.rejects(rest(':commit',b,await user(f.uid).getIdToken()),e=>e.status===403);
 }
 assert.equal((await get(f.uid,'dungeon_runs',f.runId)).boss_reward,null);
 await rest(':commit',original,await user(f.uid).getIdToken());
 await assert.rejects(rest(':commit',original,await user(f.uid).getIdToken()));
});
await test('capacity 200 uses existing auto-dismantle and does not add codex or a second claim',async()=>{
 const f=await fixture('capacity'),{makeItem,chestOf}=await import('../src/account/equip.js'),{directDocument,DEMO_PROJECT}=await import('../src/account/direct-store.js');const p=await get(f.uid,'progress'),save=await effective(f.uid);
 save.chests=Array.from({length:200},(_,i)=>{const it=makeItem('armor',undefined,0,()=>.2,1);it.id='old'+i;return chestOf(it,'chest');});await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,f.uid,'hd3d_progress',f.uid,{...p,data:save})}]});const r=await f.c.rpc('dungeon_boss_drop',args(f));const got=await f.c.rpc('claim_mail',{p_mail_id:r.mail});assert(got.got[0].auto);const after=await effective(f.uid);assert.equal(after.chests.length,200);assert.equal(after.mat.steel,save.mat.steel+12);assert.equal(after.mat.crystal,save.mat.crystal+3);assert.deepEqual(after.codex,save.codex);await f.c.rpc('claim_mail',{p_mail_id:r.mail});assert.deepEqual(await effective(f.uid),after);
});
await fs.writeFile('../direct-firestore-evidence-22/dungeon-boss-results.json',JSON.stringify({scope:'synthetic demo; issuedAt fixtures explicitly aged, no real gameplay proof',securityDifference:'A favorable client draw is accepted. Rules attest allowed descriptor and exactly-once commitment, NOT fair 30% chance.',rows},null,2));console.log(rows.filter(x=>x.pass).length+'/'+rows.length);if(rows.some(x=>!x.pass))process.exitCode=1;
