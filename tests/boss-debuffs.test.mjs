import assert from 'node:assert/strict';
import {bossDebuffs, renderBossDebuffs} from '../src/ui/boss-debuffs.js';
const boss = extra => ({E:{boss:true}, ...extra});
const ids = e => bossDebuffs(e).map(x=>x.id);
assert.doesNotThrow(()=>renderBossDebuffs(null,boss({slowT:1})));
assert.deepEqual(ids(null),[]);
assert.deepEqual(ids({E:{boss:false},slowT:4}),[]);
for(const extra of [{dead:true},{dying:0},{dying:1}])assert.deepEqual(ids(boss({...extra,slowT:2,stunT:1})),[]);
assert.deepEqual(ids(boss({slowT:0,slowAmt:.7,stunT:0,frozen:true,kup:{t:0,dur:1}})),[]);
assert.deepEqual(bossDebuffs(boss({slowT:1.25,slowAmt:.7})),[{id:'slow',name:'둔화',time:1.25,detail:'70%'}]);
assert.equal(bossDebuffs(boss({slowT:1,slowAmt:0}))[0].detail,'45%');
assert.deepEqual(ids(boss({slowT:-1,stunT:NaN})),[]);
assert.deepEqual(ids(boss({stunT:.3,frozen:true})),['freeze']);
assert.deepEqual(ids(boss({stunT:.3,frozen:false})),['stun']);
const mixed=boss({stunT:1,frozen:true,kup:{t:.2,dur:.5},slowT:2,slowAmt:.4});
assert.deepEqual(ids(mixed),['freeze','airborne','slow']);
assert.equal(bossDebuffs(mixed)[1].time,.3);
mixed.kup.t=.5;assert.deepEqual(ids(mixed),['freeze','slow']);
mixed.frozen=false;assert.deepEqual(ids(mixed),['stun','slow']);
mixed.E.fly=true;mixed.kup.t=0;assert.deepEqual(ids(mixed),['stun','slow']);
const crack=boss({E:{boss:true,ab:{crack:{armor:.5,after:.1,regen:14}}},cracked:true,armor:.1,regenT:7});
assert.deepEqual(ids(crack),['crack']);assert.equal(bossDebuffs(crack)[0].time,7);
crack.cracked=false;assert.deepEqual(ids(crack),[]);
crack.cracked=true;crack.armor=.5;assert.deepEqual(ids(crack),[]);
crack.armor=.1;crack.E.ab.crack.regen=0;assert.equal(bossDebuffs(crack)[0].time,null);
assert.deepEqual(ids(boss({guardOpenT:2})),[]);
assert.deepEqual(ids(boss({E:{boss:true,shieldDef:{}},guardOpenT:2})),['exposed']);
for(const [family,timer,awakened] of [['storm','stormRecover','stormAwakened'],['machine','machineRecover','machineAwakened'],['endgame','endRecover','endAwakened']]){
 const e=boss({E:{boss:true,armor:.4,[family]:{exposed:2,openArmor:.03,phase:{armor:.25}}},armor:.03,[timer]:1.5});
 assert.deepEqual(ids(e),['vulnerable']);assert.equal(bossDebuffs(e)[0].time,1.5);
 e[timer]=0;assert.deepEqual(ids(e),[]);e[timer]=2;e.armor=.4;assert.deepEqual(ids(e),[]);
 e[awakened]=true;e.armor=.03;assert.deepEqual(ids(e),['vulnerable']);e.armor=.25;assert.deepEqual(ids(e),[]);
}
const ruptured=boss({E:{boss:true,armor:.4,swamp:{rupture:{armor:.05}}},swampRuptured:true,armor:.05});
assert.deepEqual(ids(ruptured),['rupture']);assert.equal(bossDebuffs(ruptured)[0].time,null);
ruptured.armor=.4;assert.deepEqual(ids(ruptured),[]);ruptured.armor=.05;ruptured.swampRuptured=false;assert.deepEqual(ids(ruptured),[]);
const unchanged=JSON.stringify(mixed);for(let i=0;i<60;i++)bossDebuffs(mixed);assert.equal(JSON.stringify(mixed),unchanged);

// Small DOM fixture: exercise keyed identity, expiry, replacement and avoiding per-frame rewrites.
class Node {
 constructor(){this.children=[];this.dataset={};this._text='';this.writes=0;this.hidden=false;this.ownerDocument={createElement:()=>new Node()};}
 set textContent(value){this._text=value;this.writes++;}get textContent(){return this._text;}
 replaceChildren(){for(const n of this.children)n.parent=null;this.children=[];}
 insertBefore(node,next){node.remove();const i=next?this.children.indexOf(next):this.children.length;this.children.splice(i,0,node);node.parent=this;}
 remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
}
const el=new Node(),a=boss({slowT:1.28,slowAmt:.4,stunT:.29,frozen:true});
renderBossDebuffs(el,a);assert.equal(el.hidden,false);assert.deepEqual(el.children.map(n=>n.textContent),['빙결 0.3초','둔화 40% 1.3초']);
const slow=el.children[1],frozen=el.children[0];renderBossDebuffs(el,a);assert.equal(slow.writes,1);assert.equal(el.children[0],frozen);
a.slowT=3;renderBossDebuffs(el,a);assert.equal(el.children[1],slow);assert.equal(slow.textContent,'둔화 40% 3.0초');
a.stunT=0;renderBossDebuffs(el,a);assert.equal(el.children.length,1);assert.equal(el.children[0],slow);
a.slowT=0;renderBossDebuffs(el,a);assert.equal(el.hidden,true);assert.equal(el.children.length,0);
a.stunT=.3;a.frozen=false;renderBossDebuffs(el,a);assert.equal(el.children[0].textContent,'기절 0.3초');
a.stunT=1e-10;renderBossDebuffs(el,a);assert.equal(el.children[0].textContent,'기절 0.1초');
const previous=el.children[0];const b=boss({stunT:.3});renderBossDebuffs(el,b);assert.notEqual(el.children[0],previous);
b.dead=true;renderBossDebuffs(el,b);assert.equal(el.hidden,true);assert.equal(el.children.length,0);
renderBossDebuffs(el,null);assert.equal(el.children.length,0);
console.log('PASS boss debuff state/expiry/refresh/overlap/death/replacement, immutable projection and stable DOM');
