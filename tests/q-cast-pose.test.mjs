import fs from 'node:fs';import assert from 'node:assert/strict';import test from 'node:test';import {execFileSync} from 'node:child_process';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const repo=new URL('../',import.meta.url);const read=(file,ref)=>ref?execFileSync('git',['show',ref+':'+file],{cwd:repo,encoding:'utf8'}):fs.readFileSync(new URL(file,repo),'utf8');
function run(cls,mode,ref){
 const source=read('src/heroes/hero.js',ref);const update=source.slice(source.indexOf('function updHero(dt)'),source.indexOf('function updParty('));
 let rng=0;const log=[],timers=[],hits=[],no=()=>{},h={cls,g:new THREE.Group(),ch:{acts:{},mixer:{update:no},ring:{material:{}},mats:[]},C:{speed:2,atk:'BASIC_ATTACK',atkSpd:1,rate:1},treeMods:{},hp:100,max:100,cd:0,atkT:0,skillCd:0,dead:0,face:0,path:[],spinT:0,hb:{set:no}},e={g:new THREE.Group(),E:{},dead:false};e.g.position.z=2;
 const G={hero:h,curHero:h,heroes:[h],phase:'wave',t:1,enemies:mode==='idle-target'?[e]:[],projs:[],tiles:[]};
 const env=vm.createContext({THREE,G,hero:h,MELEE_ONLY:{warrior:1,fighter:1},qFeedback:no,skillAllowed:()=>true,treeQBonus:()=>1,treeSkillUsed:no,asSkill:(f,...a)=>f(...a),stat:{dmg:()=>100,skillMul:()=>1,skillCd:()=>10,range:()=>10,rate:()=>1},mouseGround:new THREE.Vector3(0,0,5),scene:new THREE.Scene(),makeArrow:()=>new THREE.Group(),glow:c=>new THREE.MeshBasicMaterial({color:c}),ringFx:no,banner:no,play:(_ch,n,o)=>log.push({n,force:!!o?.force}),Snd:{play:no,whoosh:no},rand:()=>{rng++;return .5},attack:t=>hits.push(t===e),later:(t,f)=>timers.push({t,f}),movementAllowed:()=>true,cam:{theta:0},keys:mode==='moving-no-target'?{d:true}:{},passAt:()=>true,groundY:()=>0,flashMats:no});
 vm.runInContext(strip(read('src/heroes/skills.js',ref))+';this.cast=castSkill;',env);vm.runInContext((source.match(/const practiceRest = [^\n]+/)?.[0]||'')+'\n'+update+';this.update=updHero;',env);return {env,h,G,log,timers,hits,get rng(){return rng}};
}
for(const cls of ['mage','archer'])for(const mode of ['idle-target','moving-no-target'])test(`${cls} ${mode}: Q pose and combat equivalence`,()=>{
 const old=run(cls,mode,'74ad402'),now=run(cls,mode);for(const r of [old,now]){r.env.cast(new THREE.Vector3(0,0,5));r.env.update(1/60);}
 assert.equal(now.log.length,1);assert.equal(old.log.length,2);assert.ok(now.h.qPoseT>0);
 assert.equal(now.h.cd,old.h.cd);assert.equal(now.h.atkT,old.h.atkT);assert.deepEqual(now.h.g.position.toArray(),old.h.g.position.toArray());
 assert.deepEqual(now.timers.map(x=>x.t),old.timers.map(x=>x.t));
 for(const r of [old,now])for(const t of r.timers)t.f();
 assert.deepEqual(now.hits,old.hits);assert.equal(now.rng,old.rng);
 assert.deepEqual(now.G.projs.map(p=>({kind:p.kind,dmg:p.dmg,spd:p.spd,dest:p.dest?.toArray()})),old.G.projs.map(p=>({kind:p.kind,dmg:p.dmg,spd:p.spd,dest:p.dest?.toArray()})));
 const hold=now.h.qPoseT;now.env.cast(new THREE.Vector3(0,0,5));assert.equal(now.h.qPoseT,hold);
});
for(const key of ['expired','dead','warp','E','map','town','over'])test(`Q visual hold clears: ${key}`,()=>{
 const r=run('mage','moving-no-target');r.env.cast(new THREE.Vector3(0,0,5));
 if(key==='expired')r.h.qPoseT=.001;if(key==='dead')r.h.dead=10;if(key==='warp')r.h.warpT=1;if(key==='E')r.h.eCastT=.5;if(key==='map')r.G.tiles=[];if(key==='town')r.G.screen='town';if(key==='over')r.G.phase='over';
 // Death/warp engine may need unrelated fixture globals after the reset; inspect reset independently there.
 if(key==='warp'){const source=read('src/heroes/hero.js');const start=source.indexOf('  h.qPoseT=');vm.runInContext(source.slice(start,source.indexOf('\n',start)).replace(/\bh\b/g,'hero'),r.env);}else r.env.update(1/60);
 assert.equal(r.h.qPoseT,0);if(key==='expired')assert.equal(r.log.at(-1).n,'Running_A');
});
