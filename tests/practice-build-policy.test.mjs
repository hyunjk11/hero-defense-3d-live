import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PATH_PROFILES} from '../src/data/paths.js';
import {BARRICADE,TOWERS} from '../src/data/towers.js';

globalThis.location = new URL('https://hyunjk11.github.io/hero-defense-3d-live/?practice=1');
const grid = await import('../src/core/grid.js');
const rules = await import('../src/world/tower-rules.js');
const source = p => fs.readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const js = p => source(p).replace(/^import .*;\r?$/gm, '').replace(/^export \{.*\};?\r?$/gm,'').replace(/^export /gm,'');
const segment = (s,a,b) => s.slice(s.indexOf(a),s.indexOf(b));
const {GW, GH, T, CORE, SPAWN, SPAWNS} = grid;

function arena() {
  const G={practiceSandbox:true, phase:'build', wave:0, gold:0, tool:'guardian', enemies:[], towers:[], stats:{}};
  const c=vm.createContext({...grid,...rules,G,PATH_PROFILES,performance,URLSearchParams,location,TOWERS,BARRICADE,hero:null,drawRoute(){},
    seed:42,tileAt:(x,z)=>G.tiles[x][z]});
  const gen=segment(source('src/world/terrain.js'),'function genMap()','// 던전 원정 동굴 방');
  const rng=segment(source('src/core/util.js'),'function mulberry32','// HTML');
  vm.runInContext(rng+gen+'genMap();\n'+js('src/world/pathfinding.js')+js('src/combat/build.js')+'this.api={dijkstra,computeDist,nextStep,canBuild,toolCost};',c);
  return {G,c,...c.api};
}
test('PC and mobile share flat practice with original portal/core and continuous route',()=>{
  assert.equal(grid.PRACTICE_SANDBOX,true);
  execFileSync(process.execPath,['--input-type=module','-e', `
    import assert from 'node:assert/strict';
    globalThis.location=new URL('https://hyunjk11.github.io/hero-defense-3d-live/?practice=1&mobileApp=1');
    const {PRACTICE_SANDBOX}=await import('./src/core/grid.js'); assert.equal(PRACTICE_SANDBOX,true);
  `]);
  const a=arena(), flat=a.G.tiles.flat();
  assert.equal(flat.filter(t=>t.t===T.GRASS).length,GW*GH-2);
  assert.deepEqual(Array.from(a.G.tiles[SPAWN[0]].filter(t=>t.t===T.SPAWN),t=>[t.c,t.r]),[SPAWN]);
  assert.equal(a.G.tiles[CORE[0]][CORE[1]].t,T.CORE);
  a.computeDist(); let p=SPAWN;
  for(let n=0;n<GW*GH&&String(p)!==String(CORE);n++){p=a.nextStep(...p);assert.ok(p);}
  assert.equal(String(p),String(CORE));
});
test('sandbox unlocks all towers for free but cannot block entry, core, active enemies or last path',()=>{
  const a=arena();
  for(const tool of Object.keys(TOWERS)){a.G.tool=tool;assert.equal(a.toolCost(a.G.tiles[2][7]),0);assert.equal(a.canBuild(2,7),true);}
  assert.equal(a.canBuild(...SPAWN),false);assert.equal(a.canBuild(...CORE),false);
  assert.equal(a.canBuild(2,7,'clear'),false);assert.equal(a.canBuild(2,7,'barricade'),true);
  const corridor=6;
  for(let r=0;r<GH;r++)if(r!==corridor)a.G.tiles[10][r].tower={};
  assert.equal(a.canBuild(10,corridor),false);
  assert.equal(a.canBuild(10,corridor,'barricade'),true);
  a.G.enemies.push({tile:[5,7],next:[6,7],E:{fly:false}});
  assert.equal(a.canBuild(5,7),false);assert.equal(a.canBuild(6,7),false);
  const en=a.G.enemies[0];en.tile=[7,7];en.next=null;
  for(const [x,z] of [[7,8],[6,7],[7,6]])a.G.tiles[x][z].tower={};
  assert.equal(a.canBuild(8,7),false);
  a.G.practiceSandbox=false;assert.equal(a.canBuild(2,7,'guardian'),false);assert.equal(a.canBuild(2,7,'arrow'),false);
});
test('free upgrade ignores XP but still requires specialization and respects level cap',()=>{
  const tw={type:'guardian',lvl:1,xp:0,branch:null};
  assert.equal(rules.towerUpgradeCost(tw,true),0);
  assert.equal(rules.towerUpgradeBlock(tw,0,true),null);
  assert.equal(rules.towerUpgradeBlock(tw,0,false),'골드 부족');
  tw.lvl=3;
  assert.equal(rules.towerSpecializable(tw,true),true);
  assert.equal(rules.towerSpecializable(tw,false),false);
  assert.equal(rules.towerUpgradeBlock(tw,0,true),'전문화 선택 필요');
  tw.branch='guardian_bulwark';
  assert.equal(rules.towerUpgradeBlock(tw,0,true),null);
  tw.lvl=5;assert.equal(rules.towerUpgradeBlock(tw,0,true),'최대 레벨');
});
