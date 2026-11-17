// Called inside the same authenticated economy transaction as its receipt.
import * as E from '../src/account/equip.js';
import { loadoutStamp, cleanLoadouts } from '../src/account/loadouts.js';
import { treeBuild, treeOptions, TREE_RELEASED, cleanTrees } from '../src/data/skill-tree.js';
import { levelOf } from '../src/data/hero-growth.js';
import { VISIBLE_HEROES } from '../src/data/heroes.js';
import { growthWallet } from './growth.mjs';
const branch=(s,h)=>typeof s.adv?.[h]==='string'?s.adv[h]:s.adv?.[h]?.b;
const owned=async(c,h)=>VISIBLE_HEROES.includes(h)&&(!['gunner','fighter'].includes(h)||!!await c.get('owned',c.uid+'~hero_'+h));
export async function applyLoadout(c,save,a){
 const fail=reason=>({save,result:{ok:false,reason}}),w=await growthWallet(c);
 if(a.expected!==loadoutStamp(save,w.rev))return fail('conflict');
 const s=structuredClone(save),slots=cleanLoadouts(s.battlePresets);while(slots.length<2)slots.push(null);
 if(a.action==='preset_save'){
  if(a.hero===a.partner||!await owned(c,a.hero)||!await owned(c,a.partner))return fail('hero');
  const eq={},builds={};for(const h of [a.hero,a.partner]){eq[h]=structuredClone(s.eq[h]||{});const b=branch(s,h);if(b)builds[h]={branch:b,choices:{...treeBuild(w.trees,h,b,levelOf(w.xp[h])).choices}};}
  slots[a.count]={hero:a.hero,partner:a.partner,eq,builds};s.battlePresets=slots;
  return {save:s,result:{ok:true,reason:'ok'}};
 }
 const p=slots[a.count];if(!p)return fail('empty');
 if(!await owned(c,p.hero)||!await owned(c,p.partner))return fail('hero');
 const party=[p.hero,p.partner],ids=new Set();
 for(const h of party){
  if((branch(s,h)||null)!==(p.builds[h]?.branch||null))return fail('advancement');
  for(const [sl,id] of Object.entries(p.eq[h])){
   const it=s.inv.find(it=>it.id===id);if(!it||it.s!==sl||!E.canEquip(it,h)||ids.has(id))return fail('missing');ids.add(id);
   if(Object.entries(s.eq).some(([other,eq])=>!party.includes(other)&&Object.values(eq).includes(id)))return fail('in_use');
  }
  for(const [tier,choice] of Object.entries(p.builds[h]?.choices||{}))if(levelOf(w.xp[h])<+tier||!TREE_RELEASED.includes(+tier)||!treeOptions(h,p.builds[h].branch,+tier).some(o=>o.id===choice))return fail('tree');
 }
 // Validate every slot before modifying any gear, tree, or partner.
 const trees=cleanTrees(w.trees);
 for(const h of party){s.eq[h]={...p.eq[h]};const b=p.builds[h];if(b){const row=(trees[h]||={})[b.branch]||={active:0,presets:[{},{}]};row.presets[row.active]={...b.choices};}}
 s.hero=p.hero;s.battlePartner=p.partner;
 w.trees=trees;w.rev++;await c.put('growth_wallet',w);
 return {save:s,result:{ok:true,reason:'ok',partner:p.partner}};
}
