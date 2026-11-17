// Bounded saved preferences. No item copies, balances or progression are stored.
import { VISIBLE_HEROES } from '../data/heroes.js';
import { cleanTrees } from '../data/skill-tree.js';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const stable=x=>JSON.stringify(canonical(x));
export function cleanLoadouts(value) {
 if(!Array.isArray(value))return [];
 return [0,1].map(i=>{const p=value[i];if(!p||!VISIBLE_HEROES.includes(p.hero)||!VISIBLE_HEROES.includes(p.partner)||p.hero===p.partner)return null;
 const eq={},builds={};for(const h of [p.hero,p.partner]){eq[h]={};for(const sl of ['weapon','armor','acc'])if(typeof p.eq?.[h]?.[sl]==='string'&&p.eq[h][sl].length<=100)eq[h][sl]=p.eq[h][sl];
 const b=p.builds?.[h];if(b&&typeof b.branch==='string'){const t=cleanTrees({[h]:{[b.branch]:{active:0,presets:[b.choices,{}]}}})[h]?.[b.branch];if(t)builds[h]={branch:b.branch,choices:t.presets[0]};}}
 return {hero:p.hero,partner:p.partner,eq,builds};});
}
export const loadoutStamp=(s,rev)=>stable({hero:s.hero,partner:s.battlePartner||null,eq:s.eq,adv:s.adv,presets:cleanLoadouts(s.battlePresets),rev:rev||0});
