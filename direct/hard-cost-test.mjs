import {assert,fs,test,rows,user,rest,seed,get,config,root} from './emulator-harness.mjs';
import {createDirectTransport,decodeFields,encodeFields,directDocument} from '../src/account/direct-store.js';
import * as catalog from './catalog.mjs';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {HARD_STAGES,hardReward} from '../src/data/hard.js';
await rest(':commit',{writes:Object.values(catalog).flatMap(fn=>fn()).map(update=>({update}))});
const suffix='cost'+Date.now().toString(36),id=n=>'hard14-'+n+'-'+suffix;
const effective=async uid=>{const p=await get(uid,'progress');return authoritativeSave(p.cosmetic,p.authority);};
const C=(uid,random=()=>.7,fetcher=async(url,o)=>{const r=await fetch(url,o);if(url.endsWith(':commit')&&!r.ok){await fs.writeFile('../direct-firestore-evidence-22/hard-failed-commit.json',o.body);}return r;})=>{const u=user(uid),auth={currentUser:u},t=createDirectTransport(config,{auth,random,fetcher});return {u,auth,rpc:(name,args={})=>t({kind:'rpc',name:'hd3d_'+name,args},u).then(x=>x.data)};};
async function fixture(n,{stage='hard-1-1',first=false,party=false,version=2,capacity=0}={}){
 const uid=id(n);await seed(uid,{hard:true});
 const w=await get(uid,'growth_wallet');w.hard={st:Object.fromEntries(Object.keys(HARD_STAGES).filter(k=>!first||k!==stage).map(k=>[k,3]))};
 const p=await get(uid,'progress'),save=authoritativeSave(p.cosmetic,p.authority);
 if(capacity){const {makeItem,addChests}=await import('../src/account/equip.js');for(let i=0;i<capacity;i++){const it=makeItem('armor',undefined,0,()=>.5,1);it.id='filled'+i;addChests(save,[{it,src:'chest'}]);}}
 const {authorityOf}=await import('../src/account/direct-authority.js');p.authority=authorityOf(save);
 await rest(':commit',{writes:[{update:directDocument(config.firebase.projectId,uid,'hd3d_growth_wallet',uid,w)},{update:{name:root+'/hd3d_live/'+uid+'/hd3d_progress/'+uid,fields:encodeFields({owner:uid,version:1,row:p})}}]});
 const c=C(uid),token='hard-test-'+n.replaceAll('_','-')+'-'+suffix,s=HARD_STAGES[stage];const r=await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_hero:'fighter',p_stage:stage,p_target:'mage',...(party?{p_partyVersion:1,p_partner:'mage'}:{})});assert(r.ok,JSON.stringify(r));
 const doc=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');const value=decodeFields(doc.fields);const at=new Date(Date.now()-120000).toISOString();value.row.started_at=at;value.row.hardRewardVersion=version;doc.fields=encodeFields(value);doc.fields.issuedAt={timestampValue:at};delete doc.createTime;delete doc.updateTime;await rest(':commit',{writes:[{update:doc}]});
 return {uid,c,token,s,before:await effective(uid),args:{p_token:token,p_completed:s.waves,p_win:true,p_finish:true,p_stars:3,p_kills:11}};
}

import {createDirectTransport as legacyTransport} from './fixtures/phase20-direct-store.mjs';
const comparisons=[];
for(const pair of [0,1])for(const variant of pair?['new','legacy']:['legacy','new']){
 const f=await fixture('cost-'+pair+'-'+variant);const metrics={http:0,commits:0,writes:0,requestedDocuments:0,ops:{}};
 const u=user(f.uid),auth={currentUser:u},fetcher=async(url,o)=>{metrics.http++;const b=o?.body?JSON.parse(o.body):{};metrics.requestedDocuments+=b.documents?.length||0;if(url.endsWith(':commit')){metrics.commits++;metrics.writes+=b.writes?.length||0;const rev=b.writes?.find(w=>w.update?.name.endsWith('/_revision'));const op=rev&&decodeFields(rev.update.fields).row.proof.op;metrics.ops[op]=(metrics.ops[op]||0)+1;}return fetch(url,o);};
 const t=(variant==='legacy'?legacyTransport:createDirectTransport)(config,{auth,fetcher,random:()=>.7});const start=performance.now(),r=await t({kind:'rpc',name:'hd3d_growth_progress',args:f.args},u),ms=performance.now()-start;assert(r.data.hardSaved);
 const a=await effective(f.uid);const result={souls:a.souls-f.before.souls,count:a.chests.length,grades:a.chests.map(x=>x.it.g),slots:a.chests.map(x=>x.it.s),heroes:a.chests.map(x=>x.it.h),stats:a.stats,seq:a.hardRewardSeq,summary:r.data.hardReward};
 comparisons.push({pair,variant,metrics,elapsedLocalMs:ms,result});
}
for(const pair of [0,1]){const a=comparisons.find(x=>x.pair===pair&&x.variant==='legacy'),b=comparisons.find(x=>x.pair===pair&&x.variant==='new');assert.deepEqual(a.result,b.result);assert(b.metrics.http<a.metrics.http);assert(b.metrics.writes<a.metrics.writes);}
await fs.writeFile('../direct-firestore-evidence-22/hard-cost-comparison.json',JSON.stringify({scope:'Same isolated starting save, H1-1 repeat, ten waves, eleven kills, random=.7; two pairs alternate order. Raw HTTP/doc writes not billed reads or live latency; no Auth/browser.',comparisons},null,2));
console.log(JSON.stringify(comparisons.map(({pair,variant,metrics,elapsedLocalMs})=>({pair,variant,metrics,elapsedLocalMs}))));
