import {hardGearOdds} from '../src/data/items.js';
import {waveBoss} from '../src/core/roster.js';
import {CHAPTERS,STAGES} from '../src/data/stages.js';
import {HARD_STAGES} from '../src/data/hard.js';
import {DEMO_PROJECT,encodeFields} from '../src/account/direct-store.js';
export function stageCatalog(){return [...Object.values(STAGES),...Object.values(HARD_STAGES)].map(s=>({
 name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/${s.id}`,
 fields:encodeFields({id:s.id,hardGrades:s.hard?hardGearOdds(s.ch).flatMap((v,g)=>v>0?[g]:[]):[],killBase:Array.from({length:s.waves+1},(_,w)=>Array.from({length:w},(_,i)=>4*(8+(i+1)*3+8+1)).reduce((a,b)=>a+b,0)),renewable:s.ch>=4,boss:!!s.boss,bossMax:Array.from({length:s.waves+1},(_,w)=>Array.from({length:w},(_,i)=>i+1).filter(n=>waveBoss(s,n)).length),reward:40+s.idx*15+(s.ch-1)*60+(s.boss?60:0),minGrade:s.ch>=3?1:0,waves:s.waves,hard:!!s.hard,ch:s.ch,idx:s.idx,prev:s.hard?(Object.keys(HARD_STAGES)[Object.keys(HARD_STAGES).indexOf(s.id)-1]||''):(CHAPTERS.find(c=>c.id===s.ch).stages[s.idx-1]?.id||''),chapterPrev:s.ch>1?CHAPTERS.find(c=>c.id===s.ch-1).stages.at(-1).id:'',unit:s.hard?30+4*(s.ch-1):10+2*(s.ch-1),clear:Math.floor(s.waves*(s.hard?30+4*(s.ch-1):10+2*(s.ch-1))/3)})
}));}

import {empty} from '../src/account/progress.js';
import {initialGrowth} from '../src/data/hero-growth.js';
import {authorityOf} from '../src/account/direct-authority.js';
export function bootstrapTemplate(){const save=empty();return {name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/_bootstrap`,fields:encodeFields({authority:authorityOf(save),saveJson:JSON.stringify(save),wallet:initialGrowth(save)})};}

import {treeOptions,TREE_RELEASED} from '../src/data/skill-tree.js';
export function treeCatalog(){const branches={archer:['wind','hawk'],mage:['flame','frost'],warrior:['paladin','berserk'],gunner:['duel','thorn'],fighter:['tiger','dragon']};return Object.entries(branches).flatMap(([hero,bs])=>bs.map(branch=>({name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/tree-${hero}-${branch}`,fields:encodeFields({hero,branch,options:Object.fromEntries(TREE_RELEASED.map(level=>[level,treeOptions(hero,branch,level).map(o=>o.id)]))})})));}

import {CH_KEYS,CODEX_RW} from '../src/data/items.js';
import {gradeMask} from '../src/account/equip.js';
import {codexRows} from '../src/account/progress.js';
export function codexCatalog(){return CH_KEYS.map(ch=>{const mask=gradeMask(ch);return {name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/codex-${ch}`,fields:encodeFields({ch,mask,complete:Array.from({length:32},(_,i)=>i).filter(i=>(i&mask)===mask),rows:codexRows(),rewards:CODEX_RW})};});}

import {CHSET,chOdds} from '../src/data/items.js';
import {RES,resCost} from '../src/data/growth.js';
import {ADV_COST,ADV_SWITCH,branchesOf,ADV_HEROES} from '../src/data/advance.js';
export function townCatalog(){return {name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/town`,fields:encodeFields({
  research:Object.fromEntries(Object.entries(RES).map(([k,r])=>[k,{max:r.max,mat:r.mat,need:r.need||0,costs:Array.from({length:r.max},(_,i)=>resCost(k,i))}])),
  advance:{first:ADV_COST,switch:ADV_SWITCH,branches:Object.fromEntries(ADV_HEROES.map(h=>[h,branchesOf(h)]))}
})};}
import {MAIN,GEAR_NAMES,LPOOL,RECIPES,craftCost,SUBN,STAT,subRange} from '../src/account/equip.js';
export function itemCatalog(){return [0,...CH_KEYS].flatMap(ch=>['mage','archer','warrior','gunner','fighter','armor','acc'].map(row=>({
 name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/item-${ch}-${row}`,
 fields:encodeFields({ch,row,grades:Array.from({length:5},(_,g)=>({names:ch?[CHSET[ch].names[row][g]]:GEAR_NAMES[row][g],
   mains:Object.fromEntries((row==='armor'?['hp']:row==='acc'?['crit','spd','skill','cdr']:['atk']).map(k=>[k,MAIN[k][g]])),
   subCount:SUBN[g],subBounds:Object.fromEntries(Object.keys(STAT).map(k=>[k,subRange(g,k)])),u:g===4&&LPOOL[row]?LPOOL[row]:['']})),
   recipes:Object.fromEntries(RECIPES.map(r=>[r.k,{cost:craftCost(r,ch),grades:(ch?chOdds(r.odds,ch):r.odds).flatMap((v,g)=>v>0?[g]:[])}]))})
})));}

import {dungeonItems} from '../server/dungeon.mjs';
export function dungeonShopCatalog(){return {name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/dungeon-shop`,fields:encodeFields(dungeonItems)};}

import {BOSS_SETS} from '../src/data/boss-sets.js';
export function mailItemCatalog(){return ['mage','archer','warrior','gunner','fighter','armor','acc'].map(row=>({name:`projects/${DEMO_PROJECT}/databases/(default)/documents/hd3d_live_catalog/item-morvia-${row}`,fields:encodeFields({grades:Array.from({length:5},(_,g)=>({set:'morvia',names:g===3?[BOSS_SETS.morvia.names[row][g]]:[],mains:Object.fromEntries((row==='armor'?['hp']:row==='acc'?['crit','spd','skill','cdr']:['atk']).map(k=>[k,MAIN[k][g]])),subCount:SUBN[g],subBounds:Object.fromEntries(Object.keys(STAT).map(k=>[k,subRange(g,k)])),u:['']}))})}));}
