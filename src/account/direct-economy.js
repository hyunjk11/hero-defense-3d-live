import { applyLoadout } from '../../server/loadouts.mjs';
import {context,denied} from '../../server/common.mjs';
import * as E from './equip.js';
import * as S from './storage.js';
import {codexState,reward} from './progress.js';
import {STAGES} from '../data/stages.js';
import {CHSET,CODEX_RW} from '../data/items.js';
import {unpackItem} from './storpack.js';
import {TOWN_ACTIONS,townArgs,applyTown} from './direct-town.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const actions=new Set(['lock','preset_save','preset_apply','open','dismantle','store','take','expand','equip','unequip','enhance','codex','run_return','craft','reroll','reroll_apply',...TOWN_ACTIONS]);
export function gearArgs(args) {
  if(!args||typeof args!=='object'||Object.keys(args).some(k=>!['p_id','p_action','p_item','p_hero','p_slot','p_pay','p_wave','p_kills','p_ch','p_recipe','p_source','p_type','p_stat','p_count','p_branch','p_locked','p_partner','p_expected'].includes(k))||
    !/^[A-Za-z0-9_-]{8,64}$/.test(args.p_id||'')||!actions.has(args.p_action))fail('INVALID_ARGUMENT');
  if(args.p_action!=='run_return'&&('p_wave' in args||'p_kills' in args))fail('INVALID_ARGUMENT');
  if(args.p_action==='run_return'&&(!Number.isInteger(args.p_wave)||args.p_wave<0||args.p_wave>=5||!Number.isInteger(args.p_kills)||args.p_kills<0||args.p_kills>1000000||args.p_id!=='run-'+args.p_item))fail('INVALID_ARGUMENT');
  if(args.p_action==='craft'&&(!Number.isInteger(args.p_ch??0)||(args.p_ch??0)<0||(args.p_ch??0)>10||!E.RECIPES.some(r=>r.k===args.p_recipe)||!E.SLOT_KEYS.includes(args.p_slot)))fail('INVALID_ARGUMENT');
  if(args.p_action==='reroll_apply'&&(!/^[A-Za-z0-9_-]{8,64}$/.test(args.p_source||'')||args.p_id!=='apply-'+args.p_source))fail('INVALID_ARGUMENT');
  if(args.p_action==='lock'&&typeof args.p_locked!=='boolean')fail('INVALID_ARGUMENT');
  if(args.p_action.startsWith('preset_')&&(![0,1].includes(args.p_count)||typeof args.p_expected!=='string'||args.p_expected.length>10000))fail('INVALID_ARGUMENT');
  return {...(args.p_action==='lock'?{locked:args.p_locked}:{}),...(args.p_action.startsWith('preset_')?{count:args.p_count,partner:args.p_partner||'',expected:args.p_expected}:{}),action:args.p_action,item:args.p_item||'',hero:args.p_hero||'',slot:args.p_slot||'',pay:args.p_pay||'',...(args.p_action==='run_return'?{wave:args.p_wave,kills:args.p_kills}:{}),...(args.p_action==='craft'?{ch:args.p_ch||0,recipe:args.p_recipe}:{}),...(args.p_action==='reroll_apply'?{source:args.p_source}:{}),...(TOWN_ACTIONS.includes(args.p_action)?townArgs(args):{})};
}
export function applyGear(save,args,random=Math.random) {
  const s=structuredClone(save),a=args.action,id=args.item;
  if(a==='lock'){const ok=E.lockItem(s,id,args.locked);return {save:s,result:{ok,reason:ok?'ok':'none'}};}
  if(a==='run_return'){
    const got=reward(args.wave,args.kills);s.souls+=got;
    s.stats={...s.stats,runs:(s.stats?.runs||0)+1,kills:(s.stats?.kills||0)+args.kills,waves:(s.stats?.waves||0)+args.wave,souls:(s.stats?.souls||0)+got};
    return {save:s,result:{ok:true,reason:'ok',souls:got,loot:[]}};
  }
  if(a==='craft'){const [save,r,it]=E.craft(s,args.recipe,args.slot,args.hero,random,args.ch);return {save,result:{ok:r==='ok',reason:r,...(it?{it}:{})}};}
  if(a==='reroll'){const [save,r,sub]=E.reroll(s,id,random);return {save,result:{ok:r==='ok',reason:r,item:id,...(sub?{sub}:{})}};}
  if(a==='reroll_apply'){const [save,ok]=E.applySubs(s,id,args.sub);return {save,result:{ok,reason:ok?'ok':'none'}};}
  if(a==='codex'){const [ch,row]=id.split(':');const state=CHSET[ch]?codexState(s,+ch):null;const done=state&&(row==='all'?state.all:state.rows.find(x=>x.row===row));
    if(!done?.done||s.codexRw.includes(id))return {save:s,result:{ok:false,reason:'locked'}};
    const rw=CODEX_RW[row==='all'?'all':'row'];s.mat.crystal+=rw.crystal||0;if(rw.essence)s.mat.essence=(s.mat.essence||0)+rw.essence;s.souls+=rw.souls||0;s.codexRw.push(id);
    return {save:s,result:{ok:true,reason:'ok',reward:rw}};
  }
  if(a==='open') {if(!s.chests.some(x=>x.id===id))return {save:s,result:{ok:false,reason:'none'}};
    const [next,r]=E.openChests(s,1,[id]);return {save:next,result:{ok:r.opened.length===1,reason:r.full?'full':r.opened.length?'ok':'none',...r}};}
  if(a==='enhance'){
    // Ordinary v34 enhancement already trusts the browser draw. Keep its odds,
    // costs and failure result; Rules verify the bounded transition, not fairness.
    const it=s.inv.find(x=>x.id===id);
    if(it&&!Object.hasOwn(it,'e'))it.e=0;
    const [next,r]=E.enhance(s,id,random);return {save:next,result:{ok:r==='ok'||r==='fail',reason:r}};
  }
  if(a==='dismantle'){const it=s.inv.find(x=>x.id===id);if(it&&!Object.hasOwn(it,'e'))it.e=0;
    const [next,y,n]=E.dismantle(s,[id]);return {save:next,result:{ok:n===1,reason:n?'ok':'none',yield:y}};}
  if(a==='store'){const [next,r]=S.store(s,[id]);return {save:next,result:{ok:r.moved===1,reason:r.moved?'ok':r.full?'full':r.eq?'equipped':'none'}};}
  if(a==='take') {const index=s.stor.findIndex(x=>(typeof x==='string'?unpackItem(x):x)?.id===id);
    if(index<0)return {save:s,result:{ok:false,reason:'none'}};
    if(typeof s.stor[index]==='string')s.stor[index]=unpackItem(s.stor[index]);
    const [next,r]=S.take(s,[id]);return {save:next,result:{ok:r.moved===1,reason:r.moved?'ok':r.full?'full':'none'}};}
  if(a==='expand'){const [next,r]=S.expand(s,args.pay);return {save:next,result:{ok:r==='ok',reason:r}};}
  if(a==='equip'){const [next,ok]=E.equip(s,args.hero,id);return {save:next,result:{ok,reason:ok?'ok':'none'}};}
  if(a==='unequip'){const ok=!!s.eq?.[args.hero]?.[args.slot];return {save:E.unequip(s,args.hero,args.slot),result:{ok,reason:ok?'ok':'none'}};}
  fail('DIRECT_UNSUPPORTED');
}
export async function directGear(store,user,args,options) {
  const input=gearArgs(args),body=JSON.stringify(input);
  return store.transaction(async tx=>{
    const c=await context(tx,user,options);c.requirePlayer();
    const receiptId=c.uid+'~gear~'+args.p_id,prior=await c.get('growth_investments',receiptId);
    if(prior){if(prior.body!==body)denied('request ID reused');return {data:{...prior.result,already:true},error:null};}
    if(input.action==='run_return'){
      const run=await c.get('growth_runs',c.uid+'~'+input.item),stage=run&&STAGES[run.stage];
      if(await c.get('growth_investments',c.uid+'~normal~'+input.item))denied('run already settled');
      if(input.wave===0&&input.kills!==0)denied('zero-wave kills');
      if(!stage||!run.done||run.won||input.wave>stage.waves||input.wave>run.completed+1)denied('normal return does not match a finished run');
    }
    if(['equip','unequip','craft','advance'].includes(input.action)&&(!['mage','archer','warrior','gunner','fighter'].includes(input.hero)||
      (['gunner','fighter'].includes(input.hero)&&!await c.get('owned',c.uid+'~hero_'+input.hero))))denied('hero not owned');
    const p=await c.get('progress',c.uid);if(!p)denied('missing save');
    if(input.action==='craft'&&input.ch&&!(p.data.st?.[input.ch+'-6']>0))denied('chapter crafting locked');
    let evaluated=input;
    if(input.action==='reroll_apply'){const source=await c.get('growth_investments',c.uid+'~gear~'+input.source);if(source?.result?.action!=='reroll'||source.result.item!==input.item||!source.result.ok)denied('paid reroll missing');evaluated={...input,sub:source.result.sub};}
    const {save,result}=input.action.startsWith('preset_')?await applyLoadout(c,p.data,input):TOWN_ACTIONS.includes(input.action)?applyTown(p.data,evaluated,{now:c.now,growth:input.action==='advance'?await c.get('growth_wallet',c.uid):undefined}):applyGear(p.data,evaluated,c.random);
    if(!result.ok)return {data:result,error:null};
    const updated_at=new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString();
    await c.put('progress',{...p,data:save,updated_at});
    const out={...result,id:args.p_id,action:input.action};
    await c.put('growth_investments',{id:receiptId,user_id:c.uid,body,at:c.iso,result:out});
    return {data:out,error:null};
  });
}
