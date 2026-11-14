import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/data/hero-growth.js';
import { localGrowth } from '../src/account/growth-ledger.js';
import { sortieC, finalStats } from '../src/data/herostats.js';
import { ADV, advChecks, advBlock } from '../src/data/advance.js';
import { CLASSES, VISIBLE_HEROES } from '../src/data/heroes.js';
import { STAGES } from '../src/data/stages.js';
import * as P from '../src/account/progress.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('all visible heroes: equipment, permanent soul boosts, advancement and level order',()=>{
 for(const h of VISIBLE_HEROES)for(const l of [1,10,19,30,50])for(const adv of [null,...Object.values(ADV[h]||{})].filter(x=>!x?.reserved)){
  const L={perm:{hp:8,atk:8},eq:{atk:27,hp:48,spd:18,skill:25,cdr:13},adv,level:l},c=sortieC(h,L),m=H.levelMods(l),base=CLASSES[h];
  const hp=Math.round(Math.round(Math.round(Math.round(base.hp*1.48)*m.hp)*(adv?.mod.hp||1))*1.48);
  assert.equal(c.hp,hp);near(c.dmg,base.dmg*1.4*m.dmg*(adv?.mod.dmg||1)*1.27);
  const f=finalStats(c,L.eq,{growthEnabled:true,focus:3,ups:{atk:99,spd:99,rng:99,skill:99}});
  near(f.dmg,c.dmg*1.12);near(f.rate,c.rate*1.06);near(f.range,c.range);near(f.skillMul,m.skill*1.12*1.25);near(f.cd,c.cd*.98**3*.87);
 }
});
test('level requirement replaces soul grind; already advanced hero stays advanced',()=>{
 const s=P.empty();s.st['2-4']=2;s.heroLv.mage={hp:10,atk:10};s.growth=H.initialGrowth();
 assert.equal(advChecks(s,'mage').find(x=>x.k==='lv').ok,false);
 s.growth.xp.mage=H.totalXP(10);s.heroLv.mage={hp:0,atk:0};assert.equal(advChecks(s,'mage').find(x=>x.k==='lv').ok,true);
 s.adv.mage={b:Object.keys(ADV.mage)[0],n:1};s.growth.xp.mage=0;assert.equal(advBlock(s,'mage'), '이미 전직함');
});
test('guest migration snapshot, partial loss, retries, first clear, legitimate replay and max level',()=>{
 const s=P.empty();s.st=Object.fromEntries(Object.values(STAGES).filter(x=>x.ch<=4).map(x=>[x.id,2]));let doc=null;
 const op=(name,a={})=>{const r=localGrowth(doc,name,a,s,h=>['mage','archer','warrior'].includes(h));doc=r.doc;return r.result;};
 assert.equal(op('status').growth.balance,8528);s.st['5-1']=3;assert.equal(op('status').growth.balance,8528);
 let r=op('invest',{p_id:'investment-one',p_hero:'mage',p_level:19,p_revision:0});assert.equal(r.growth.balance,608);
 assert.equal(op('invest',{p_id:'investment-one',p_hero:'mage',p_level:19,p_revision:0}).growth.spent,7920);
 assert.equal(op('invest',{p_id:'other',p_hero:'mage',p_level:20,p_revision:0}).reason,'conflict');
 op('start',{p_id:'run-one',p_stage:'5-1',p_hero:'mage'});r=op('progress',{p_token:'run-one',p_completed:3,p_finish:true,p_win:false});assert.equal(r.xp,54);
 assert.equal(op('progress',{p_token:'run-one',p_completed:13,p_finish:true,p_win:true}).xp,54);
 op('start',{p_id:'run-two',p_stage:'5-1',p_hero:'mage'});assert.equal(op('progress',{p_token:'run-two',p_completed:13,p_finish:true,p_win:true}).xp,468);
 op('start',{p_id:'run-three',p_stage:'5-1',p_hero:'mage'});assert.equal(op('progress',{p_token:'run-three',p_completed:13,p_finish:true,p_win:true}).xp,312);
 doc.wallet.balance=100000;doc.wallet.xp.mage=H.totalXP(50);const before=structuredClone(doc.wallet);assert.equal(op('invest',{p_id:'max',p_hero:'mage',p_level:50,p_revision:doc.wallet.rev}).reason,'max');assert.deepEqual(doc.wallet,before);
});

// Actual client journal with fake account transport; filesystem and network are denied by the runner.
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
globalThis.localStorage=storage;globalThis.sessionStorage={...storage};globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
let tail=Promise.resolve();Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_k,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}}},configurable:true});
const Acc=await import('../src/account/account.js'),Client=await import('../src/account/hero-growth.js');
test('actual guest client: reload-safe receipt, storage failure and owner isolation',async()=>{
 Acc.playGuest();Acc.update(s=>({...s,st:{'1-1':2}}));assert.equal(await Client.refresh(),true);const balance=Client.HG.growth.balance;
 const [a,b]=await Promise.all([Client.invest('mage',2),Client.invest('mage',2)]);assert.equal(a.ok,true);assert.equal(b.ok,false);assert.equal(Client.HG.growth.balance,balance-100);
 await Client.refresh();assert.equal(Client.level('mage'),2);const run=await Client.startRun(null,'mage');await Client.checkpoint(run,3,false,true);await Client.retry();assert.equal(Client.HG.growth.earned,36);
 const stored=storage.setItem;storage.setItem=(k,v)=>{if(k.endsWith('_outbox'))throw Error('disk full');stored(k,v);};const w=Client.HG.growth.balance;
 const bad=await Client.invest('archer',2);assert.equal(bad.ok,false);assert.equal(Client.HG.growth.balance,w);storage.setItem=stored;
 Acc.A.user={id:'another-account'};assert.equal(Client.enabled(),false);assert.equal(Client.level('mage'),1);assert.equal(await Client.checkpoint(run,4,false,true),false);Acc.A.user=null;
});
