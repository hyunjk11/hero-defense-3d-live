import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {BRANCH,canSpecialize} from '../src/data/growth.js';
test('actual branch renderer keeps focus and sweep options free of targeting explanations',()=>{
 const el={children:[],contains:()=>false,replaceChildren(){this.children=[];},classList:{toggle(){}},append(x){this.children.push(x);}};
 const G={sel:{kind:'tower',type:'guardian',lvl:3,xp:2400}},document={activeElement:null,createElement:()=>({dataset:{},style:{setProperty(){}}})};
 const ctx=vm.createContext({$:()=>el,G,BRANCH,canSpecialize,chooseBranch(){},document});
 vm.runInContext(fs.readFileSync('src/ui/branch.js','utf8').replace(/^import .*;\s*$/gm,'').replaceAll('export ','')+';this.render=renderBranch;',ctx);
 ctx.render(G.sel);assert.equal(el.children.length,2);assert.ok(el.children.every(x=>x.title===undefined));assert.equal(BRANCH.guardian.guardian_bulwark.d,'집중 광선 피해 +20%');
 const first=el.children[0];ctx.render(G.sel);assert.equal(el.children[0],first);
 G.sel={kind:'tower',type:'magic',lvl:3,xp:2400};ctx.render(G.sel);assert.ok(el.children.every(x=>x.title===undefined));
});
test('selected HUD keeps targeting explanations out of tower stats',()=>{
 assert.doesNotMatch(fs.readFileSync('src/ui/hud.js','utf8'),/새 표적:|현재 표적 유지/);
});
