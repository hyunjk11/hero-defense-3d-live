import * as Acc from './account.js';
import { heroOwned } from './shop.js';
import { VISIBLE_HEROES } from '../data/heroes.js';
import { validPartner } from '../data/hard-party.js';
import { ls } from '../core/store.js';

const owner = () => Acc.A.user?.id || (Acc.A.mode === 'guest' ? 'guest' : null);
const key = who => `hd3d_live_hard_partner_v1_${who}`;
export const partners = main => VISIBLE_HEROES.filter(h => validPartner(main, h) && heroOwned(h));
export function readPartner(main) {
  const who = owner(), options = partners(main), stored=who?ls.get(key(who)):null, base=Acc.load().battlePartner;
  let chosen=base;try{const v=JSON.parse(stored);if(v&&v.base===(base||null))chosen=v.partner;}catch{if(!base)chosen=stored;}
  return options.includes(chosen) ? chosen : options[0] || null;
}
export function writePartner(main, partner) {
  const who = owner(); if (!who || !partners(main).includes(partner)) return false;
  try { localStorage.setItem(key(who), JSON.stringify({partner,base:Acc.load().battlePartner||null})); return true; } catch { return false; }
}
