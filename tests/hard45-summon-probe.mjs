// State-injected boundary test only; never counted as a completed battle.
import {G} from '/src/core/state.js';
import {spawnEnemy,hurt,removeEnemy} from '/src/monsters/enemy.js';
import {abilityTick,clearAbilities} from '/src/monsters/abilities.js';
export function run(){
 if(location.hostname!=='127.0.0.1'||location.port!=='8854'||!window.__isolatedReview?.memoryOnly||G.phase!=='build'||!['ruin-ring','spore-cross'].includes(G.stage.rule))throw Error('isolated build required');
 G.manual=true;G.pauseRender=true;G.setAutoSkill(false,false);
 const ruin=G.stage.rule==='ruin-ring',type=ruin?'boss_ruins':'boss_swamp',boss=spawnEnemy(type,1);
 const before={gold:G.gold,kills:{...G.stats.kills},summoned:G.stats.summonedKills||0,drops:G.runDrops?.length||0};
 if(ruin){for(const k of Object.keys(boss.abT))boss.abT[k]=1e9;boss.abT.summon=0;abilityTick(boss,.01);if(boss.cast?.k!=='summon')throw Error('native summon did not start');abilityTick(boss,boss.cast.t+.01);}
 else {boss.hp=boss.max*.4;abilityTick(boss,.01);if(boss.swampCast?.kind!=='rupture')throw Error('native rupture did not start');abilityTick(boss,boss.swampCast.t+.01);}
 const children=G.enemies.filter(e=>e!==boss),definitions=children.map(e=>({type:e.type,gold:e.E.gold,hardSummoned:e.E.hardSummoned,elite:e.E.hardElite}));
 if(children.length!==3||definitions.some(e=>e.gold||!e.hardSummoned||e.elite))throw Error('summon accounting definition mismatch');
 for(const e of children)hurt(e,1e9);
 const after={gold:G.gold,kills:{...G.stats.kills},summoned:G.stats.summonedKills||0,drops:G.runDrops?.length||0};
 if(after.gold!==before.gold||JSON.stringify(after.kills)!==JSON.stringify(before.kills)||after.summoned-before.summoned!==3||after.drops!==before.drops)throw Error('summon economy mismatch');
 for(const e of [...G.enemies])removeEnemy(e);clearAbilities();
 return{conditions:'RAM-only native boss ability/spawn/hurt/kill path; timers/HP forced only to trigger boundary; not real combat completion',stage:G.stage.id,definitions,before,after};
}
