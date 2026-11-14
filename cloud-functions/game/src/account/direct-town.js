// Deterministic town purchases. The browser proposes a transition; Rules check
// exact costs, caps, ownership, prerequisites and server-day limits independently.
import * as GR from '../data/growth.js';
import * as SX from './steel.js';
import * as AD from '../data/advance.js';
export const TOWN_ACTIONS = ['research','bar','exchange','advance'];
export function townArgs(a) {
  const fail=()=>{throw Object.assign(new Error('INVALID_ARGUMENT'),{code:'INVALID_ARGUMENT'});};
  if(a.p_action==='research'&&(!GR.TTYPES.includes(a.p_type)||!GR.RKEYS.includes(a.p_stat)))fail();
  if(a.p_action==='exchange'&&(!Number.isInteger(a.p_count)||a.p_count<1||a.p_count>SX.XCH.daily))fail();
  if(a.p_action==='advance'&&(!AD.ADV_HEROES.includes(a.p_hero)||!AD.branchesOf(a.p_hero).includes(a.p_branch)))fail();
  return a.p_action==='research'?{type:a.p_type,stat:a.p_stat}:a.p_action==='exchange'?{count:a.p_count}:a.p_action==='advance'?{branch:a.p_branch}:{};
}
export function applyTown(save,args,{now=Date.now(),growth}={}) {
  const s=structuredClone(save),a=args.action;
  if(a==='research') {
    const view={...s,research:GR.cleanResearch(s.research)},reason=GR.resBlock(view,args.type,args.stat);
    if(reason)return {save:s,result:{ok:false,reason}};
    const level=view.research[args.type][args.stat],cost=GR.resCost(args.stat,level);
    s.souls-=cost.souls;s.mat[GR.RES[args.stat].mat]-=cost[GR.RES[args.stat].mat];
    s.research={...s.research,[args.type]:{...s.research?.[args.type],[args.stat]:level+1}};
    return {save:s,result:{ok:true,reason:'ok'}};
  }
  if(a==='bar'){const [,ok]=SX.buyBar(s);return {save:s,result:{ok,reason:ok?'ok':'locked'}};}
  if(a==='exchange'){const [,reason,got]=SX.exchange(s,args.count,now);return {save:s,result:{ok:reason==='ok',reason,...(got?{got}:{})}};}
  if(a==='advance') {
    const reason=AD.advBlock({...s,growth},args.hero,args.branch,true);
    if(reason)return {save:s,result:{ok:false,reason}};
    const cur=AD.advOf(args.hero,s.adv?.[args.hero]),cost=cur?AD.ADV_SWITCH:AD.ADV_COST;
    s.souls-=cost.souls;
    if(!cur){s.mat.crystal-=cost.crystal;s.mat.essence-=cost.essence;if(!s.mat.essence)delete s.mat.essence;}
    s.adv={...s.adv,[args.hero]:{b:args.branch,n:cur?(s.adv[args.hero]?.n||1)+1:1}};
    return {save:s,result:{ok:true,reason:'ok'}};
  }
  throw Object.assign(new Error('DIRECT_UNSUPPORTED'),{code:'DIRECT_UNSUPPORTED'});
}
