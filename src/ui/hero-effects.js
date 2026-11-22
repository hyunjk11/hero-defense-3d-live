import { castleIcon } from './castle-icon.js';
import { TQ } from '../data/fighter.js';
import { focusMods } from '../data/hero-growth.js';
import { treeTaken } from '../data/skill-tree.js';

// Projection only: read combat-owned timers/flags; never call stat.dmg or roll RNG.
export function heroEffects(h, context = {}) {
  if (!h || h.dead > 0 || h.hp <= 0) return [];
  const now = context.now || 0, m = h.treeMods || {}, out = [];
  const add = (id, name, detail = '', time = null, kind = 'buff', note = '') => out.push({id,name,detail,time,kind,note});
  const timed = (id,name,detail,time,kind='buff') => { if (Number.isFinite(time) && time > 0) add(id,name,detail,time,kind); };
  const pct = n => Math.round(n * 1000) / 10;
  if (h.eShield?.value > 0) timed('shield','성광 방벽',`${Math.ceil(h.eShield.value)}`,h.eShield.until-now);
  if (h.adv) timed('sanctuary','성역','회복 3%/초',h.sanctT);
  if (h.ft?.leap?.kind === 'quake') add('tiger-guard','백호 수호',`피해 −${pct(TQ.guard)}%`);
  timed('ice-slow','빙판 둔화','이속 −20%',h.hardSlowUntil-now,'debuff');
  if (m.weave) timed('weave','원소 연계','다음 Q +25%',h.treeWeaveUntil-now);
  if (m.pursuit) timed('pursuit','돌진 연투','근접 +30%',h.treeFollowUntil-now);
  if (m.pursuitRanged) timed('pursuit-ranged','기공 연투','장풍 +25%',h.treeFollowUntil-now);
  if (m.flow) timed('flow','기공 연계','근접 +25%',h.treeFlowUntil-now);
  const a = h.adv?.atk;
  if (a?.lowHp && h.hp <= h.max*a.lowHp && a.lowAtk > 1) add('fury','광전사',`공격 +${pct(a.lowAtk-1)}%`);
  if (m.lastguard && h.hp < h.max*.4) {
    const before = Math.max(.75,m.taken || 1), after = treeTaken(h);
    if (after < before) add('lastguard','최후의 수호',`피해 ×${after.toFixed(2)}`,null, 'buff','특성으로 받는 피해의 최종 배율');
  }
  if (m.mobile && h.treeMoving) add('mobile','기동 사격','기본 +18%');
  const target = h.treeTarget;
  if (target && !target.dead && target.dying === undefined) {
    if (m.stack && h.treeChain > 0) add('stack','집중 탄창',`동일 대상 +${pct(.04*Math.min(4,h.treeChain))}%`);
    if (m.sustain && h.treeChain >= 3) add('sustain','연속 압박','동일 대상 +20%');
  }
  if (context.castleRank > 0) add('castle-defense','수성',`공격 +${context.castleRank / 2}% · 받는 피해 −${context.castleRank}%`);
  if (context.growthEnabled && context.focus > 0) {
    const f=focusMods(context.focus);
    add('focus','전투 집중',`${context.focus}강`,null,'buff',`공격 +${pct(f.dmg-1)}% · 공속 +${pct(f.rate-1)}% · 스킬 +${pct(f.skill-1)}% · 쿨 ×${f.cd.toFixed(2)}`);
  }
  const d = context.dungeon ? context.dungeonMods : null;
  if (d) {
    timed('bless-rally','진격의 함성','이속 +30%',h.blessHasteUntil-now);
    for (const [key,name,detail] of [['dmg','축복: 공격',`+${pct((d.dmg||1)-1)}%`],['rate','축복: 공속',`+${pct((d.rate||1)-1)}%`],['range','축복: 사거리',`+${pct((d.range||1)-1)}%`]])
      if (d[key]>1) add('bless-'+key,name,detail);
    if (context.dungeonDamage && d.taken < 1) add('bless-guard','축복: 수호',`피해 −${pct(1-d.taken)}%`);
    if (d.cd < 1) add('bless-cd','축복: 재사용',`Q −${pct(1-d.cd)}%`);
    if (d.crit > 0) add('bless-crit','축복: 치명',`+${pct(d.crit/100)}%`);
    if (d.regen > 0) add('bless-regen','축복: 재생',`${pct(d.regen*(context.healScale??1))}%/초`);
    if (context.damageScale < 1) add('resisted','적 저항',`피해 −${pct(1-context.damageScale)}%`,null,'debuff');
    if (context.healScale < 1) add('curse','층 저주',`회복 −${pct(1-context.healScale)}%`,null,'debuff');
  }
  return out;
}


const views = new WeakMap();
const duration = t => Number.isFinite(t) && t > 0 ? `${(Math.max(1,Math.ceil(t*10-1e-8))/10).toFixed(1)}초` : '';
const EFFECT_ICONS = {
 'bless-rally':'💨',shield:'🛡',sanctuary:'✚','tiger-guard':'🐯','ice-slow':'❄',weave:'✦',pursuit:'➤','pursuit-ranged':'↗',flow:'☯',
 fury:'🔥','lastguard':'⬟',mobile:'➶',stack:'▥',sustain:'⤳',focus:'◎',
 'bless-dmg':'⚔','bless-rate':'⚡','bless-range':'🏹','bless-guard':'🛡','bless-cd':'⏱','bless-crit':'🎯','bless-regen':'🌿',
 resisted:'⛨',curse:'☠',invulnerable:'◇'
};
const effectLabel = e => [e.kind==='buff'?'버프':'디버프',e.name,e.detail,duration(e.time),e.note].filter(Boolean).join(' · ');
function closeEffectTip(view) {
  if(view.open)view.nodes.get(view.open)?.removeAttribute('aria-describedby');
  view.open=null;view.pinned=false;view.tip.hidden=true;
}
function positionEffectTip(view) {
  const n=view.nodes.get(view.open);if(!n)return;
  const r=n.getBoundingClientRect(),t=view.tip.getBoundingClientRect(),win=n.ownerDocument.defaultView;
  const width=win?.innerWidth||n.ownerDocument.documentElement.clientWidth;
  view.tip.style.left=Math.max(8,Math.min(r.left+r.width/2-t.width/2,width-t.width-8))+'px';
  view.tip.style.top=Math.max(8,r.top-t.height-8)+'px';
}
function openEffectTip(view,id) {
  const n=view.nodes.get(id);if(!n)return;
  if(view.open!==id){closeEffectTip(view);view.open=id;}
  view.tip.textContent=n.getAttribute('aria-label');view.tip.hidden=false;
  n.setAttribute('aria-describedby',view.tip.id);positionEffectTip(view);
}
export function renderHeroEffects(container,h,context={}) {
  if(!container)return;
  let view=views.get(container);
  if(!view){
    const doc=container.ownerDocument,tip=doc.createElement('div');
    tip.id=(container.id||'heroEffects')+'Detail';tip.className='heroEffectTooltip';tip.setAttribute('role','tooltip');tip.hidden=true;doc.body.appendChild(tip);
    view={hero:null,nodes:new Map(),tip,open:null,pinned:false};views.set(container,view);
    doc.addEventListener('pointerdown',e=>{if(view.open&&!container.contains(e.target))closeEffectTip(view);},true);
    doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&view.open){closeEffectTip(view);e.stopPropagation();}},true);
    container.addEventListener('scroll',()=>{if(view.open)closeEffectTip(view);},{passive:true});
    doc.defaultView?.addEventListener('resize',()=>closeEffectTip(view),{passive:true});
  }
  if(view.hero!==h){closeEffectTip(view);container.replaceChildren();view.nodes.clear();view.hero=h;container.scrollTop=0;container.scrollLeft=0;}
  const effects=heroEffects(h,context),active=new Set(effects.map(x=>x.id));
  for(const [id,n] of view.nodes)if(!active.has(id)){if(view.open===id)closeEffectTip(view);n.remove();view.nodes.delete(id);}
  effects.forEach((e,i)=>{
    let n=view.nodes.get(e.id);
    if(!n){
      n=container.ownerDocument.createElement('button');n.type='button';n.dataset.effect=e.id;view.nodes.set(e.id,n);
      n.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')openEffectTip(view,e.id);});
      n.addEventListener('pointerleave',()=>{if(!view.pinned&&n.ownerDocument.activeElement!==n)closeEffectTip(view);});
      n.addEventListener('focus',()=>openEffectTip(view,e.id));
      n.addEventListener('blur',()=>closeEffectTip(view));
      n.addEventListener('click',event=>{event.stopPropagation();if(view.open===e.id&&view.pinned)closeEffectTip(view);else{openEffectTip(view,e.id);view.pinned=true;}});
      n.addEventListener('pointerdown',event=>event.stopPropagation());
    }
    n.className=`heroEffect ${e.kind}`;
    const icon=EFFECT_ICONS[e.id]||(e.kind==='buff'?'↑':'↓'),label=effectLabel(e);
    if(e.id==='castle-defense'){if(!n.firstElementChild)n.innerHTML=castleIcon;}
    else if(n.textContent!==icon)n.textContent=icon;
    if(n.getAttribute('aria-label')!==label)n.setAttribute('aria-label',label);
    if(container.children[i]!==n)container.insertBefore(n,container.children[i]||null);
    if(view.open===e.id){if(view.tip.textContent!==label)view.tip.textContent=label;positionEffectTip(view);}
  });
  container.hidden=!effects.length;
}
