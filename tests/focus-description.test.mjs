import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {BRANCH,canSpecialize} from '../src/data/growth.js';
test('actual branch renderer exposes focus description as native title only on focus',()=>{
 const el={children:[],contains:()=>false,replaceChildren(){this.children=[];},classList:{toggle(){}},append(x){this.children.push(x);}};
 const G={sel:{kind:'tower',type:'guardian',lvl:3,xp:2400}},document={activeElement:null,createElement:()=>({dataset:{},style:{setProperty(){}}})};
 const ctx=vm.createContext({$:()=>el,G,BRANCH,canSpecialize,chooseBranch(){},document});
 vm.runInContext(fs.readFileSync('src/ui/branch.js','utf8').replace(/^import .*;\s*$/gm,'').replaceAll('export ','')+';this.render=renderBranch;',ctx);
 ctx.render(G.sel);assert.equal(el.children.length,2);assert.equal(el.children[0].title,BRANCH.guardian.guardian_bulwark.d);assert.match(el.children[0].title,/보스 우선.*현재 체력 높은 순.*목표 유지/);assert.equal(el.children[1].title,undefined);
 const first=el.children[0];ctx.render(G.sel);assert.equal(el.children[0],first);
 G.sel={kind:'tower',type:'magic',lvl:3,xp:2400};ctx.render(G.sel);assert.ok(el.children.every(x=>x.title===undefined));
});
test('selected HUD adds compact visible rule only for focus',()=>{
 const line=fs.readFileSync('src/ui/hud.js','utf8').split('\n').find(s=>s.includes('새 표적: 보스 우선'));
 assert.ok(line);for(const B of [null,{beamSweep:true},{beamFocus:true}]){const el={innerHTML:'stats'},ctx=vm.createContext({s:{B},$:()=>el});vm.runInContext(line,ctx);assert.equal(el.innerHTML,B?.beamFocus?'stats<br>새 표적: 보스 우선 · 현재 표적 유지':'stats');}
});
