import {VISIBLE_HEROES} from './heroes.js';
import {DG_MAX} from './dungeon.js';
import {validTarget} from './repeat-target.js';

export const SORTIE_SETTINGS_VERSION=1;
export const validSortieChapter=n=>Number.isSafeInteger(n)&&n>=1&&n<=10;
export const validSortieParty=list=>Array.isArray(list)&&list.length>=1&&list.length<=DG_MAX&&
  new Set(list).size===list.length&&Array.from(list).every(h=>VISIBLE_HEROES.includes(h));

export function cleanSortieSettings(v){
  const out={};
  const targets={};
  for(let i=1;i<=10;i++){
    const value=v?.repeatTarget?.[i];
    if(value===null||typeof value==='string'&&validTarget(value))targets[i]=value;
  }
  if(Object.keys(targets).length)out.repeatTarget=targets;
  for(const mode of ['dungeon','spire'])if(validSortieParty(v?.[mode]))out[mode]=v[mode].slice();
  return out;
}
