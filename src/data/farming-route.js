import { CHAPTERS,HARD_CHAPTERS,stageUnlocked,stars } from './stages.js';
import { dropPreview } from '../account/progress.js';
import { cleanTarget,targetLabel } from './repeat-target.js';
import { BOSS_SETS } from './boss-sets.js';
// Navigate only; never starts a run, grants an item, changes equipment or unlocks stages.
export function farmingRoute(save,ch,row,grade,{hard=false,repeat=false}={}){
 if(!cleanTarget(row)||!Number.isInteger(grade)||grade<0||grade>4)return null;
 const boss=BOSS_SETS[ch];
 if(boss)return grade===boss.grade?{dungeon:true,label:boss.source+' · 등급 내 장비는 무작위',locked:false}:null;
 if(!Number.isInteger(ch)||ch<1||ch>10||(ch>=3&&grade===0))return null;
 const stages=[...(CHAPTERS.find(c=>c.id===ch)?.stages||[]),...(hard?(HARD_CHAPTERS.find(c=>c.id===ch)?.stages||[]):[])];
 const candidates=stages.map(s=>({s,odds:dropPreview(s.id,save.hero,save)?.odds[grade]||0,open:stageUnlocked(save,s.id),cleared:stars(save,s.id)>0})).filter(r=>r.odds>0);
 candidates.sort((a,b)=>Number(b.open)-Number(a.open)||Number(b.cleared)-Number(a.cleared)||b.odds-a.odds||a.s.waves-b.s.waves);
 const c=candidates[0];if(!c)return null;
 const target=!!(repeat&&c.open&&c.cleared);
 return {id:c.s.id,locked:!c.open,target,label:`${c.s.hard?'하드 ':''}${c.s.no} · ${target?'반복 상자 1개: '+targetLabel(row)+' · ':''}등급 무작위`};
}
