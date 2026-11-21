import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');

for (const [query,visible,hard] of [
  ['stage=1-1',false,false], ['stage=10-6',false,false],
  ['stage=hard-1-1',true,true], ['challenge=1',true,false],
  ['practice=1&stage=1-1',true,true], ['dungeon=1',true,false],
  ['mobileApp=1&stage=1-1',false,false], ['mobileApp=1&stage=hard-1-1',true,true], ['mobileApp=1&challenge=1',true,false],
]) test(`actual stage and platform resolve beam availability: ${query}`, () => {
  execFileSync(process.execPath, ['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {towerStats,branchFor} from './src/data/growth.js';
    globalThis.location = new URL('https://hyunjk11.github.io/hero-defense-3d-live/?'+process.argv[1]);
    const {towerVisible,towerAvailable,hardBeam,HARD_BEAM_COLD,HARD_BEAM_HOT} = await import('./src/world/tower-rules.js');
    assert.equal(towerVisible('guardian'), ${visible});
    assert.equal(hardBeam, ${hard});
    for (const phase of ['build','wave','over']) for (let wave=0;wave<=12;wave++){
      const state = {phase,wave,dungeon:globalThis.location.search.includes('dungeon=1')};
      assert.equal(towerAvailable('guardian',state), ${visible} && !state.dungeon && (phase==='build'?wave>=4:phase==='wave'&&wave>=5));
      assert.equal(towerVisible('arrow'), true);
    }
    const growth = readFileSync('./src/world/growth.js','utf8');
    const body = growth.slice(growth.indexOf('export const recalc'),growth.indexOf('export function decorate'));
    const recalc = new Function('towerStats','branchFor','hardBeam','HARD_BEAM_COLD','HARD_BEAM_HOT',body.replace('export const','const')+'return recalc;')(towerStats,branchFor,hardBeam,HARD_BEAM_COLD,HARD_BEAM_HOT);
    for (const [type,lv,branch] of [['guardian',1,null],['guardian',5,'guardian_bulwark'],['guardian',5,'guardian_assault'],['arrow',1,null]]){
      const tw={type,lvl:lv,branch,stars:3,mods:{dmg:1.25,rate:1.12,rng:1.2}};
      const baseline=towerStats(type,lv,branch,tw.mods,tw.stars);
      recalc(tw); recalc(tw);
      const buff = hardBeam && type==='guardian';
      assert.deepEqual(tw.S,buff?{...baseline,dmg:baseline.dmg*.35,beamMaxHeat:baseline.beamMaxHeat*(1.5/.35),beamHeavy:true}:baseline);
      assert.deepEqual(tw.B,branchFor(type,branch,tw.mods,lv));
    }
  `, query], {cwd:root});
});
test('normal visibility and install/input guards use the same mode policy, not just the disabled button',()=>{
  const hud=source('src/ui/hud.js'), input=source('src/ui/input.js'), place=source('src/world/towers.js'), help=source('src/ui/help.js');
  for(const code of [hud,input,place,help]) assert.match(code,/import \{[^}]+\} from '[^']+tower-rules\.js'/);
  assert.match(hud,/classList.toggle\('hidden', !towerVisible\('guardian'\)\)/);
  assert.match(input,/if \(G.dungeon \|\| !towerAvailable\(G.tool,G\)\) return false/);
  assert.match(input,/function setTool\(t\) \{ if\(!towerAvailable\(t,G\)\)return false/);
  assert.match(place,/function placeTower\(t, type\) \{\s*if\(!towerAvailable\(type,G\)\)return null/);
  assert.match(help,/k !== '6' \|\| towerVisible\('guardian'\)/);
});
