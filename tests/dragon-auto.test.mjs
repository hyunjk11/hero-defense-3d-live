import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])+path.sep):new URL('../',import.meta.url);
const DG=await import(new URL('src/data/dungeon.js',root)),{rolePlan}=await import(new URL('src/dungeon/logic.js',root));
const {FT,TQ,ftSkillId,isRangedFoe}=await import(new URL('src/data/fighter.js',root));
const {advOf}=await import(new URL('src/data/advance.js',root));
function fixture(branch='dragon',cls='fighter'){
 const source=fs.readFileSync(new URL('src/dungeon/run.js',root),'utf8');
 const h={cls,adv:advOf(cls,branch),g:{position:{x:0,z:0}},dead:0,path:[],skillCd:10},moves=[];
 const G={t:1,heroes:[h],hero:h,enemies:[]},D={over:false,blessing:false,auto:true};
 const env=vm.createContext({...DG,FT,TQ,ftSkillId,isRangedFoe,rolePlan,G,D,Math,confirmOpen:()=>false,skillBusy:()=>false,bossDodge:()=>null,stat:{range:()=>2.6},heroGoTo:p=>{moves.push({...p});h.path=[{...p}];},useAutoSkill:()=>{},castSkill:()=>{},_v:{set(x,y,z){return{x,y,z};}},pos:o=>({x:o.g.position.x,z:o.g.position.z})});
 vm.runInContext(source.slice(source.indexOf('function partyAI('),source.indexOf('// ---------- HUD:'))+';this.tick=partyAI;',env);
 const enemy=(x,z=0,extra={})=>({g:{position:{x,z}},E:{},...extra});
 return {h,G,D,moves,enemy,tick:()=>{h.aiT=0;env.tick(h,.1);}};
}
test('actual partyAI keeps dragon in charged-palm range instead of approaching melee',()=>{
 const f=fixture();f.G.enemies=[f.enemy(8)];f.tick();assert.equal(f.moves.length,0);assert.equal(f.h.path.length,0);
});
test('dragon approaches distant ground and flying targets only to ranged distance',()=>{
 for(const fly of [false,true]){const f=fixture();f.G.enemies=[f.enemy(15,0,{E:{fly}})];f.tick();assert.equal(f.moves.length,1);assert.equal(f.moves[0].x,7.5);}
});
test('dragon retreats from nearby enemies; dead/spawning/immune targets do not retain pursuit',()=>{
 const f=fixture();f.G.enemies=[f.enemy(2)];f.tick();assert.ok(f.moves.at(-1).x<0);
 for(const extra of [{dead:true},{dying:0},{immT:10},{state:'spawn'}]){f.h.path=[{x:8,z:0}];f.G.enemies=[f.enemy(8,0,extra)];f.tick();assert.equal(f.h.path.length,0);assert.equal(f.h.aiTgt,null);}
});
test('base and tiger fighter keep their original melee pursuit',()=>{
 for(const branch of [null,'tiger']){const f=fixture(branch);f.G.enemies=[f.enemy(8)];f.tick();assert.equal(f.moves[0].x,8);}
});
test('dragon without targets follows the living party anchor, while solo stops',()=>{
 const f=fixture();const leader={cls:'warrior',dead:0,g:{position:{x:15,z:0}}};f.G.heroes.push(leader);f.G.hero=leader;f.tick();assert.ok(f.moves[0].x>0);
 f.G.heroes=[f.h];f.G.hero=f.h;f.tick();assert.equal(f.h.path.length,0);
});
test('overlap has an escape direction; a distant tank never pulls dragon toward the near target',()=>{
 for(const x of [0,2]){const f=fixture();f.G.enemies=[f.enemy(x)];f.G.heroes.push({cls:'warrior',dead:0,g:{position:{x:30,z:0}}});f.tick();assert.ok(x===0?Math.abs(f.moves[0].x)>0:f.moves[0].x<0);}
});
