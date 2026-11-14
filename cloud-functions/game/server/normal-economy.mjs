import {context,denied} from './common.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {STAGES} from '../src/data/stages.js';
import {waveBoss} from '../src/core/roster.js';
import {assertItemIdentity,assertRewardIdentity} from './economy-invariants.mjs';
// Match the established growth start/progress token contract through settlement.
const tokenOK=x=>typeof x==='string'&&/^[A-Za-z0-9-]{8,80}$/.test(x);
const int=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
// Same conservative spawn/renewable bound as the reviewed direct Rules. This
// bounds reward input; it is NOT proof that the reported combat took place.
export function killLimit(run,wave,now){
 const seconds=Math.max(0,Math.floor((now-Date.parse(run.started_at))/1000));
 const s=STAGES[run.stage],base=4*(17*wave+3*wave*(wave+1)/2);
 return Math.min(1e9,base*((s?s.ch>=4:wave>=40)?1+seconds*32:1));
}
export async function settleNormal(store,user,name,a,options){
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  if(name==='normal_pending'){if(Object.keys(a).length)denied('invalid pending query');return {data:[],error:null};}
  if(!tokenOK(a.p_token))denied('invalid run token');
  const id=c.uid+'~server-normal~'+a.p_token,prior=await c.get('growth_investments',id);
  if(name==='normal_status'){
   if(Object.keys(a).length!==1||!prior)denied('missing owned settlement');return {data:prior.result,error:null};
  }
  if(!['normal_settle','challenge_settle'].includes(name))denied('unsupported settlement');
  if(Object.keys(a).some(k=>!['p_token','p_wave','p_kills','p_stars','p_drops','p_bossKills'].includes(k))||!int(a.p_wave,10000)||!int(a.p_kills,1e9)||!int(a.p_stars,3)||
    !Array.isArray(a.p_drops)||a.p_drops.length>Math.floor(a.p_wave/5)+1||!Array.isArray(a.p_bossKills||[]))denied('invalid settlement');
  const bosses=a.p_bossKills||[],input={name,wave:a.p_wave,kills:a.p_kills,stars:a.p_stars,bosses};
  // Client drop objects never determine grade, stats, quantity or identity.
  const body=JSON.stringify(input);
  if(prior){if(prior.body!==body)denied('run ID reused');return {data:{...prior.result,already:true},error:null};}
  const run=await c.get('growth_runs',c.uid+'~'+a.p_token),p=await c.get('progress',c.uid);
  if(!run||!p||!run.done)denied('finished owned run required');
  const s=STAGES[run.stage],challenge=name==='challenge_settle';
  if(challenge?(run.mode!=='challenge'||run.won||a.p_stars!==0):(!s||run.mode!=='campaign'||a.p_wave>s.waves||
    (run.won?(a.p_wave!==s.waves||run.completed!==s.waves||a.p_stars<1):a.p_stars!==0)))denied('run mode mismatch');
  if(a.p_wave<run.completed||a.p_wave>run.completed+1||a.p_kills>killLimit(run,a.p_wave,c.now)||
    (a.p_wave===0&&a.p_kills!==0)||c.now<Date.parse(run.started_at)||c.now-Date.parse(run.started_at)<run.completed*2000)denied('implausible battle');
  if(bosses.length>a.p_wave||bosses.some((n,i)=>!Number.isSafeInteger(n)||n<1||n>a.p_wave||!waveBoss(s||null,n)||i>0&&n<=bosses[i-1]))denied('invalid boss kills');
  const drops=[];for(const wave of bosses)if(c.random()<E.BOSS_DROP)drops.push(E.randomItem(run.hero,E.bossOdds(wave),c.random,undefined,s?s.ch:P.openChapters(p.data)));
  const [next,got,loot]=P.applyRun(p.data,{wave:a.p_wave,kills:a.p_kills,drops,hero:run.hero,stage:!!s,ch:s?s.ch:'open',bossKills:bosses,
    repeatTarget:run.repeat?run.target:null,repeatStage:s?.id,repeatWin:!!run.won},c.random);
  let save=next,info=null;
  assertRewardIdentity(p.data,loot);
  assertItemIdentity(next);
  if(run.won)[save,info]=P.applyStage(save,s.id,a.p_stars,run.hero,c.random);
  const all=[...loot,...(info?.loot||[])];
  assertRewardIdentity(p.data,all);
  // Compact automatic dismantles: no unowned item needs to be echoed to UI.
  const result={ok:true,kind:challenge?'challenge':'normal',token:a.p_token,stage:s?.id,hero:run.hero,wave:a.p_wave,kills:a.p_kills,won:run.won,stars:a.p_stars,
    souls:got+(info?.souls||0),first:info?.first||false,unlocked:info?.unlocked||[],best:challenge&&a.p_wave>(p.data.bestWave||0),bestWave:save.bestWave,
    total:all.length,next:all.length,loot:all.map(x=>x.auto?{auto:true,y:x.y,src:x.src}:x)};
  await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
  await c.put('growth_investments',{id,user_id:c.uid,body,at:c.iso,action:'server_normal',token:a.p_token,result});
  return {data:result,error:null};
 });
}
