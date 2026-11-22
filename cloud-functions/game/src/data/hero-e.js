// Permanent hero E: derived from the authoritative sortie level, never from equipment.
export const E_LEVEL = 10;
export const HERO_E = {
  pierce: { key: 'pierce', h: 'archer', type: 'active', n: '관통샷', cd: 8, mul: 3, d: '[E] 황금 화살을 충전해 일직선 위의 모든 적을 꿰뚫음 (300% 피해) · 기본 재사용 8초' },
  meteorstorm: { key: 'meteorstorm', h: 'mage', type: 'active', n: '메테오 스톰', cd: 12, mul: 4, d: '[E] 목표 지역에 운석 6개를 쏟아부음 (일반 5개 각 400%·마지막 600% 피해) · 기본 재사용 12초' },
  quake: { key: 'quake', h: 'warrior', type: 'active', n: '천지파열무', cd: 14, mul: 4, d: '[E] 도약해 땅을 내리쳐 충격파 — 주변 적 400% 피해 + 0.8초 공중에 띄움(기절) · 기본 재사용 14초' },
  rosebarrage: { key: 'rosebarrage', h: 'gunner', type: 'active', n: '장미 탄막', cd: 11, mul: 1.5, d: '[E] 목표 방향 부채꼴로 장미 탄환 3연속 일제 사격(각 150% 피해·3명 관통) → 끝에서 장미 폭발 (300% 피해) · 기본 재사용 11초' },
  tigerdash: { key: 'tigerdash', h: 'fighter', type: 'active', n: '맹호 돌진', cd: 10, mul: 3, d: '[E] 목표 방향으로 질풍처럼 돌진하며 지나가는 모든 적에게 300% 피해 + 밀쳐내기 · 기본 재사용 10초' },
};
const BY_HERO = Object.fromEntries(Object.values(HERO_E).map(s => [s.h, s.key]));
const variant=(h,b,n,icon,kind,cd,mul,params,d)=>({key:`${h}_${b}`,h,b,n,icon,kind,cd,mul,...params,type:'active',d:`[E] ${d} · 재사용 ${cd}초`});
export const ADV_E = {
 archer: {
  wind:variant('archer','wind','질풍 삼연시','🍃','fan',8,1.8,{reach:24,width:.8,spread:.3,cast:.35},'3갈래 화살 · 적마다 180% 1회 · 거리 24'),
  hawk:variant('archer','hawk','매의 심판','🦅','line',12,6,{reach:30,width:.8,cast:.7},'0.7초 조준 후 첫 적 600% · 거리 30'),
 },
 mage: {
  flame:variant('mage','flame','업화 기둥','🔥','field',12,4.5,{reach:16,area:4.2,duration:3,ticks:6,burnDps:1,burnDuration:2,cast:.6},'반경 4.2 · 3초간 6회 각 450% · 지상·공중 · 적중 시 2초 화상(초당 100%, 재적중 갱신·중첩 불가)'),
  frost:variant('mage','frost','블리자드','❄️','field',14,1.5,{reach:16,area:4.8,duration:4,ticks:8,slow:.4,bossSlow:.2,freeze:.6,bossFreeze:.2,cast:.6},'반경 4.8 · 4초간 8회 각 150% · 둔화 40%(보스 20%) · 끝에 빙결 0.6초(보스 0.2초)'),
 },
 warrior: {
  paladin:variant('warrior','paladin','성광 방벽','🛡️','shield',16,1.2,{reach:0,area:4,shield:.35,duration:6,ground:true,cast:.3},'최대 체력 35% 보호막 6초(중첩 불가) · 주변 지상 120%'),
  berserk:variant('warrior','berserk','혈전참','💢','cone',12,2.5,{reach:5,area:5,arc:1.1,ticks:2,interval:.25,ground:true,cast:.2},'전방 반경 5 · 지상 250%씩 2연격'),
 },
 gunner: {
  duel:variant('gunner','duel','장미 추격전','🌹','volley',11,1.5,{reach:13,area:3,ticks:6,interval:.18,cast:.15},'목표 주변 반경 3의 적을 골라 6발 · 각 150% · 사거리 13'),
  thorn:variant('gunner','thorn','장미 절명탄','🎯','line',13,8,{reach:24,width:.6,cast:1},'1초 조준 후 첫 적 800% · 거리 24'),
 },
 fighter: {
  tiger:variant('fighter','tiger','백호연격','🐯','cone',10,.9,{reach:3.5,area:3.5,arc:1.2,ticks:3,interval:.18,ground:true,knockBase:1.6,cast:.15},'전방 반경 3.5 · 지상 90%씩 3연격 · 끝에 밀치기'),
  dragon:variant('fighter','dragon','묘풍연탄','🐈','paw',10,1,{reach:18,width:1,ticks:3,interval:.2,pierce:3,cast:.15},'고양이가 전방 적을 추적 · 100%씩 최대 9타(적마다 3타) · 비행 거리 18 · 공중 타격'),
 },
};
const branchKey=a=>typeof a==='string'?a:a?.k||a?.b;
export const eInfoFor = (cls,adv) => ADV_E[cls]?.[branchKey(adv)] || HERO_E[BY_HERO[cls]] || null;
export const eSkillFor = (cls,level,adv) => Number.isFinite(level)&&level>=E_LEVEL?eInfoFor(cls,adv):null;
export const eKeyFor = (cls,level,adv) => eSkillFor(cls,level,adv)?.key||null;
export const advanceEByKey = key => Object.values(ADV_E).flatMap(x=>Object.values(x)).find(x=>x.key===key)||null;
export function eDescription(s){
 if(s?.awakening)return s.n;
 if(!s?.kind)return s?.d||'';const n=x=>Math.round(x*100)/100,d=n(s.mul*100),r=n(s.area*(s.radius||1)),reach=n(s.reach*(s.reachMul||1));
 switch(s.kind){
  case 'fan':return `3갈래 화살 · 적마다 ${d}% 1회 · 거리 ${reach}`;
  case 'line':return `${s.cast}초 조준 후 첫 적 ${d}% · 거리 ${reach}`;
  case 'field':return `반경 ${r} · ${s.duration}초간 ${s.ticks}회 각 ${d}%`+(s.burnDps?` · 지상·공중 · 적중 시 ${s.burnDuration}초 화상(초당 ${n(s.burnDps*(s.damageMul||1)*100)}%, 재적중 갱신·중첩 불가)`:s.ground?' · 지상':` · 둔화 ${n(s.slow*100)}%(보스 ${n(s.bossSlow*100)}%) · 끝에 빙결 ${n(s.freeze*(s.cc||1))}초(보스 ${n(s.bossFreeze*(s.cc||1))}초)`);
  case 'shield':return `최대 체력 ${n(Math.min(.5,s.shield*(s.shieldMul||1))*100)}% 보호막 ${n(Math.min(8,s.duration*(s.durationMul||1)))}초(중첩 불가) · 반경 ${r} 지상 ${d}%`;
  case 'cone':return `전방 반경 ${r} · 지상 ${d}%씩 ${s.ticks}연격`+(s.knockBase?` · 끝에 ${n(s.knockBase*(s.knock||1))}m 밀치기(보스 제외)`:'');
  case 'volley':return `목표 주변 반경 ${r}에서 재탐색 · ${s.ticks}발 각 ${d}% · 사거리 ${reach}`;
  case 'paw':return `고양이가 전방 적을 추적 · ${d}%씩 최대 ${s.pierce*s.ticks}타(적마다 ${s.ticks}타) · 비행 거리 ${reach} · 공중 타격`;
 }
}
// Per-sortie transient absorption, never saved. Recasts replace; they cannot add shields.
export function grantEShield(h,s,now){const value=Math.min(h.max*.5,h.max*s.shield*(s.shieldMul||1));return h.eShield={value,initial:value,until:now+Math.min(8,s.duration*(s.durationMul||1))};}
export function absorbEShield(h,damage,now){const b=h.eShield;if(!b||b.until<=now||h.dead>0){h.eShield=null;return damage;}const used=Math.min(Math.max(0,damage),b.value);b.value-=used;if(b.value<=0)h.eShield=null;return Math.max(0,damage-used);}
