// Direct-mode inventory representation. Immutable JSON preserves every legacy
// item field; fields used by Rules are extracted only by the trusted migration.
// Clients may move existing entries or change a validated enhancement level.
import {unpackItem} from './storpack.js';
export const GEAR_KEYS=['inv','stor','chests','eq','codex','codexRw','storX','stats'];
const clone=x=>structuredClone(x);
export function packGearItem(raw) {
  const packed=typeof raw==='string',it=packed?unpackItem(raw):raw;
  if(!it||typeof it!=='object'||Array.isArray(it))return {opaque:JSON.stringify(raw)};
  const body={...it};delete body.e;
  return {body:JSON.stringify(body),id:it.id??null,g:it.g??null,s:it.s??null,c:it.c??0,h:it.h??'',
    e:it.e??0,hasE:Object.hasOwn(it,'e'),unique:!!it.uq,mainKey:it.m?.[0]||'',packed,raw:packed?raw:''};
}
export const packSubs=sub=>sub.map(([k,v])=>({k,v}));
export const unpackSubs=sub=>sub.map(({k,v})=>[k,v]);
// New grants have no executable/unverifiable JSON body. Rules inspect every
// gameplay field against the immutable local-catalog migration.
export function packTypedItem(it){return {id:it.id,g:it.g,s:it.s,c:it.c||0,h:it.h||'',e:it.e||0,hasE:true,
 unique:false,packed:false,raw:'',body:'',...(it.set?{set:it.set}:{}),mainKey:it.m[0],spec:{n:it.n,m:it.m,sub:packSubs(it.sub),u:it.u||''}};}
export function unpackGearItem(x) {
  if('opaque' in x)return JSON.parse(x.opaque);
  const it=x.spec?{id:x.id,s:x.s,g:x.g,n:x.spec.n,m:x.spec.m,sub:unpackSubs(x.spec.sub),...(x.h?{h:x.h}:{}),...(x.c?{c:x.c}:{}),...(x.set?{set:x.set}:{}),...(x.spec.u?{u:x.spec.u}:{})}:JSON.parse(x.body);
  if(x.rolledSub)it.sub=unpackSubs(x.rolledSub);
  if(x.hasE)it.e=x.e;
  // Preserve byte-identical legacy packed storage until an explicit move.
  return x.packed?x.raw:it;
}
// Preserve each existing representation across moves, enhancement and reroll.
// The migration's legacy body/unknown fields are never rewritten by a client.
export function preserveGear(after,before){
 const entries=[...before.inv,...before.stor,...before.chests.map(c=>c.it)],map=new Map(entries.map(it=>[it.id,it]));
 const encode=x=>{
  const decode=y=>{const v=unpackGearItem(y);return typeof v==='string'?unpackItem(v):v;};
  const it=decode(x),old=map.get(x.id);if(!old)return packTypedItem(it);
  const value=decode(old),a={...it},b={...value};delete a.e;delete b.e;delete a.sub;delete b.sub;
  if(JSON.stringify(a)!==JSON.stringify(b))return x; // Rules reject unrequested changes.
  const next={...old,e:x.e,hasE:x.hasE,packed:x.packed,raw:x.raw};
  if(JSON.stringify(it.sub)!==JSON.stringify(value.sub)){
   if(old.spec)next.spec={...old.spec,sub:packSubs(it.sub)};else next.rolledSub=packSubs(it.sub);
  }return next;
 };
 return {...after,inv:after.inv.map(encode),stor:after.stor.map(encode),chests:after.chests.map(c=>{const old=before.chests.find(x=>x.id===c.id);return {...(old?{...old}:{body:'',src:JSON.parse(c.body).src,id:c.id,souls:c.souls}),it:encode(c.it)};})};
}
export function gearOf(save) {
  const g={present:GEAR_KEYS.filter(k=>Object.hasOwn(save,k))};
  g.inv=(save.inv||[]).map(packGearItem);g.stor=(save.stor||[]).map(packGearItem);
  g.bagIds=g.inv.map(x=>x.id??'');g.storedIds=g.stor.map(x=>x.id??'');
  g.chestItemIds=(save.chests||[]).map(c=>c.it?.id??'');
  g.chests=(save.chests||[]).map(c=>{const body={...c};delete body.it;return {body:JSON.stringify(body),id:c.id,it:packGearItem(c.it),souls:c.souls};});
  for(const [k,v] of Object.entries({eq:{},codex:{},codexRw:[],storX:0,stats:{}}))g[k]=clone(save[k]??v);
  return g;
}
export function gearSave(g) {
  const s={inv:g.inv.map(unpackGearItem),stor:g.stor.map(unpackGearItem),
    chests:g.chests.map(c=>({...(c.body?JSON.parse(c.body):{id:c.id,src:c.src,souls:c.souls}),it:unpackGearItem(c.it)})),
    eq:clone(g.eq),codex:clone(g.codex),codexRw:clone(g.codexRw),storX:g.storX,stats:clone(g.stats)};
  return Object.fromEntries(g.present.map(k=>[k,s[k]]));
}
