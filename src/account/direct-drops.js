import * as E from './equip.js';
import {CHSET} from '../data/items.js';
import {gearOf,unpackGearItem} from './direct-gear.js';
// Validate before sealing an immutable entitlement. A bad later cursor must not
// strand a currency/progression commit that already happened.
export function validNormalDrop(it,ch,hero) {
  try {
    if(!it||typeof it.packed!=='boolean'||typeof it.hasE!=='boolean'||typeof it.unique!=='boolean'||!['weapon','armor','acc'].includes(it.s)||it.c!==ch||it.h!==(it.s==='weapon'?hero:'')||
      !Number.isInteger(it.g)||it.g<1||it.g>4||!/^[A-Za-z0-9_-]{1,16}$/.test(it.id)||it.e!==0||!it.hasE||it.unique||it.packed||it.raw!==''||it.body!=='')return false;
    const r=unpackGearItem(it),row=it.s==='weapon'?hero:it.s;
    const mains=it.s==='weapon'?['atk']:it.s==='armor'?['hp']:['crit','spd','skill','cdr'];
    return r.n===CHSET[ch]?.names[row]?.[it.g]&&mains.includes(r.m[0])&&it.mainKey===r.m[0]&&r.m[1]===E.MAIN[r.m[0]][it.g]&&
      E.validSubs(r,r.sub)&&(it.g===4&&E.LPOOL[row]?E.LPOOL[row]:['']).includes(r.u||'');
  }catch{return false;}
}
export function reservedItemIds(save){const g=gearOf(save);return new Set([...g.bagIds,...g.storedIds,...g.chestItemIds]);}
export function normalDropsValid(drops,ch,hero,save){const ids=reservedItemIds(save);return drops.every(it=>{if(!validNormalDrop(it,ch,hero)||ids.has(it.id))return false;ids.add(it.id);return true;});}
