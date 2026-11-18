import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { TOWERS } from '../src/data/towers.js';
import * as G from '../src/data/growth.js';
import * as P from '../src/account/progress.js';
import { applyTown } from '../src/account/direct-town.js';
const baseline=execFileSync('git',['show','d5271fb:src/data/towers.js'],{encoding:'utf8'});
const old=await import('data:text/javascript;base64,'+Buffer.from(baseline).toString('base64'));
for(const type of ['arrow','cannon','magic'])assert.deepEqual(TOWERS[type],old.TOWERS[type]);
for(const key of ['cost','up','hp'])assert.deepEqual(TOWERS.guardian[key],old.TOWERS.guardian[key]);
const currentGrowth=fs.readFileSync('src/data/growth.js','utf8').replaceAll('\r','');
const oldGrowth=execFileSync('git',['show','d5271fb:src/data/growth.js'],{encoding:'utf8'}).replaceAll('\r','');
// Research prices/caps/formula and XP progression are identical to deployed baseline.
const research=s=>s.slice(s.indexOf('export const RES ='),s.indexOf('export function branchFor'));
assert.equal(research(currentGrowth),research(oldGrowth));
assert.equal(currentGrowth.slice(0,currentGrowth.indexOf('export const BRANCH')),oldGrowth.slice(0,oldGrowth.indexOf('export const BRANCH')));
const save=P.empty();save.souls=1e8;save.mat.steel=1e6;save.mat.crystal=1e6;
for(const [i,type] of G.TTYPES.entries())save.research[type]={atk:i+2,rng:i,spd:i+1,efficiency:1};
const original=structuredClone(save);assert.deepEqual(P.clean(save).research,save.research);
for(const type of G.TTYPES)for(const key of G.RKEYS){
 const input=structuredClone(save);if(key==='efficiency')input.research[type]={atk:5,rng:3,spd:5,efficiency:1};
 const before=structuredClone(input),level=input.research[type][key],cost=G.resCost(key,level);
 const {save:result,result:purchase}=applyTown(input,{action:'research',type,stat:key});
 assert.equal(purchase.ok,true);assert.equal(result.research[type][key],level+1);
 assert.equal(result.souls,input.souls-cost.souls);assert.equal(result.mat[G.RES[key].mat],input.mat[G.RES[key].mat]-cost[G.RES[key].mat]);
 for(const other of G.TTYPES)if(other!==type)assert.deepEqual(result.research[other],input.research[other]);
 assert.deepEqual(input,before);
}
assert.deepEqual(save,original);
assert.deepEqual(TOWERS.guardian.rate,[4,4,4,4,4]);assert.equal(TOWERS.guardian.beam,true);
for(let lvl=1;lvl<=5;lvl++){
 const normal=G.towerStats('guardian',lvl),focus=G.towerStats('guardian',lvl,'guardian_bulwark'),sweep=G.towerStats('guardian',lvl,'guardian_assault');
 assert.equal(focus.dmg,normal.dmg*1.2);assert.equal(sweep.dmg,normal.dmg*2);
 assert.equal(normal.rate,focus.rate);assert.equal(normal.rate,sweep.rate);
}
console.log('PASS beam data: original three towers, all research, purchase costs and XP unchanged');
