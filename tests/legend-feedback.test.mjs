import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './support/advance-e-runtime.mjs';
import {LSK} from '../src/account/equip.js';
const cases=[['archer','pierce'],['mage','meteorstorm'],['warrior','quake'],['gunner','rosebarrage'],['fighter','tigerdash']];
for(const [h,key] of cases)test(key+': actual proc owns a brief signature; cooldown prevents duplicate cues/sounds',()=>{
 const f=fixture(h,null),sounds=[];let stopped=0;f.hero.lsk=key;f.env.Snd.skill=k=>{sounds.push(k);return ()=>stopped++;};
 const t=f.target(0,2);f.target(1,2);f.api.legendProc(t,{mode:'melee'});assert.equal(f.G.legendN[key],1);assert.equal(f.hero.licd,LSK[key].icd);assert.ok(f.legendCues.active()>0);
 const active=f.legendCues.active();f.api.legendProc(t,{mode:'melee'});assert.equal(f.legendCues.active(),active);assert.deepEqual(sounds,['legend_'+key]);f.tick(.5);assert.equal(f.legendCues.active(),0);assert.equal(stopped,1);assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);
});
test('cancelled presentation clears on death/warp/town/map/owner change and never adds damage',()=>{
 for(const mode of ['death','warp','town','map','owner']){const f=fixture('mage',null);f.hero.lsk='meteorstorm';const t=f.target();f.api.legendProc(t);const hits=f.hits.length;
 if(mode==='death')f.hero.dead=1;if(mode==='warp')f.hero.warpT=1;if(mode==='town')f.G.screen='town';if(mode==='map')f.G.tiles=[];if(mode==='owner'){f.G.hero=null;f.G.heroes=[];}
 f.tick(.05);assert.equal(f.legendCues.active(),0);assert.equal(f.hits.length,hits);assert.equal(f.FX.length,0);
 }
});
test('ground-only misses and dead targets produce no signature; pool stays bounded for forced overlaps',()=>{
 const f=fixture('warrior',null);f.hero.lsk='quake';const air=f.target(0,2,{fly:true});f.api.legendProc(air);assert.equal(f.legendCues.active(),0);air.dead=true;f.api.legendProc(air);assert.equal(f.legendCues.active(),0);
 const g=fixture('mage',null);g.hero.lsk='meteorstorm';const t=g.target();t.hp=1e9;
 for(let i=0;i<50;i++){g.hero.licd=0;g.api.legendProc(t);assert.ok(g.legendCues.active()<=16);}g.tick(1);assert.equal(g.legendCues.active(),0);assert.equal(g.FX.length,0);
});
