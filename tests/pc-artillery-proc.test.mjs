import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/advance-e-runtime.mjs';
import { ARTILLERY, equipProc } from '../src/data/gear-proc-pc.js';
import { LSK, legendKey } from '../src/account/equip.js';

test('stored Rose gear keeps its key, maps to the new PC proc, and leaves the legacy definition intact', () => {
  assert.equal(legendKey({id:'old-legend',s:'weapon',g:4,h:'gunner',u:'ricochet'}),'ricochet');
  assert.equal(equipProc('ricochet'),ARTILLERY);
  assert.equal(ARTILLERY.n,'포격 요청');
  assert.equal(ARTILLERY.chance,LSK.ricochet.chance);
  assert.equal(ARTILLERY.icd,LSK.ricochet.icd);
  assert.equal(LSK.ricochet.n,'도탄 난사');
  assert.equal(equipProc('rosebarrage'),LSK.rosebarrage);
});
test('real proc locks the ground at cast; after delay damages at most four closest eligible enemies once',()=>{
  const f=fixture('gunner',null), {G}=f, events=[];
  f.hero.lsk='ricochet';G.wave=2;
  f.artilleryFx.mark=(...a)=>events.push(['mark',...a]);f.artilleryFx.strike=(...a)=>events.push(['strike',...a]);
  const t=f.target(0,0);f.target(1,0);f.target(1.5,0,{fly:true});f.target(-2,0);f.target(2.2,0);
  f.target(3.2,0);f.target(.1,0).dead=true;f.target(.2,0).immT=10;
  f.api.legendProc(t);assert.deepEqual(events,[['mark',0,0,ARTILLERY.delay,ARTILLERY.radius]]);
  assert.equal(f.rows[0].textContent,'포격 요청!');
  t.g.position.x=5;f.api.legendProc(t);assert.equal(events.length,1);
  f.tick(.4);assert.equal(f.hits.length,0);
  f.tick(.16);assert.equal(events[1][0],'strike');
  assert.deepEqual(f.hits.map(o=>[o.target,o.loss]),[[1,70],[2,70],[3,70],[4,70]]);
  f.tick(1);assert.equal(f.hits.length,4);
});
test('late artillery neither hits another wave/map nor fires after leaving the battle',()=>{
  for(const kind of ['map','wave','result']){
    const f=fixture('gunner');f.hero.lsk='ricochet';f.G.wave=3;let cancel=0;
    f.artilleryFx.mark=()=>()=>cancel++;f.artilleryFx.strike=()=>assert.fail('stale artillery');
    f.api.legendProc(f.target());
    if(kind==='map')f.G.tiles=[];if(kind==='wave')f.G.wave++;if(kind==='result')f.G.phase='over';
    f.tick(.6);assert.equal(cancel,1);assert.equal(f.hits.length,0);
  }
});
