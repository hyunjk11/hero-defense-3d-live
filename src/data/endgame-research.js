// Optional endgame purchases. The stored ranks are additional to legacy research.
import {resMods} from './growth.js';
import {hardOpen} from './hard.js';

export const ENDGAME_RESEARCH_VERSION = 1;
export const CASTLE_RESEARCH_VERSION = 1;
export const CASTLE_RESEARCH_MAX = 10;
export const ENDGAME_KINDS = Object.freeze(['gold','beam','castle']);
const MAX = Object.freeze({gold:Number.MAX_SAFE_INTEGER,beam:40,castle:CASTLE_RESEARCH_MAX});
const CAPS = Object.freeze({souls:1e9,steel:1e7,crystal:1e7});
const PRICE = Object.freeze({
  gold: {souls:[30000,10000],steel:[500,150],crystal:[150,50]},
  beam: {souls:[50000,25000],steel:[750,250],crystal:[250,100]},
  castle: {souls:[6000,2000],steel:[300,100],crystal:[60,20]}
});
const validRank = (n,kind) => ENDGAME_KINDS.includes(kind)&&Number.isSafeInteger(n)&&n>=0&&n<=MAX[kind];
export function cleanEndgameResearch(raw){
  const out={};
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    for(const kind of ENDGAME_KINDS)if(Object.hasOwn(raw,kind)&&validRank(raw[kind],kind)&&raw[kind]>0)out[kind]=raw[kind];
  }
  return out;
}
export function endgameLevel(save,kind){
  return ENDGAME_KINDS.includes(kind)?cleanEndgameResearch(save?.endgameResearch)[kind]||0:0;
}
const beamUnlocked=save=>Number.isSafeInteger(save?.research?.guardian?.atk)&&save.research.guardian.atk>=10;
const boundedPrice=(rank,base,step,cap)=>rank>=Math.ceil((cap-base)/step)?cap:base+rank*step;
export function endgameQuote(save,kind){
  const level=endgameLevel(save,kind);
  if(!ENDGAME_KINDS.includes(kind)||(kind==='beam'&&!beamUnlocked(save))||(kind==='castle'&&!hardOpen(save)))return {level,next:null,cost:null,reason:'locked'};
  if(level>=MAX[kind])return {level,next:null,cost:null,reason:'max'};
  const cost=Object.fromEntries(Object.entries(PRICE[kind]).map(([key,[base,step]])=>[key,boundedPrice(level,base,step,CAPS[key])]));
  const enough=(save?.souls||0)>=cost.souls&&(save?.mat?.steel||0)>=cost.steel&&(save?.mat?.crystal||0)>=cost.crystal;
  return {level,next:level+1,cost,reason:enough?null:'poor'};
}
export const startingGoldBonus=save=>endgameLevel(save,'gold');
export const beamAttackBonus=save=>beamUnlocked(save)?endgameLevel(save,'beam')/100:0;
export function endgameTowerMods(research,type,adv,beamAttack=0){
  const mods=resMods(research,type,adv);
  if(type==='guardian'&&beamAttack>0)mods.dmg+=beamAttack*(adv?.dmg??1);
  return mods;
}
