import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as P from '../src/account/progress.js';import * as E from '../src/account/equip.js';import * as ST from '../src/data/stages.js';
import {targetLabel} from '../src/data/repeat-target.js';import {seeded} from '../src/account/rewarditems.js';
import * as H from '../src/data/hero-growth.js';import {MemoryStore} from '../server/memory-store.mjs';import {execute} from '../server/operations.mjs';
function capacity(n){const s=P.empty();s.st={'1-1':3,'10-6':3};for(let i=0;i<n;i++){const it=E.makeItem('armor','mage',0,seeded('old'+i),1);it.id='old-capacity-'+i;E.addChests(s,[{it,src:'chest'}]);}return s;}
function render(save,hard=false){
 const source=fs.readFileSync(process.argv[2]||new URL('../src/ui/result.js',import.meta.url),'utf8').replace(/^import .*;[^\r\n]*\r?\n/gm,'').replace(/\bexport /g,'');
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{remove(){}}});return nodes.get(id);};
 let current=structuredClone(save),writes=0,loot=[];const callbacks=[];const G={xpRun:{repeat:true,target:'gunner',token:'cap-run-001'},growthEnabled:true,completedWaves:10,wave:10,coreHp:30,coreMax:30,stats:{kills:{mage:11}},hero:{cls:'mage'}};
 const Acc={load:()=>structuredClone(current),update:fn=>{writes++;current=fn(current);},flush:()=>Promise.resolve(true)};
 const HG={HG:{rewardXP:{},hardRewards:{}},checkpoint:()=>Promise.resolve(true),onGrowth:fn=>callbacks.push(fn)};
 const progress={...P,applyRun:(s,args)=>{const r=P.applyRun(s,args,seeded('capacity-normal'));loot=r[2];return r;},applyStage:(...args)=>{const r=P.applyStage(...args);loot=[...loot,...(r[1]?.loot||[])];return r;}};
 new Function('directGearEnabled','targetLabel','Snd','$','go','G','HG','Acc','P','E','ST','STAGE','sessionStorage','setTimeout','document',source)(()=>false,targetLabel,{play(){},setMusic(){}},$,()=>{},G,HG,Acc,progress,E,ST,ST.getStage(hard?'hard-1-1':'1-1'),{setItem(){}},()=>{}, {getElementById:id=>$(id)});
 return{G,HG,$,clear:()=>G.onStageClear(),save:()=>current,loot:()=>loot,writes:()=>writes,receipt(reward){HG.HG.rewardXP['cap-run-001']=400;HG.HG.hardRewards['cap-run-001']=reward;callbacks.forEach(fn=>fn());}};
}
for(const n of [199,200])test(`normal actual result renderer matches capacity ${n}, opening/codex and old chests`,()=>{
 const before=capacity(n),f=render(before);f.clear();const after=structuredClone(f.save()),html=f.$('stageClear').innerHTML;
 assert.equal(after.chests.length,200);assert.deepEqual(after.chests.slice(0,n),before.chests);assert.equal(P.codexBits(after,1,'gunner'),0);
 if(n===199){const box=after.chests[199];assert.equal(box.it.h,'gunner');assert.match(html,/총사 무기 상자 1개/);E.openChests(after,1,[box.id]);assert.equal(after.inv[0].h,'gunner');assert.ok(P.codexBits(after,1,'gunner')&(1<<box.it.g));}
 else {assert.doesNotMatch(html,/총사 무기(?: 상자)? 1개/);assert.match(html,/총사 무기 자동 분해/);assert.equal(after.inv.length,0);assert.ok(after.mat.steel>before.mat.steel||after.mat.crystal>before.mat.crystal);}
 for(const k of ['steel','crystal'])assert.equal(after.mat[k]-before.mat[k],f.loot().filter(x=>x.auto).reduce((n,x)=>n+(E.dismantleYield(x.it)[k]||0),0));
 const saved=structuredClone(f.save());f.clear();assert.equal(f.writes(),1);assert.deepEqual(f.save(),saved);
});
for(const n of [199,200])test(`hard actual receipt/render, duplicate delivery and capacity ${n}`,async()=>{
 const before=capacity(n),user={id:'capacity-qa',email:'capacity@example.invalid'},now=1793500000000;
 const wallet={...H.initialGrowth(before),user_id:user.id,hard:{version:1,st:{'hard-1-1':3}}};
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data:before,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[wallet]});
 const rpc=(name,args,time=now)=>db.transaction(tx=>execute(tx,user,{kind:'rpc',name:'hd3d_growth_'+name,args},{now:time,random:()=>.5})).then(r=>r.data);
 assert.equal((await rpc('start',{p_id:'cap-run-001',p_mode:'campaign',p_stage:'hard-1-1',p_hero:'mage',p_target:'gunner'})).ok,true);
 const f=render(before,true);f.clear();assert.doesNotMatch(f.$('stageClear').innerHTML,/총사 무기(?: 상자)? 1개/,'no unacknowledged award claim');
 const args={p_token:'cap-run-001',p_completed:10,p_win:true,p_finish:true,p_stars:3,p_kills:11};
 const receipt=await rpc('progress',args,now+120000);assert.equal(receipt.ok,true);f.receipt(receipt.hardReward);
 const after=P.clean(db.tables.hd3d_progress[0].data),saved=structuredClone(db.tables);assert.deepEqual(after.chests.slice(0,n),before.chests);assert.equal(after.chests.length,200);assert.equal(P.codexBits(after,1,'gunner'),0);
 const label=f.$('runXP').textContent;
 for(const k of ['steel','crystal'])assert.equal(receipt.hardReward[k],after.mat[k]-before.mat[k]);
 if(n===199){assert.match(label,/총사 무기 상자 1개/);const box=after.chests[199];assert.equal(box.it.h,'gunner');E.openChests(after,1,[box.id]);assert.ok(P.codexBits(after,1,'gunner')&(1<<box.it.g));}
 else {assert.match(label,/총사 무기 자동 분해/);assert.doesNotMatch(label,/총사 무기(?: 상자)? 1개/);assert.equal(after.inv.length,0);assert.ok(after.mat.steel>before.mat.steel||after.mat.crystal>before.mat.crystal);}
 const retries=await Promise.all([rpc('progress',args,now+120001),rpc('progress',args,now+120001)]);assert.ok(retries.every(r=>r.already));assert.deepEqual(db.tables,saved);
 retries.forEach(r=>f.receipt(r.hardReward));assert.equal(f.$('runXP').textContent,label);
});
test('clear renderer displays XP already acknowledged before its DOM is created',()=>{
 const f=render(capacity(0));f.HG.HG.rewardXP['cap-run-001']=777;f.clear();assert.match(f.$('runXP').textContent,/777/);
});
test('partial hard receipts and non-target first clears never claim a target item',()=>{
 const partial=render(capacity(200),true);partial.G.completedWaves=5;partial.receipt({souls:50,chests:0,steel:12,crystal:0});assert.doesNotMatch(partial.$('runXP').textContent,/총사 무기/);
 const first=render(capacity(199),true);first.G.xpRun.repeat=false;first.G.xpRun.target=null;first.clear();first.receipt({souls:50,chests:1,steel:12,crystal:0});assert.doesNotMatch(first.$('runXP').textContent,/총사 무기/);
});
