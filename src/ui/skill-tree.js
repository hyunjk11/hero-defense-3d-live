import * as HG from '../account/hero-growth.js';
import * as Acc from '../account/account.js';
import * as AD from '../data/advance.js';
import { TREE_LEVELS, treeOptions, treeBuild, treeSummary } from '../data/skill-tree.js';
import { G } from '../core/state.js';
import { esc } from '../core/util.js';
let message='',stamp='';
export function selectedBuild(hero,s=Acc.load()){const a=AD.advOf(hero,s.adv?.[hero]);return treeBuild(HG.HG.growth?.trees,hero,a?.k,HG.level(hero));}
export const selectedSummary=hero=>treeSummary(selectedBuild(hero));
export function mountTree(hero,s){
  const host=document.getElementById('heroTree');if(!host)return;
  s ||= Acc.load();
  const key=HG.HG.owner+':'+Acc.sessionId()+':'+hero;if(stamp!==key){stamp=key;message='';}
  const b=selectedBuild(hero,s),a=AD.advOf(hero,s.adv?.[hero]),ready=HG.enabled()&&HG.HG.features.trees===1&&!HG.HG.buildBusy&&G.screen==='town';
  host.innerHTML=`<div class="treeHead"><b>${esc(a?.n||'전직 후 해금')}</b><div class="treePresets">${[0,1].map(i=>`<button class="ftab ${i===b.preset?'on':''}" data-preset="${i}" ${!ready||!a?'disabled':''}>프리셋 ${i+1}</button>`).join('')}</div></div>${TREE_LEVELS.map(l=>{
    const opts=treeOptions(hero,a?.k,l),locked=!a||b.level<l;
    return `<section class="treeTier"><b>Lv.${l} · ${l===15?'기본 공격':l===20?'Q':l===30?'E':l===40?'전투 운용':'최종 특성'}</b>${!opts.length?`<small>${a?'준비 중':'전직 필요'}</small>`:`<div class="treeChoices">${opts.map(o=>`<button class="treeChoice ${b.choices[l]===o.id?'on':''}" data-tier="${l}" data-choice="${o.id}" aria-pressed="${b.choices[l]===o.id}" ${!ready||locked?'disabled':''}><strong>${esc(o.n)}</strong><span>${esc(o.d)}</span></button>`).join('')}</div>${locked?`<small>${a?'영웅 Lv.'+l+' 필요':'전직 필요'}</small>`:''}`}</section>`;
  }).join('')}<p class="treeMessage" role="status">${esc(HG.HG.buildBusy?'저장 중…':message||(!HG.enabled()?HG.HG.message:HG.HG.features.trees!==1?'특성 서버 준비 중':''))}</p>`;
  const apply=async(preset,tier,choice)=>{if(G.screen!=='town'||HG.HG.buildBusy)return;const k=stamp;message='';const r=await HG.changeBuild(hero,a.k,preset,tier,choice,true);if(k!==stamp)return;message=r.ok?'저장됨':r.reason==='conflict'?'다른 기기의 변경을 불러왔습니다. 다시 선택해 주세요.':HG.HG.message||'저장하지 못했습니다.';mountTree(hero);};
  host.querySelectorAll('[data-preset]').forEach(x=>x.onclick=()=>apply(+x.dataset.preset,null,null));
  host.querySelectorAll('[data-tier]').forEach(x=>x.onclick=()=>apply(b.preset,+x.dataset.tier,x.dataset.choice));
}
