import { grantEShield } from '../data/hero-e.js';
import { awakeningSkillName, validAwakeningLevel } from '../data/awakening.js';
export const AWAKENING_SHARE_RADIUS=7, AWAKENING_CAT_LIMIT=8;
export function awakeningESpec(hero,skill) {
 if(!skill||!validAwakeningLevel(hero?.awakeningLevel)||hero.awakeningUseE===false)return skill;
 const n=awakeningSkillName(skill.h,skill.b);
 if(!n)return skill;
 return {...skill,n,awakening:true,...(skill.b==='dragon'?{width:1.65}:skill.b==='thorn'?{priorityDamage:1.35}:{})};
}
export function nearestAwakeningAlly(caster,team,radius=AWAKENING_SHARE_RADIUS) {
 let chosen=null,best=Infinity;const p=caster.g.position;
 for(const ally of team){
  if(ally===caster||!ally?.ch||!ally.g?.parent||!(ally.hp>0)||ally.dead>0)continue;
  const a=ally.g.position,d=(a.x-p.x)**2+(a.z-p.z)**2;
  if(Number.isFinite(d)&&d<=radius*radius&&d<best){best=d;chosen=ally;}
 }
 return chosen;
}
export function shareAwakeningShield(caster,team,skill,now) {
 const ally=nearestAwakeningAlly(caster,team);
 if(!ally)return null;
 const existing=ally.eShield;
 if(existing?.until>now&&existing.value>0)return null;
 return {ally,shield:grantEShield(ally,skill,now)};
}
export function awakeningCatHits(enemies,origin,dir,from,to,width,seen,limit) {
 if(limit<=0)return [];
 const candidates=[];
 for(const e of enemies){
  if(e.dead||e.dying!==undefined||seen.has(e)||e.state==='spawn')continue;
  const dx=e.g.position.x-origin.x,dz=e.g.position.z-origin.z;
  const along=dx*dir.x+dz*dir.z,across=dx*dir.z-dz*dir.x;
  if(along>=from&&along<=to&&Math.abs(across)<=width)candidates.push({e,along});
 }
 return candidates.sort((a,b)=>a.along-b.along).slice(0,limit).map(x=>x.e);
}
