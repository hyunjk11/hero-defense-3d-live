import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/ui/result.js',import.meta.url),'utf8').replace(/^import .*;[^\r\n]*\r?\n/gm,'').replace(/\bexport /g,'');
function fixture(hard=false){
 const nodes=new Map();let builds=0,stats=0,calls=0,resolve,reject,depart=[],navigation=0,session=1;
 const $=id=>{if(!nodes.has(id)){let html='';const n={disabled:false,hidden:false,textContent:'',onclick:null,classList:{remove(){}},get innerHTML(){return html},set innerHTML(v){html=v;if(id==='stageClear'){builds++;for(const key of ['scTown','scRetry','scNext','directReward'])nodes.delete(key);}}};nodes.set(id,n);}return nodes.get(id);};
 const G={runSaved:false,xpRun:{token:'run-a'},phase:'battle',wave:10,completedWaves:10,coreHp:30,coreMax:30,growthEnabled:true,stats:{kills:{mage:100}},endStatsShow:()=>stats++};
 const A={user:{id:'a'},sb:{serverEconomy:true}};const sounds=[],saved=[];
 let growthCallback;const growth={rewardXP:hard?{}:{'run-a':60},hardRewards:{}};
 const ctx=vm.createContext({G,$,document:{getElementById:$},Acc:{A,sessionId:()=>session,load:()=>({st:G.runSaved?{'1-1':3}:{}}),SAVE_WAIT_MESSAGE:'retry'},HG:{HG:growth,onGrowth:fn=>growthCallback=fn,checkpoint:()=>Promise.resolve(true)},Snd:{setMusic(){},play:n=>sounds.push(n)},STAGE:{id:hard?'hard-1-1':'1-1',hard,no:'1-1',n:'Forest',waves:10},ST:{starsFor:()=>3,STAR_D:['clear','hp50','hp100'],nextStage:s=>s.st['1-1']?(hard?'hard-1-2':'1-2'):null,STAGES:{'1-2':{n:'Next'}},HARD_STAGES:{'hard-1-2':{n:'Hard next'}},stageNo:n=>n},E:{STAT:{}},P:{},targetLabel:()=>'',directGearEnabled:()=>true,runDirectNormal:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b;});},sessionStorage:{setItem:(...args)=>saved.push(args)},go:()=>navigation++,setTimeout:fn=>fn(),alert(){}});
 vm.runInContext(source,ctx);ctx.initResult({departStage:id=>depart.push(id)});
 return {ctx,G,A,$,growth,notify:()=>growthCallback(),state:()=>({builds,stats,calls,sounds,saved,depart,navigation}),settle:()=>resolve({ok:true,souls:99,loot:[{chest:true}],unlocked:['1-2']}),fail:()=>reject(Error('network unavailable')),switchAccount(){A.user={id:'b'};session++;}};
}
const f=fixture(),job=f.ctx.directReturn('clear'),card=f.$('stageClear').innerHTML,button=f.$('scTown');
assert.equal(f.state().builds,1);assert.equal(f.state().stats,1);assert.equal((card.match(/<i class="on"/g)||[]).length,3);assert.ok(button.disabled);assert.ok(f.$('scRetry').disabled);assert.ok(f.$('scNext').hidden);assert.doesNotMatch(card,/영혼석 <b>\+/);
void f.ctx.directReturn('clear');assert.equal(f.state().calls,1);f.settle();await job;
assert.equal(f.$('scTown'),button);assert.equal(f.$('stageClear').innerHTML,card);assert.equal(f.state().builds,1);assert.equal(f.state().stats,1);assert.deepEqual(f.state().sounds,['victory']);assert.match(f.$('directReward').innerHTML,/99/);assert.equal(button.disabled,false);assert.equal(f.$('scNext').hidden,false);assert.equal(f.$('scRetry').disabled,false);f.$('scNext').onclick();assert.deepEqual(f.state().depart,['1-2']);assert.equal(f.state().saved.length,1);
console.log('PASS delayed acknowledgement retains card/stars/statistics, confirms rewards once and unlocks navigation');
const e=fixture(),j=e.ctx.directReturn('clear'),b=e.$('scTown');e.fail();await j;
assert.equal(e.state().builds,1);assert.equal(b.disabled,false);assert.equal(b.textContent,'다시 저장');assert.ok(e.$('scRetry').disabled);assert.match(e.$('directReward').textContent,/network/);const retry=b.onclick();assert.equal(e.$('scTown'),b);assert.ok(b.disabled);assert.equal(e.state().builds,1);e.settle();await retry;assert.equal(e.state().builds,1);assert.equal(e.state().stats,1);assert.equal(e.state().saved.length,1);assert.equal(b.textContent,'🏡 마을로 귀환');assert.deepEqual(e.state().sounds,['victory']);
console.log('PASS failed save and retry retain the same card and cannot depart before confirmation');
const a=fixture(),late=a.ctx.directReturn('clear');a.switchAccount();a.settle();await late;assert.equal(a.G.runSaved,false);assert.equal(a.state().saved.length,0);assert.ok(a.$('scTown').disabled);assert.equal(a.state().builds,1);
console.log('PASS late response from a different account/session cannot update rewards or navigation');
const r=fixture(),ret=r.ctx.directReturn('retreat');r.settle();await ret;assert.equal(r.state().navigation,1);assert.equal(r.state().saved.length,1);
console.log('PASS confirmed retreat retains existing automatic town navigation');
const h=fixture(true);h.G.onStageClear();const hardCard=h.$('stageClear').innerHTML,hardButton=h.$('scTown');assert.equal((hardCard.match(/<i class="on"/g)||[]).length,3);assert.match(hardCard,/scConds/);assert.match(hardCard,/보상 저장 중/);assert.equal(h.state().builds,1);
h.growth.rewardXP['run-a']=400;h.growth.hardRewards['run-a']={souls:320,chests:4,steel:0,crystal:0};h.notify();h.notify();h.G.onStageClear();assert.equal(h.state().builds,1);assert.equal(h.state().stats,1);assert.deepEqual(h.state().sounds,['victory']);assert.equal(h.$('scTown'),hardButton);assert.match(h.$('runXP').textContent,/400\n영혼석 \+320 · 상자 4개/);h.$('scNext').onclick();assert.deepEqual(h.state().depart,['hard-1-2']);
console.log('PASS hard uses the same three-star/conditions/card and updates only confirmed reward without replay');
const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(css,/animation:starIn/);assert.doesNotMatch(source,/animation-delay/);
console.log('PASS static non-bouncing stars and reduced-motion fallback');

// Exercise the actual town handoff, including the chest completion callback.
const flow=fs.readFileSync(new URL('../src/ui/flow.js',import.meta.url),'utf8');
const townSource=flow.slice(flow.indexOf('export function enterTown()'),flow.indexOf('function doOpenShop()')).replace('export ','');
for(const reason of ['clear','retreat','dead'])for(const shown of [undefined,false,true])for(const chests of [0,3]){
 let record=JSON.stringify({reason,resultShown:shown,stage:'1-1',stars:3,wave:10,kills:100,got:50,loot:[]}),popups=0,opens=0,done;
 const n={classList:{add(){}},visible:false},ctx={town:n,G:{},cam:{target:{set(){}}},Acc:{A:{user:null}},HG:{refresh(){}},showNotices:()=>Promise.resolve(),sessionStorage:{getItem:()=>record,removeItem:()=>{record=null}},$:()=>n,ST:{stageNo:x=>x},popup:()=>popups++,lootLines:()=>'',chestCount:()=>chests,setTimeout:fn=>fn(),openChestUI:fn=>{opens++;done=fn}};
 ctx.TOWN_Z=0;for(const key of ['departing','blessNear','smithNear','portalNear','labNear','shopNear','dgNear'])ctx[key]=false;
 for(const key of ['hideAll','buildTown','spawnTownHero','show','closeBless','closeShopUI','closeAdmin','closeLab','closeSmith','closeInv','closeStats','closeStageSel','closeDungeon','refreshTown'])ctx[key]=()=>{};
 vm.createContext(ctx);vm.runInContext(townSource,ctx);ctx.enterTown();assert.equal(record,null);assert.equal(opens,chests?1:0);if(chests){assert.equal(popups,0);done();}assert.equal(popups,reason==='clear'&&shown===true?0:1);
}
assert.equal(JSON.parse(f.state().saved[0][1]).resultShown,true);assert.equal(JSON.parse(r.state().saved[0][1]).resultShown,false);
console.log('PASS 18 town handoffs retain chests and legacy/retreat recovery, skip only the already-shown clear recap');
