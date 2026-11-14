import assert from 'node:assert/strict';
import {bossBuffs,renderBossDebuffs} from '../src/ui/boss-debuffs.js';
import {heroEffects,renderHeroEffects} from '../src/ui/hero-effects.js';
import {grantEShield,absorbEShield} from '../src/data/hero-e.js';
import {treeSkillUsed,treeQBonus,treeTaken,basicTreeMul} from '../src/data/skill-tree.js';
import {ETYPES} from '../src/data/monsters.js';
import {frenzyK} from '../src/data/spire.js';
const ids=a=>a.map(x=>x.id), h=()=>({hp:100,max:100,dead:0,treeMods:{}}), b=extra=>({E:{boss:true},...extra});
assert.deepEqual(bossBuffs(null),[]);assert.deepEqual(bossBuffs(b({dead:true,shield:9})),[]);
assert.deepEqual(bossBuffs(b({dying:0,shield:9})),[]);
let e=b({shield:120,shieldT:5,shDark:true,immT:14,phaseT:2});
assert.deepEqual(ids(bossBuffs(e,10)),['shield','immune']);
assert.equal(bossBuffs(e,10)[0].detail,'120');assert.equal(bossBuffs(e,10)[1].time,4);
e.shield=0;assert.deepEqual(ids(bossBuffs(e,14)),[]); // duration alone is not absorption
e=b({E:{boss:true,ab:{enrage:{spd:1.4},dread:{cd:.7},pack:{red:.3},crack:{armor:.5}}},enraged:true,phase2:true,packOn:true,armor:.5});
assert.deepEqual(ids(bossBuffs(e)),['enrage','dread','pack','ice-armor']);e.cracked=true;assert(!ids(bossBuffs(e)).includes('ice-armor'));
for(const [family,flag] of [['desert','desertAwakened'],['storm','stormAwakened'],['machine','machineAwakened'],['endgame','endAwakened']]){
 const a=b({E:{boss:true,[family]:{phase:{everyK:.7}}},[flag]:true});assert.deepEqual(ids(bossBuffs(a)),['awaken']);a[flag]=false;assert.deepEqual(bossBuffs(a),[]);
}
e=b({E:{boss:true,dgBoss:true,shieldDef:{}},bz:{phase:2}});assert.deepEqual(ids(bossBuffs(e)),['dungeon-rage','guard']);e.guardOpenT=1;assert(!ids(bossBuffs(e)).includes('guard'));
const floor={affixes:['haste','armor','regen','frenzy']},base=ETYPES.boss_forest;
e={type:'boss_forest',E:{...base,spd:base.spd*1.2,armor:(base.armor||0)+.15},hp:30,max:100};
let context={floor,attackScale:frenzyK(floor,e.hp,e.max)};
assert.deepEqual(ids(bossBuffs(e,0,context)),['spire-haste','spire-armor','spire-regen','spire-frenzy']);
e.hp=100;context.attackScale=frenzyK(floor,e.hp,e.max);assert.deepEqual(ids(bossBuffs(e,0,context)),['spire-haste','spire-armor']);
e.armor=0;assert(!ids(bossBuffs(e,0,context)).includes('spire-armor'));assert.deepEqual(bossBuffs(e),[]);

let hero=h();grantEShield(hero,{shield:.35,duration:6},10);
assert.equal(heroEffects(hero,{now:10})[0].detail,'35');
assert.equal(absorbEShield(hero,12,11),0);assert.equal(heroEffects(hero,{now:11})[0].detail,'23');
grantEShield(hero,{shield:.35,duration:6},12);assert.equal(heroEffects(hero,{now:12})[0].time,6);
assert.equal(absorbEShield(hero,50,13),15);assert.deepEqual(heroEffects(hero,{now:13}),[]);
grantEShield(hero,{shield:.35,duration:6},10);assert.deepEqual(heroEffects(hero,{now:16}),[]);
hero=h();hero.treeMods={weave:true,pursuit:true,pursuitRanged:true,flow:true};treeSkillUsed(hero,'e',10);hero.treeFlowUntil=14;
assert.deepEqual(ids(heroEffects(hero,{now:10})),['weave','pursuit','pursuit-ranged','flow']);assert.equal(treeQBonus(hero,10),1.25);
treeSkillUsed(hero,'q',11);assert(!ids(heroEffects(hero,{now:11})).includes('weave'));assert.equal(treeQBonus(hero,11),1);
assert.deepEqual(heroEffects(hero,{now:16}),[]);
hero=h();hero.hardSlowUntil=11;assert.equal(heroEffects(hero,{now:10})[0].kind,'debuff');assert.deepEqual(heroEffects(hero,{now:11}),[]);
hero=h();hero.adv={atk:{lowHp:.5,lowAtk:1.2}};hero.hp=50;assert(ids(heroEffects(hero)).includes('fury'));hero.hp=51;assert.deepEqual(heroEffects(hero),[]);
hero.treeMods={lastguard:true,taken:.94};hero.hp=39;assert.equal(treeTaken(hero),.752);assert(ids(heroEffects(hero)).includes('lastguard'));hero.hp=40;assert(!ids(heroEffects(hero)).includes('lastguard'));
hero=h();hero.adv={};hero.sanctT=2;hero.ft={leap:{kind:'quake'}};assert.deepEqual(ids(heroEffects(hero)),['sanctuary','tiger-guard']);hero.dead=1;assert.deepEqual(heroEffects(hero),[]);hero.dead=0;hero.sanctT=0;hero.ft.leap=null;assert.deepEqual(heroEffects(hero),[]);
hero=h();hero.treeMods={mobile:true};hero.treeMoving=true;assert(ids(heroEffects(hero)).includes('mobile'));hero.treeMoving=false;assert.deepEqual(heroEffects(hero),[]);
hero=h();hero.uqRateT=99;hero.uqShield=true;assert.deepEqual(heroEffects(hero),[]); // disconnected legacy flags must not advertise nonexistent effects
const ctx={now:1,growthEnabled:true,focus:5,dungeon:true,dungeonDamage:1,dungeonMods:{dmg:1.12,rate:1.15,range:1.15,taken:.75,cd:.75,crit:12,regen:.01},damageScale:.7,healScale:.5};
assert.equal(heroEffects(hero,ctx).length,10);assert.equal(heroEffects(hero,ctx).find(x=>x.id==='bless-regen').detail,'0.5%/초');
const raw=JSON.stringify({hero,ctx,e}), originalRandom=Math.random;Math.random=()=>{throw Error('HUD RNG');};for(let i=0;i<50;i++){heroEffects(hero,ctx);bossBuffs(e,10);}Math.random=originalRandom;assert.equal(JSON.stringify({hero,ctx,e}),raw);

class Node {
 constructor(){this.children=[];this.dataset={};this._text='';this.writes=0;this.hidden=false;this.ownerDocument={createElement:()=>new Node()};}
 set textContent(v){this._text=v;this.writes++;}get textContent(){return this._text;}
 replaceChildren(){this.children.forEach(x=>x.parent=null);this.children=[];}
 insertBefore(n,next){n.remove();this.children.splice(next?this.children.indexOf(next):this.children.length,0,n);n.parent=this;}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
}
const el=new Node();hero=h();hero.hardSlowUntil=12;renderHeroEffects(el,hero,{now:10});assert.equal(el.children[0].textContent,'↓ 빙판 둔화 이속 −20% 2.0초');
const old=el.children[0];renderHeroEffects(el,hero,{now:10});assert.equal(old.writes,1);hero.hardSlowUntil=15;renderHeroEffects(el,hero,{now:10});assert.equal(el.children[0],old);assert.equal(old.writes,2);
renderHeroEffects(el,h(),{now:10});assert(el.hidden);renderHeroEffects(el,hero,{now:10});assert.notEqual(el.children[0],old);renderHeroEffects(el,hero,{now:15});assert(el.hidden);
renderHeroEffects(null,hero);renderHeroEffects(el,null);assert(el.hidden);
const bossEl=new Node();e=b({shield:20,shieldT:2,slowT:1,slowAmt:.3});renderBossDebuffs(bossEl,e,10);assert.deepEqual(bossEl.children.map(x=>x.textContent),['↑ 보호막 20 2.0초','둔화 30% 1.0초']);
const first=bossEl.children[0];e.shield=0;renderBossDebuffs(bossEl,e,10);assert.equal(bossEl.children.length,1);renderBossDebuffs(bossEl,b({shield:9}),10);assert.notEqual(bossEl.children[0],first);renderBossDebuffs(bossEl,null,10);assert(bossEl.hidden);
console.log('PASS combat status: real shield absorption/recast/expiry, tree consume/expiry, HP thresholds, control swap, boss buffs/debuffs, immutable/no RNG, keyed DOM');
