import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { REPAIR_K } from '../src/data/towers.js';
const tower=fs.readFileSync(new URL('../src/world/towers.js',import.meta.url),'utf8'),input=fs.readFileSync(new URL('../src/ui/input.js',import.meta.url),'utf8'),hud=fs.readFileSync(new URL('../src/ui/hud.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fixture(){
 const G={gold:100,stats:{},towers:[],phase:'build',paused:false,navigating:false,dungeon:false,sel:null},b={classList:{toggle(){}},querySelector:()=>b.small,small:{},setAttribute(k,v){this[k]=v;}},events={};
 const c=vm.createContext({G,REPAIR_K,THREE:{Vector3:class{}},P:{},emit(){},ringFx(){},dmgText(){},Snd:{play(){}},banner(){},$:(id)=>{assert.equal(id,'repairAllBtn');return b;},typing:e=>!!e.typing,releaseKeys:new Set(),keys:{},addEventListener:(name,f)=>events[name]=f});
 const refresh=hud.slice(hud.indexOf("  const allRepair = $('repairAllBtn');"),hud.indexOf('  const s = G.sel;'));
 vm.runInContext('function refreshHud(){'+refresh+'}\n'+tower.slice(tower.indexOf('const repairCost ='),tower.indexOf('function enemyAim(')),c);
 vm.runInContext(input.split('\n').find(l=>l.startsWith("$('repairAllBtn').onclick")),c);
 vm.runInContext(input.split('\n').find(l=>l.startsWith("addEventListener('keydown', e => { if (G.paused")),c);
 const make=(hp,max=100,invest=60)=>({hp,max,invest,hb:{set(){}},anchor:{position:{x:0,z:0}},kind:'tower'});
 const refreshUI=()=>vm.runInContext('refreshHud()',c);
 return{G,b,c,make,refreshUI,key:(k,extra={})=>events.keydown({key:k,repeat:false,...extra})};
}
test('click always repairs all damaged towers even when a different tower is selected; full towers and barricades untouched',()=>{
 const f=fixture(),a=f.make(50),b=f.make(80),healthy=f.make(100),bar={hp:50,max:100,kind:'bar'};f.G.towers=[a,b,healthy];f.G.sel=a;
 f.refreshUI();assert.equal(f.b.disabled,false);assert.equal(f.b.title,'모두 수리 · 20G');f.b.onclick();assert.deepEqual([a.hp,b.hp,healthy.hp,bar.hp],[100,100,100,50]);assert.equal(f.G.gold,80);assert.equal(f.G.stats.repairSpent,20);f.b.onclick();assert.equal(f.G.gold,80);assert.equal(f.b.disabled,true);
});
test('keyboard R preserves selected repair versus unselected repairAll, ignores repeats and typing',()=>{
 const f=fixture(),a=f.make(50),b=f.make(50);f.G.towers=[a,b];f.G.sel=a;f.key('R');assert.deepEqual([a.hp,b.hp],[100,50]);assert.equal(f.G.gold,86);
 f.key('r',{repeat:true});f.key('r',{typing:true});assert.equal(b.hp,50);f.G.sel=null;f.key('r');assert.equal(b.hp,100);assert.equal(f.G.gold,72);
});
test('partial affordability keeps old critical-first order and charges only successful repairs',()=>{
 const f=fixture(),critical=f.make(10),cheap=f.make(80),healthy=f.make(100);f.G.towers=[cheap,critical,healthy];f.G.gold=25;f.refreshUI();assert.equal(f.b.disabled,false);f.b.onclick();assert.deepEqual([critical.hp,cheap.hp],[100,80]);assert.equal(f.G.gold,0);assert.equal(f.G.stats.repairSpent,25);
 const g=fixture(),expensive=g.make(10),affordable=g.make(80);g.G.towers=[expensive,affordable];g.G.gold=6;g.refreshUI();assert.equal(g.b.disabled,false);g.b.onclick();assert.deepEqual([expensive.hp,affordable.hp],[10,100]);assert.equal(g.G.gold,0);
});
test('button blocks paused, navigating, dungeon and non-battle calls; no new spend on double activation',()=>{
 for(const state of [{paused:true},{navigating:true},{dungeon:true},{phase:'town'},{phase:'over'}]){
  const f=fixture(),t=f.make(50);f.G.towers=[t];Object.assign(f.G,state);f.b.onclick();assert.equal(t.hp,50);assert.equal(f.G.gold,100);
 }
 const f=fixture();f.refreshUI();assert.equal(f.b.disabled,true);assert.equal(f.b.title,'모두 수리');f.G.towers=[f.make(50)];f.G.gold=1;f.refreshUI();assert.equal(f.b.disabled,true);
});
test('repair control stays immediately before C; existing start/return and all six tools remain single accessible controls',()=>{
 assert.match(html, /id="repairAllBtn"[^>]*[\s\S]*?<\/button><button id="statBtn"/);
 for(const id of ['startWave','retreat','repairAllBtn','statBtn'])assert.equal(html.split('id="'+id+'"').length-1,1);
 for(const tool of ['arrow','cannon','magic','barricade','clear','move'])assert.equal(html.split('data-tool="'+tool+'"').length-1,1);
 assert.doesNotMatch(html,/<details id="buildTools"/);
 assert.match(html,/<div id="ups" class="panel">/);
 assert.match(html,/<details id="wavePrev"/);
 assert.doesNotMatch(html,/<span>모두 수리<\/span>/);
});
