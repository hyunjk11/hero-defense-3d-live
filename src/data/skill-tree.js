// Stable per-hero/per-advancement presets. Only released tiers can be selected.
export const TREE_VERSION = 1, TREE_LEVELS = [15, 20, 30, 40, 50], TREE_RELEASED = [15, 20, 30, 40, 50];
const branches = { archer:['wind','hawk'], mage:['flame','frost'], warrior:['paladin','berserk'], gunner:['duel','thorn'], fighter:['tiger','dragon'] };
const opt = (id,n,d,mods) => ({id,n,d,...mods});
const basic = {
  archer:[opt('focus','한 점 조준','기본 피해 +18% · 기본 공속 −8%',{basic:1.18,rate:.92}),opt('pierce','관통 깃','기본 피해 −8% · 뒤 1명에 45% 관통',{basic:.92,pierce:.45})],
  mage:[opt('wide','퍼지는 마력','기본 폭발 반경 +15% · 기본 피해 −8%',{basic:.92,aoe:1.15}),opt('dense','응축 마력','기본 피해 +18% · 폭발 반경 −20%',{basic:1.18,aoe:.8})],
  warrior:[opt('guard','수호 검술','기본 범위 +12% · 받는 피해 −6% · 기본 피해 −8%',{basic:.92,basicRange:1.12,taken:.94}),opt('breaker','거인 사냥','기본 공격: 정예·보스 +18% · 나머지 −6%',{boss:1.18,normal:.94})],
  gunner:[opt('stack','집중 탄창','같은 대상 기본 피해: 매 사격 +4%, 최대 +16% · 첫 사격 −4%',{stack:true}),opt('switch','새 표적','새 대상 첫 사격 +18% · 연속 사격 −4%',{switch:true})],
  fighter:[opt('close','연타 호흡','근접 기본 피해 +15% · 장풍 −8%',{melee:1.15,ranged:.92}),opt('far','장풍 호흡','장풍 기본 피해 +15% · 근접 −8%',{melee:.92,ranged:1.15})],
};
const cadence = [opt('quick','빠른 순환','Q 피해 −8% · Q 쿨타임 −12%',{qMul:.92,qCd:.88}),opt('heavy','결정타','Q 피해 +20% · Q 쿨타임 +12%',{qMul:1.2,qCd:1.12})];
const area = [opt('wide','넓은 압박','Q 반경·폭 +15% · Q 피해 −10%',{qRadius:1.15,qMul:.9}),opt('dense','집중 타격','Q 피해 +20% · Q 반경·폭 −10%',{qRadius:.9,qMul:1.2})];
const q = {
  wind:area, hawk:cadence, flame:area,
  frost:[opt('control','깊은 빙결','빙하 Q 제어시간 +20% · 피해 −10%',{qCC:1.2,qMul:.9}),opt('impact','빙하 파괴','빙하 Q 피해 +20% · 제어시간 −20%',{qCC:.8,qMul:1.2})],
  paladin:area,
  berserk:[opt('long','지속 회전','Q 지속 +20% · 틱 피해 −10%',{qDuration:1.2,qMul:.9}),opt('heavy','짧은 격노','Q 틱 피해 +20% · 지속 −10%',{qDuration:.9,qMul:1.2})],
  duel:cadence,thorn:cadence,tiger:area,dragon:area,
};
const operation=[opt('assault','공세 운용','Q·E 피해 +8%, 쿨 -6% · 받는 피해 +8%',{qMul:1.08,eMul:1.08,qCd:.94,eCd:.94,taken:1.08}),opt('stable','안정 운용','이속 +12%, 받는 피해 -6% · 기본 피해 -4%',{move:1.12,taken:.94,basic:.96})];
const final = {
 archer:[opt('finish','정밀 마무리','HP 35% 이하 적 기본 피해 +25% · 그 외 -4%',{execute:true}),opt('line','관통 진형','뒤 2명 35% 관통(기존 관통 45% 유지) · 기본 피해 -8%',{line:true,basic:.92})],
 mage:[opt('weave','원소 연계','E 후 6초 내 다음 Q 피해 +25% · 기본 피해 -8%',{weave:true,basic:.92}),opt('siege','장거리 포격','기본 피해: 7m 밖 +20%, 4m 안 -10% · E 반경·쿨 +10%',{siege:true,eRadius:1.1,eCd:1.1})],
 warrior:[opt('lastguard','최후의 수호','HP 40% 미만 받는 피해 -20%(특성 합계 최대25%) · 기본 피해 -4%',{lastguard:true,basic:.96}),opt('pressure','정예 압박','기본 피해: 정예·보스 +25%, 일반 -6% · 받는 피해 +6%',{pressure:true,taken:1.06})],
 gunner:[opt('sustain','연속 압박','같은 적 4타째부터 기본 피해 +20% · 새 표적 첫 타 -10%',{sustain:true}),opt('mobile','기동 사격','이동 중 기본 피해 +18% · 정지 중 -6%',{mobile:true})],
 fighter:[opt('pursuit','돌진 연투','E 후 6초간 근접 기본 피해 +30% · 장풍 -8%',{pursuit:true,ranged:.92}),opt('flow','기공 연계','장풍 사용 후 4초간 근접 기본 피해 +25% · 기본 피해 -4%',{flow:true,basic:.96})],
};
// IDs remain stable in both saved presets; only the current advancement resolves effects.
const branchE={
 wind:[opt('sweep','넓은 산개','E 산개·명중 폭 +30% · 피해 -10%',{eRadius:1.3,eMul:.9}),opt('needle','좁은 산개','E 산개·명중 폭 -20% · 피해 +20%',{eRadius:.8,eMul:1.2})],
 hawk:[opt('sweep','신중한 조준','E 명중 폭 +30% · 피해 -10%',{eRadius:1.3,eMul:.9}),opt('needle','일점 조준','E 명중 폭 -20% · 피해 +20%',{eRadius:.8,eMul:1.2})],
 flame:[opt('spread','번지는 업화','E 반경 +20% · 피해 -12%',{eRadius:1.2,eMul:.88}),opt('center','응축 업화','E 반경 -20% · 피해 +20%',{eRadius:.8,eMul:1.2})],
 frost:[opt('spread','퍼지는 눈보라','E 반경 +20% · 피해 -12%',{eRadius:1.2,eMul:.88}),opt('center','응축 빙설','E 반경 -20% · 피해 +20%',{eRadius:.8,eMul:1.2})],
 paladin:[opt('quakewide','성광 확산','E 충격 반경 +20% · 보호막 흡수 -20%',{eRadius:1.2,eShield:.8}),opt('quakestrike','응축 방벽','E 보호막 흡수 +25% · 지속 -25%',{eShield:1.25,eDuration:.75})],
 berserk:[opt('quakewide','넓은 혈전','E 범위 +20% · 피해 -10%',{eRadius:1.2,eMul:.9}),opt('quakestrike','집중 혈전','E 범위 -20% · 피해 +20%',{eRadius:.8,eMul:1.2})],
 duel:[opt('fan','표적 포착','E 표적 탐색 반경 +20% · 피해 -10%',{eRadius:1.2,eMul:.9}),opt('beam','압축 사격','E 표적 탐색 반경 -20% · 쿨 -12%',{eRadius:.8,eCd:.88})],
 thorn:[opt('fan','넓은 조준','E 명중 폭 +20% · 피해 -10%',{eRadius:1.2,eMul:.9}),opt('beam','정밀 장전','E 명중 폭 -20% · 쿨 -12%',{eRadius:.8,eCd:.88})],
 tiger:[opt('dashwide','넓은 연격','E 범위 +20% · 피해 -10%',{eRadius:1.2,eMul:.9}),opt('dashstrike','압축 연격','E 피해 +20% · 밀치기 -40%',{eMul:1.2,eKnock:.6})],
 dragon:[opt('dashwide','넓은 묘풍','E 명중 폭 +20% · 피해 -10%',{eRadius:1.2,eMul:.9}),opt('dashstrike','압축 묘풍','E 피해 +20% · 비행거리 -25%',{eMul:1.2,eReach:.75})],
};
const paladinOperation=[opt('assault','공세 운용','Q 피해·E 흡수 +8%, 쿨 -6% · 받는 피해 +8%',{qMul:1.08,eShield:1.08,qCd:.94,eCd:.94,taken:1.08}),operation[1]];
const dragonFinal=[opt('pursuit','기공 연투','E 후 6초간 장풍 기본 피해 +25% · 근접 -8%',{pursuitRanged:true,melee:.92}),final.fighter[1]];
export const treeOptions=(hero,branch,tier)=>!branches[hero]?.includes(branch)?[]:tier===15?basic[hero]:tier===20?q[branch]||[]:tier===30?branchE[branch]:tier===40?(branch==='paladin'?paladinOperation:operation):tier===50?(branch==='dragon'?dragonFinal:final[hero]):[];
export function cleanTrees(value) {
  const out={}; for(const [h,bs] of Object.entries(branches)) for(const b of bs) {
    const r=value?.[h]?.[b]; if(!r||typeof r!=='object')continue;
    const presets=[0,1].map(i=>Object.fromEntries(TREE_RELEASED.flatMap(l=>treeOptions(h,b,l).some(o=>o.id===r.presets?.[i]?.[l])?[[l,r.presets[i][l]]]:[])));
    (out[h]||={})[b]={active:r.active===1?1:0,presets};
  } return out;
}
export function treeBuild(trees,hero,branch,level) {
  const r=cleanTrees(trees)[hero]?.[branch]; const choices={};
  if(r)for(const l of TREE_RELEASED)if(level>=l&&r.presets[r.active][l])choices[l]=r.presets[r.active][l];
  return Object.freeze({version:TREE_VERSION,hero,branch,level,preset:r?.active||0,choices:Object.freeze(choices)});
}
export function treeMods(build) {
  const m={basic:1,rate:1,aoe:1,basicRange:1,taken:1,boss:1,normal:1,melee:1,ranged:1,qMul:1,qCd:1,qRadius:1,qCC:1,qDuration:1,eMul:1,eCd:1,eRadius:1,eCC:1,eKnock:1,move:1};
  for(const l of TREE_RELEASED) if(build?.level>=l) {const o=treeOptions(build.hero,build.branch,l).find(x=>x.id===build.choices?.[l]);if(o)for(const k of Object.keys(o))if(!['id','n','d'].includes(k))m[k]=typeof o[k]==='number'?(m[k]??1)*o[k]:o[k];}
  // Explicit tree-only bounds; no equipment/proc modifier is fed back into this layer.
  for(const [k,lo,hi] of [['basic',.7,1.5],['rate',.7,1.3],['taken',.75,1.25],['qMul',.7,1.5],['eMul',.7,1.5],['qCd',.7,1.4],['eCd',.7,1.4],['qCC',.6,1.25],['eCC',.6,1.25],['qDuration',.7,1.3]])m[k]=Math.max(lo,Math.min(hi,m[k]));
  if(m.line){m.pierce=m.pierce||.35;m.pierceCount=3;}
  return Object.freeze(m);
}
export function changeTree(trees,hero,branch,level,preset,tier,choice) {
  if(!branches[hero]?.includes(branch)||![0,1].includes(preset))return null;
  const t=cleanTrees(trees);const r=(t[hero]||={})[branch]||={active:0,presets:[{},{}]};
  if(tier===null){r.active=preset;return t;}
  if(!TREE_RELEASED.includes(tier)||level<tier||!treeOptions(hero,branch,tier).some(o=>o.id===choice))return null;
  r.presets[preset][tier]=choice;return t;
}
export const treeImpactMul=(m,target)=>m?.execute?(target&&target.hp<=target.max*.35?1.25:.96):1;
export function basicTreeMul(h,target,mode='ranged',now=0,deferImpact=false) {
  const m=h.treeMods||treeMods(h.tree);let k=m.basic*(target?.E?.boss||target?.elite?m.boss:m.normal)*(mode==='melee'?m.melee:m.ranged);
  if(m.stack||m.switch||m.sustain){const same=h.treeTarget===target;h.treeChain=same?Math.min(4,(h.treeChain||0)+1):0;h.treeTarget=target;k*=m.stack?(same?1+.04*h.treeChain:.96):(m.switch?(same?.96:1.18):1);if(m.sustain)k*=same?(h.treeChain>=3?1.2:1):.9;}
  if(!deferImpact)k*=treeImpactMul(m,target);
  if(m.pressure)k*=target?.E?.boss||target?.elite?1.25:.94;
  if(m.siege&&target?.g&&h.g){const d=Math.hypot(target.g.position.x-h.g.position.x,target.g.position.z-h.g.position.z);k*=d>=7?1.2:d<4?.9:1;}
  if(m.mobile)k*=h.treeMoving?1.18:.94;
  if(m.pursuit&&mode==='melee'&&now<(h.treeFollowUntil||0))k*=1.3;
  if(m.pursuitRanged&&mode==='ranged'&&now<(h.treeFollowUntil||0))k*=1.25;
  if(m.flow){if(mode==='ranged')h.treeFlowUntil=now+4;else if(now<(h.treeFlowUntil||0))k*=1.25;}
  return k;
}
export const treeSummary=build=>TREE_RELEASED.map(l=>treeOptions(build?.hero,build?.branch,l).find(x=>x.id===build?.choices?.[l])?.n).filter(Boolean).join(' · ')||'특성 미선택';

// Tree cooldown reduction stops at 60% total; pre-existing stronger dungeon effects stay unchanged.
export const treeCooldown=(base,original,mul=1)=>Math.max(Math.min(base,original*.4),base*mul);

export const treeTaken=h=>Math.max(.75,(h.treeMods?.taken||1)*(h.treeMods?.lastguard&&h.hp<h.max*.4?.8:1));
export const treeQBonus=(h,now)=>h.treeMods?.weave&&now<(h.treeWeaveUntil||0)?1.25:1;
export function treeSkillUsed(h,key,now){if(key==='e'){h.treeFollowUntil=now+6;if(h.treeMods?.weave)h.treeWeaveUntil=now+6;}else if(key==='q')h.treeWeaveUntil=0;}
export function treeESkill(s,m={}){return s?{...s,mul:s.mul*(m.eMul||1),radius:m.eRadius||1,cc:m.eCC||1,knock:m.eKnock||1,reachMul:m.eReach||1,shieldMul:m.eShield||1,durationMul:m.eDuration||1}:null;}
