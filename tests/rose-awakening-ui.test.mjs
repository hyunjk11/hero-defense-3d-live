import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as mechanics from '../src/data/awakening.js';
import {totalXP} from '../src/data/hero-growth.js';

test('PC growth menu hides noneligible Rose, offers Lv.0, and toggles the prior E',async()=>{
 const nodes=new Map();
 const node=id=>{
  if(!nodes.has(id)){
   const classes=new Set(id==='awCard'?['hidden']:[]),attrs=new Map();
   nodes.set(id,{firstElementChild:null,classes,attrs,classList:{
    add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),
    toggle(k,on){if(on)classes.add(k);else classes.delete(k);}
   },setAttribute:(k,v)=>attrs.set(k,v),
    set innerHTML(html){this.firstElementChild={};for(const m of html.matchAll(/id="([^"]+)"/g))node(m[1]);}
   });
  }
  return nodes.get(id);
 };
 const save={adv:{gunner:{b:'thorn'}},heroLv:{gunner:{hp:15,atk:15}},souls:5000,mat:{steel:100,crystal:50}};
 const growth={xp:{gunner:totalXP(50)},balance:6000,awakening:{},awakeningSkill:{}};
 const calls=[];let online=true,owned=true;
 const Acc={A:{user:{id:'rose-fixture'}},sessionId:()=>1,load:()=>save,serverSaveState:()=>null};
 const HG={HG:{growth},enabled:()=>online,awakeningEnabled:()=>online,awakeningSkillServer:()=>online,
  awakeningSkill:h=>growth.awakeningSkill[h]!==false,async awaken(h,level){calls.push(['unlock',h,level]);growth.awakening[h]=level;return {ok:true};},
  async setAwakeningSkill(h,on){calls.push(['toggle',h,on]);growth.awakeningSkill[h]=on;return {ok:true};}
 };
 const source=readFileSync(new URL('../src/ui/awakening.js',import.meta.url),'utf8')
   .replace(/^import .*;\s*$/gm,'').replace('export function renderAwakening','function renderAwakening');
 const env=vm.createContext({...mechanics,HG,Acc,heroOwned:h=>owned&&h==='gunner',G:{screen:'town'},document:{getElementById:node}});
 vm.runInContext(source+';this.render=renderAwakening;',env);
 const render=()=>env.render('gunner',save),shown=()=>!node('awCard').classes.has('hidden');
 owned=false;render();assert.equal(shown(),false);
 owned=true;online=false;render();assert.equal(shown(),false);
 online=true;save.adv.gunner.b='duel';render();assert.equal(shown(),false);
 save.adv.gunner.b='thorn';growth.xp.gunner--;render();assert.equal(shown(),false);
 growth.xp.gunner++;save.heroLv.gunner.atk=14;render();assert.equal(shown(),false);
 save.heroLv.gunner.atk=15;render();assert.equal(shown(),true);
 assert.equal(node('awTitle').textContent,'각성');assert.equal(node('awUnlock').disabled,false);
 assert.equal(node('awSkill').classes.has('hidden'),true);
 node('awUnlock').onclick();await new Promise(setImmediate);
 assert.deepEqual(calls,[['unlock','gunner',0]]);
 assert.equal(node('awTitle').textContent,'각성 Lv.0');
 assert.equal(node('awSkill').textContent,'장미 심판');assert.equal(node('awUnlock').classes.has('hidden'),true);
 node('awSkill').onclick();await new Promise(setImmediate);
 assert.equal(node('awSkill').textContent,'기본 스킬');
 node('awSkill').onclick();await new Promise(setImmediate);
 assert.equal(node('awSkill').textContent,'장미 심판');
 assert.deepEqual(calls.slice(1),[['toggle','gunner',false],['toggle','gunner',true]]);
});
