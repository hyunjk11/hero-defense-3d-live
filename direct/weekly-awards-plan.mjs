// OFFLINE trusted closed-week export -> immutable entitlement plan. No IO.
// Completeness/writer fencing is an operator obligation, not proven by hashes.
import {createHash} from 'node:crypto';
import {weeklyReward,weeklyTitle} from '../server/spire.mjs';
import {directDocument,DEMO_PROJECT} from '../src/account/direct-store.js';
import {rankTimeKey} from '../src/account/direct-ranking.js';
import {stable} from '../src/account/direct-authority.js';
export function planWeeklyAwards(snapshot){
 const s=snapshot,ms=Date.parse(s?.week+'T00:00:00.000Z'),day=ms/86400000;
 if(s?.project!==DEMO_PROJECT||s.complete!==true||s.writersStopped!==true||s.activeRuns!==0||s.pendingJournals!==0||!Array.isArray(s.rows)||!Array.isArray(s.banned)||!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==s.week||new Date(ms).getUTCDay()!==1||Date.parse(s.capturedAt)<ms+7*86400000-32400000)throw Error('Complete frozen closed-week snapshot required');
 if(!Number.isFinite(Date.parse(s.capturedAt)))throw Error('Invalid capture time');
 const seen=new Set(),bans=new Set(s.banned);if(s.banned.some(x=>!/^[-A-Za-z0-9_]{1,128}$/.test(x))||bans.size!==s.banned.length)throw Error('Invalid bans');
 for(const x of s.rows){if(!/^[-A-Za-z0-9_]{1,128}$/.test(x.uid)||seen.has(x.uid)||x.week!==s.week||!Number.isInteger(x.floor)||x.floor<0||x.floor>100000||typeof x.claimed!=='boolean')throw Error('Invalid week row');seen.add(x.uid);if(x.floor>0)rankTimeKey(x.at);}
 const hash=createHash('sha256').update(stable(s)).digest('hex');
 const ranked=s.rows.filter(x=>x.floor>0&&!bans.has(x.uid)).sort((a,b)=>b.floor-a.floor||rankTimeKey(a.at).localeCompare(rankTimeKey(b.at))||a.uid.localeCompare(b.uid));
 const grants=ranked.flatMap((x,i)=>{if(x.claimed)return [];const result={action:'spire_week_award',week:s.week,weekDay:day,floor:x.floor,rank:i+1,...weeklyReward(x.floor),title:weeklyTitle(i+1),sourceHash:hash};
  return [directDocument(DEMO_PROJECT,x.uid,'hd3d_growth_investments',x.uid+'~spaward~'+s.week,{id:x.uid+'~spaward~'+s.week,user_id:x.uid,body:JSON.stringify({week:s.week,sourceHash:hash}),at:s.capturedAt,result})];});
 return {version:1,productionReady:false,noExternalWrites:true,sourceHash:hash,week:s.week,ranked:ranked.map((x,i)=>({uid:x.uid,floor:x.floor,rank:i+1})),grants,
 requirements:['Trusted complete private-week export and bans; freeze late finishes before sealing','Re-read exact source and immutable existing grants before applying exists:false writes','Do not accept a player-provided ranking query as the source','Global admin finalization automation is not implemented']};
}
