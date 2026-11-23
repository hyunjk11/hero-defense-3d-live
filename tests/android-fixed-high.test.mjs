import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const loopSource = main.slice(main.indexOf('let lastT = performance.now()'), main.indexOf("if (mobileApp) document.addEventListener('visibilitychange'"));
assert.ok(loopSource.includes('composer.render()'));

function probe({ mobile, search = '', stored = 'perf', coarse = mobile, weak = mobile, cadence = false }) {
  const code = `
    const opts = ${JSON.stringify({ mobile, search, stored, coarse, weak, cadence })};
    const url = new URL('https://hyunjk11.github.io/hero-defense-3d-live/?' + opts.search);
    if (opts.mobile) url.searchParams.set('mobileApp', '1');
    globalThis.location = url;
    globalThis.matchMedia = () => ({matches:opts.coarse});
    Object.defineProperty(globalThis, 'navigator', {value:{hardwareConcurrency:opts.weak ? 4 : 8}});
    const writes=[], reads=[];
    const store = new Map([['hd3d_live_gfx',opts.stored],['hd3d_live_gfx_auto','perf']]);
    globalThis.localStorage = {
      getItem(k){reads.push(k);return store.get(k)??null},
      setItem(k,v){writes.push([k,v]);store.set(k,v)},
      removeItem(k){writes.push([k,null]);store.delete(k)}
    };
    const hint={textContent:'소리 · 그래픽 · 배속'}, button={title:'설정 (소리 · 그래픽 · 배속)'};
    const menu={innerHTML:''}, panel={html:'',insertAdjacentHTML(_,html){this.html=html},querySelector(sel){return sel==='.ptitle small'?hint:null}};
    const control={addEventListener(){}}, doc={hidden:false,getElementById(id){return id==='mnSettings'?menu:id==='sndPanel'?panel:id==='sndBtn'?button:control}};
    globalThis.document=doc;
    const {Q}=await import('./src/render/quality.js');
    await import('./src/ui/settings.js');
    const state=()=>({mode:Q.mode,perf:Q.perf,mobilePerf:Q.mobilePerf(),dpr:Q.pixelRatio(3),shadow:Q.shadowSize(),
      rates:['select','town','build','wave','over'].flatMap(phase=>[false,true].map(paused=>Q.renderHz(phase,paused)))});
    const initial=state(); let notifications=0; Q.onChange(()=>notifications++);
    Q.set('perf');
    const afterSet=state();
    for(let i=0;i<240;i++) Q.tick(.05, true);
    const afterTick=state(), renders={};
    if (opts.cadence) {
      for (const refresh of [60,90,120]) {
        let now = 0, draws = 0;
        const run = new Function('performance','document','mobileApp','requestAnimationFrame','Q','G','updLod','heroRange','composer',
          ${JSON.stringify(loopSource)} + ';return loop');
        const cb=run({now:()=>now},doc,opts.mobile,()=>1,Q,{manual:true,phase:'wave'},()=>{}, {update(){}},{render(){draws++}});
        for(let i=0;i<refresh*10;i++){now=i*1000/refresh;cb();}
        renders[refresh]=draws;
      }
    }
    console.log(JSON.stringify({initial,afterSet,afterTick,writes,reads,notifications,renders,
      menu:menu.innerHTML,panel:panel.html,hint:hint.textContent,title:button.title}));
  `;
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{
    cwd:new URL('..',import.meta.url), encoding:'utf8',
  }));
}

test('Android always uses its existing High visual parameters; ignores stored, query, direct and automatic quality changes', () => {
  for (const opts of [
    {stored:'perf',search:'gfx=perf&gfxauto=1'},
    {stored:'auto',search:'gfxauto=1'},
    {stored:'high',search:'gfx=high'},
  ]) {
    const r=probe({mobile:true,...opts});
    assert.deepEqual(r.initial,{mode:'high',perf:false,mobilePerf:false,dpr:1.5,shadow:2048,rates:Array(10).fill(100)});
    assert.deepEqual(r.afterSet,r.initial);
    assert.deepEqual(r.afterTick,r.initial);
    assert.deepEqual(r.reads,[]);
    assert.deepEqual(r.writes,[]);
    assert.equal(r.notifications,0);
  }
});

test('Android quality actions are absent in both panels and other settings remain; PC panels are unchanged', () => {
  const android=probe({mobile:true}), pc=probe({mobile:false});
  for(const [html,control] of [[android.menu,'stBgmOn'],[android.panel,'bgmOn']]){
    assert.match(html,new RegExp(control));
    assert.doesNotMatch(html,/gfxRow|gfxSeg|gfxNow|data-gfx|그래픽/);
  }
  assert.equal(android.hint,'소리 · 배속');
  assert.equal(android.title,'설정 (소리 · 배속)');
  for(const html of [pc.menu,pc.panel]) {
    for(const opt of ['auto','high','perf']) assert.match(html,new RegExp(`data-gfx="${opt}"`));
    assert.match(html,/gfxNow/);
  }
  assert.equal(pc.hint,'소리 · 그래픽 · 배속');
  assert.equal(pc.title,'설정 (소리 · 그래픽 · 배속)');
});

test('Existing scheduler honors 100 draws/sec ceiling above refresh and leaves PC uncapped', () => {
  const android=probe({mobile:true,cadence:true});
  const pc=probe({mobile:false,stored:'high',cadence:true});
  assert.deepEqual(android.renders,{60:600,90:900,120:1000});
  assert.deepEqual(pc.renders,{60:600,90:900,120:1200});
});

test('PC still honors stored and query performance modes and accepts user-set changes', () => {
  const stored=probe({mobile:false});
  assert.equal(stored.initial.mode,'perf');
  assert.equal(stored.initial.perf,true);
  assert.equal(stored.initial.dpr,1.25);
  assert.deepEqual(stored.initial.rates,Array(10).fill(0));
  const high=probe({mobile:false,stored:'high'});
  assert.equal(high.initial.mode,'high');
  assert.equal(high.initial.perf,false);
  assert.equal(high.initial.dpr,1.75);
  assert.equal(high.afterSet.perf,true);
  assert.deepEqual(high.writes,[['hd3d_live_gfx','perf'],['hd3d_live_gfx_auto',null]]);
  const query=probe({mobile:false,stored:'high',search:'gfx=perf'});
  assert.equal(query.initial.mode,'high');
  assert.equal(query.initial.perf,true);
});
