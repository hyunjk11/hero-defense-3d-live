import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {FOCUS_MAX,focusCost,focusMods,buyFocus,initialGrowth} from '../src/data/hero-growth.js';
import {finalStats,sortieC,breakdown} from '../src/data/herostats.js';
import {treeCooldown} from '../src/data/skill-tree.js';
import {VISIBLE_HEROES} from '../src/data/heroes.js';
import * as P from '../src/account/progress.js';
import {packSave} from '../src/account/storage.js';
import {MemoryStore} from '../server/memory-store.mjs';
import {execute} from '../server/operations.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const make=()=>({growthEnabled:true,phase:'build',gold:528,focus:0});

test('five purchases retain first three prices and use the existing rounded 1.5 curve',()=>{
 assert.equal(FOCUS_MAX,5);assert.deepEqual([0,1,2,3,4,5].map(focusCost),[40,60,90,135,203,Infinity]);
 const s=make();for(let i=0;i<5;i++){const gold=s.gold;assert.equal(buyFocus(s),true);assert.equal(s.focus,i+1);assert.equal(gold-s.gold,focusCost(i));}
 assert.equal(s.gold,0);s.gold=1e6;assert.equal(buyFocus(s),false);assert.equal(s.gold,1e6);
});
test('each level rejects one gold short, rejects invalid inputs and does not charge blocked actions',()=>{
 for(let n=0;n<5;n++){const s={...make(),focus:n,gold:focusCost(n)-1},before=structuredClone(s);assert.equal(buyFocus(s),false);assert.deepEqual(s,before);s.gold++;assert.equal(buyFocus(s),true);assert.equal(s.gold,0);}
 for(const values of [{focus:-1},{focus:1.5},{focus:NaN},{focus:Infinity},{focus:'2'},{focus:5},{focus:6},{gold:NaN},{gold:Infinity},{gold:'528'},{paused:true},{navigating:true},{growthEnabled:false},{dungeon:{}},...['town','over','select','loading'].map(phase=>({phase}))]){
  const s={...make(),...values},before=structuredClone(s);assert.equal(buyFocus(s),false,JSON.stringify(values));assert.deepEqual(s,before);
 }
});
test('no HP, current cooldown, death/revival, status or companion mutation at levels four and five',()=>{
 const heroes=[{hp:17,max:200,skillCd:8,lcd:11,dead:3,stunT:2,hardHold:true},{hp:80,max:300,skillCd:5,lcd:9,dead:0,slowT:2,hardHold:false}];
 const s={...make(),phase:'wave',focus:3,gold:338,heroes},before=structuredClone(heroes);
 assert.ok(buyFocus(s));assert.ok(buyFocus(s));assert.deepEqual(heroes,before);assert.equal(s.gold,0);
});
test('actual hero stat and withHero contexts share one focus purchase; attack snapshots stay frozen',()=>{
 const code=fs.readFileSync(new URL('../src/heroes/hero.js',import.meta.url),'utf8');
 const G={...make(),ups:{},t:0},c=vm.createContext({G,focusMods,treeCooldown,Math,heroHud(){},advAtkMul:()=>1,basicTreeMul:()=>1});
 vm.runInContext(code.slice(code.indexOf('let hero = null;'),code.indexOf('function spawnHero(')),c);
 const actors=VISIBLE_HEROES.map(cls=>({C:sortieC(cls,{level:20}),eq:null,treeMods:{},hp:12,skillCd:7,lcd:9,dead:0}));
 c.actors=actors;
 const sample=()=>vm.runInContext('actors.map(h=>withHero(h,()=>({dmg:stat.dmg(),rate:stat.rate(),skill:stat.skillMul(),cd:stat.skillCd(),range:stat.range()})))',c);
 const base=sample();for(let n=1;n<=5;n++){assert.ok(buyFocus(G));for(const [i,a] of sample().entries()){near(a.dmg/base[i].dmg,1+.04*n);near(a.rate/base[i].rate,1+.02*n);near(a.skill/base[i].skill,1+.04*n);near(a.cd/base[i].cd,.98**n);near(a.range,base[i].range);}}
 near(vm.runInContext('withHero(actors[0],()=>stat.skillMul(3))',c)/base[0].skill,1.12);
 near(vm.runInContext('withHero(actors[0],()=>stat.dmg(3))',c)/base[0].dmg,1.12);
 assert.equal(G.gold,0);assert.equal(G.curHero,null);assert.ok(actors.every(h=>h.hp===12&&h.skillCd===7&&h.lcd===9));
});
test('all visible heroes show /5 and live stats match the focus curve without HP/range changes',()=>{
 for(const cls of VISIBLE_HEROES){const L={level:30,perm:{hp:3,atk:3},eq:{atk:20,hp:10,skill:12,cdr:5}},C=sortieC(cls,L);const base=finalStats(C,L.eq,{growthEnabled:true,focus:0});
  for(const n of [3,4,5]){const f=finalStats(C,L.eq,{growthEnabled:true,focus:n});near(f.dmg/base.dmg,1+.04*n);near(f.rate/base.rate,1+.02*n);near(f.skillMul/base.skillMul,1+.04*n);near(f.cd/base.cd,.98**n);near(f.hp,base.hp);near(f.range,base.range);assert.ok(breakdown(cls,L,{growthEnabled:true,focus:n}).rows.some(r=>r.parts.some(p=>p[0]===`전투 집중 ${n}/5`)));}}
 assert.deepEqual(focusMods(999),focusMods(5));assert.deepEqual(focusMods(-1),focusMods(0));
});
test('actual HUD updater exposes fourth/fifth price, MAX and dungeon/navigation guards',()=>{
 const src=fs.readFileSync(new URL('../src/ui/hud.js',import.meta.url),'utf8');
 const node={dataset:{up:'focus'},classList:{toggle(_k,v){node.hidden=v;}}};
 const G=make(),c=vm.createContext({G,FOCUS_MAX,upCost:()=>focusCost(G.focus),document:{querySelectorAll:()=>[node]}});
 const source=src.slice(src.indexOf("  document.querySelectorAll('.up')"),src.indexOf("  document.querySelectorAll('.tool')"));
 for(const [focus,text] of [[3,'전투 집중 3/5 · 135G'],[4,'전투 집중 4/5 · 203G'],[5,'전투 집중 5/5 · MAX']]){G.focus=focus;vm.runInContext(source,c);assert.equal(node.textContent,text);assert.equal(node.disabled,focus===5);}
 G.focus=4;G.navigating=true;vm.runInContext(source,c);assert.equal(node.disabled,true);G.navigating=false;G.dungeon={};vm.runInContext(source,c);assert.equal(node.hidden,true);
});
test('battle focus stays transient; old saves preserve existing assets and next departure resets to zero',()=>{
 const old={...P.empty(),souls:321,heroLv:{...P.empty().heroLv,mage:{hp:3,atk:2}},focus:5};const clean=P.clean(old);
 assert.equal(clean.souls,321);assert.equal(clean.heroLv.mage.hp,3);assert.ok(!Object.hasOwn(packSave(clean),'focus'));assert.deepEqual(P.clean(clean),clean);
 for(const file of ['../src/ui/flow.js','../src/dungeon/run.js'])assert.match(fs.readFileSync(new URL(file,import.meta.url),'utf8'),/G\.focus = 0/);
});
test('server settlement ignores client focus/price fields and retries grant existing XP only once',async()=>{
 const now=1800000000000,user={id:'focus-five-test',email:'focus@example.invalid'},save=P.empty(),store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,updated_at:new Date(now).toISOString()}]});
 const rpc=(name,args,t=now)=>store.transaction(tx=>execute(tx,user,{kind:'rpc',name:'hd3d_growth_'+name,args},{now:t})).then(r=>r.data);
 const start=await rpc('start',{p_id:'focus-five-run',p_mode:'campaign',p_stage:'1-1',p_hero:'mage',p_focus:999,p_gold:1e9});assert.ok(start.ok);
 const args={p_token:'focus-five-run',p_completed:1,p_win:false,p_finish:true,p_focus:999,p_xp:1e9,p_gold:1e9};
 const a=await rpc('progress',args,now+10000),b=await rpc('progress',args,now+11000);assert.equal(a.xp,10);assert.equal(b.xp,10);assert.equal(b.already,true);assert.equal(b.growth.earned,10);
 const run=store.tables.hd3d_growth_runs[0];assert.ok(!Object.hasOwn(run,'focus'));assert.ok(!Object.hasOwn(run,'gold'));assert.ok(!Object.hasOwn(b.growth,'focus'));
});
