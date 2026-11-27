// Awakening is a second progression track; it never changes base XP or level.
import {advOf} from './advance.js';
export const AWAKENING_VERSION=1, AWAKENING_MAX=50, AWAKENING_SKILL_VERSION=1;
const branches=Object.freeze({warrior:'paladin',mage:'frost',fighter:'dragon',gunner:'thorn'});
const skillNames=Object.freeze({paladin:'쌍성 방벽',frost:'빙결 수렴',dragon:'묘왕파',thorn:'장미 심판'});
export const awakeningSkillName=(hero,branch=branches[hero]) =>
  Object.hasOwn(branches,hero)&&branches[hero]===branch ? skillNames[branch] : null;
const own=(o,k)=>!!o&&Object.hasOwn(o,k);
export const awakeningSupported=(hero,adv)=>{
  const branch=typeof adv==='string'?adv:adv?.b??adv?.k;
  return own(branches,hero)&&branches[hero]===branch&&!!advOf(hero,branch);
};
export const validAwakeningLevel=n=>Number.isSafeInteger(n)&&n>=0&&n<=AWAKENING_MAX;
export function cleanAwakening(v){
  const out={};
  for(const hero of Object.keys(branches)){if(own(v,hero)&&validAwakeningLevel(v[hero]))out[hero]=v[hero];}
  return out;
}
export function cleanAwakeningSkills(v){
  const out={};
  for(const hero of Object.keys(branches))if(own(v,hero)&&typeof v[hero]==='boolean')out[hero]=v[hero];
  return out;
}
export const awakeningSkillOn=(g,hero)=>!(own(g?.awakeningSkill,hero)&&g.awakeningSkill[hero]===false);
export function awakeningMods(level){
  const n=validAwakeningLevel(level)?level:0;
  return {dmg:1+.006*n,hp:1+.004*n};
}
export function awakeningLevel(g,hero,adv){
  const n=g?.awakening?.[hero];
  return awakeningSupported(hero,adv)&&validAwakeningLevel(n)?n:null;
}
function step(n){
  return {xp:600+60*(n-1)+(n===AWAKENING_MAX?380:0),
    souls:400+20*n,steel:n%5===0?10+n:0,crystal:n%10===0?4+n/10:0};
}
export function awakeningQuote(g,save,hero,target){
  const n=g?.awakening?.[hero],before=validAwakeningLevel(n)?n:null;
  const quote={ok:false,reason:'invalid',before,target,xp:0,souls:0,steel:0,crystal:0};
  if(!g||!save||!own(branches,hero)||!validAwakeningLevel(target))return quote;
  if(!awakeningSupported(hero,save.adv?.[hero]))return {...quote,reason:'unsupported'};
  // Base Lv50 is always 49 steps on the pre-existing base growth curve.
  if(!(g.xp?.[hero]>=49*100+20*49*48))return {...quote,reason:'base_level'};
  const perm=save.heroLv?.[hero];
  if(!(perm?.atk>=15&&perm?.hp>=15))return {...quote,reason:'permanent'};
  if(before===null&&target!==0)return {...quote,reason:'locked'};
  if(before!==null&&target<=before)return {...quote,reason:'level'};
  for(let i=(before??0)+1;i<=target;i++){
    const cost=step(i);for(const k of Object.keys(cost))quote[k]+=cost[k];
  }
  quote.ok=(g.balance||0)>=quote.xp&&(save.souls||0)>=quote.souls&&(save.mat?.steel||0)>=quote.steel&&(save.mat?.crystal||0)>=quote.crystal;
  quote.reason=quote.ok?null:'poor';
  return quote;
}
