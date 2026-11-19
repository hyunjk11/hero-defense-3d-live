import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {towerAvailable} from '../src/data/towers.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('guardian unlocks for wave five preparation and wave five combat, independent of gold',()=>{
 for(const phase of ['build','wave','over','menu'])for(let wave=0;wave<=7;wave++){
  assert.equal(towerAvailable('guardian',{phase,wave}),phase==='build'?wave>=4:phase==='wave'&&wave>=5);
  assert.equal(towerAvailable('arrow',{phase,wave}),true);
 }
 assert.equal(towerAvailable('guardian',{phase:'wave',wave:10,dungeon:true}),false);
});
test('public build helper never places a previously selected tower when laser is locked',()=>{
 const main=read('src/main.js').split('\n').find(s=>s.startsWith('G.build ='));
 const guard=read('src/ui/input.js').match(/function setTool\(t\) \{ (if\(!towerAvailable\(t,G\)\)return false;)/)[1];
 const G={tool:'arrow',wave:4,phase:'wave',gold:200},ctx=vm.createContext({G,towerAvailable,build(){G.gold-=60;return true;}});
 vm.runInContext('function setTool(t){'+guard+'G.tool=t;}'+main,ctx);
 assert.equal(G.build(2,3,'guardian'),false);assert.equal(G.gold,200);assert.equal(G.tool,'arrow');
});
