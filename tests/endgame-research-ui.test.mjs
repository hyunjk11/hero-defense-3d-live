import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {endgameQuote} from '../src/data/endgame-research.js';
const src=readFileSync(new URL('../src/ui/lab.js',import.meta.url),'utf8');
const extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b));
function fixture({atk=10,mobileApp=false,serverEconomy=true,logged=true,enabled=true}={}){
 let s={souls:1e8,mat:{steel:1e6,crystal:1e6},research:{guardian:{atk}},endgameResearch:{}},queued,epoch=1,sent=[],busy=false,cheered=0,rendered=0;
 const node=()=>({html:'',attrs:{},disabled:false,classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}});
 const rows=Object.fromEntries(['gold','beam'].map(k=>{const selectors=Object.fromEntries(['.lrLv','.lrD','.lrBtn','.lrLock'].map(sel=>[sel,node()]));return [k,{...node(),dataset:{k},querySelector:sel=>selectors[sel]}];}));
 const Acc={A:{sb:{serverEconomy}},ready:()=>logged,load:()=>s,sessionId:()=>epoch,serverSaveState:()=>busy,SAVE_WAIT_MESSAGE:'pending'};
 const runDirectGear=commands=>{sent.push(commands[0]);return new Promise(r=>queued=r);};
 const renderLab=()=>rendered++;
 const source=extract('const END =','const MATN =')+extract('let endgameError','async function buy(k');
 const mod=new Function('Acc','endgameQuote','runDirectGear','renderLab','setH','Snd','labFx','hooks','mobileApp','directGearEnabled','pendingGear','HG','ENDGAME_RESEARCH_VERSION',
 `let buying=false,pendingRow=null,tab='endgame';${source};return {endgameOn,buyEndgame,renderEndgame,mount:b=>endgameBody=b};`)(Acc,endgameQuote,runDirectGear,renderLab,(n,v)=>n.html=v,{play(){}},{},{cheer(){cheered++;},onChange(){}},mobileApp,()=>logged,()=>busy,{enabled:()=>true,HG:{features:{endgameResearch:enabled?1:0}}},1);
 mod.mount({querySelectorAll:()=>Object.values(rows)});
 return {mod,rows,s,sent,setBusy:v=>busy=v,switchAccount:()=>epoch++,reply:({action='endgame_research',level=1,ok=true}={})=>queued([{action,level,ok}]),cheered:()=>cheered,rendered:()=>rendered};
}
test('shows actual gold/beam ranks, exact three prices, unlock and cap without fake upgrade',()=>{
 const f=fixture({atk:9}),r=(row,sel)=>f.rows[row].querySelector(sel);f.mod.renderEndgame(f.s);
 assert.equal(r('gold','.lrLv').html,'Lv.0');assert.match(r('gold','.lrD').html,/\+0 G → .*\+1 G/);assert.match(r('gold','.lrBtn').html,/30,000 · ⚙ 500 · 💎 150/);
 assert.equal(r('beam','.lrLv').html,'Lv.9/50');assert.match(r('beam','.lrD').html,/\+36%/);assert.equal(r('beam','.lrBtn').disabled,true);
 f.s.research.guardian.atk=10;f.mod.renderEndgame(f.s);
 assert.match(r('beam','.lrD').html,/\+40% → .*\+41%/);assert.match(r('beam','.lrBtn').html,/50,000 · ⚙ 750 · 💎 250/);
 f.s.endgameResearch.beam=40;f.mod.renderEndgame(f.s);assert.equal(r('beam','.lrLv').html,'Lv.50/50');assert.equal(r('beam','.lrBtn').disabled,true);
});
test('sends the displayed rank once and only matching receipt cheers',async()=>{
 const f=fixture();f.mod.renderEndgame(f.s);
 const pending=f.mod.buyEndgame(f.rows.gold);await f.mod.buyEndgame(f.rows.gold);
 assert.deepEqual(f.sent,[{p_action:'endgame_research',p_stat:'gold',p_count:0}]);assert.equal(f.cheered(),0);
 f.reply();await pending;assert.equal(f.cheered(),1);
 f.mod.renderEndgame(f.s);f.s.endgameResearch.gold=1;await f.mod.buyEndgame(f.rows.gold);
 assert.equal(f.sent.length,1,'changed rank requires reviewing the new quote');
 f.mod.renderEndgame(f.s);const next=f.mod.buyEndgame(f.rows.gold);f.switchAccount();f.reply({level:2});await next;
 assert.equal(f.cheered(),1,'a departed account cannot display a success');
});
test('mobile, guest and non-Firebase capability never submit; unconfirmed existing journal disables',async()=>{
 for(const opt of [{mobileApp:true},{logged:false},{serverEconomy:false},{enabled:false}]){
  const f=fixture(opt);f.mod.renderEndgame(f.s);assert.equal(f.mod.endgameOn(),false);await f.mod.buyEndgame(f.rows.gold);assert.deepEqual(f.sent,[]);
 }
 const f=fixture();f.setBusy(true);f.mod.renderEndgame(f.s);assert.equal(f.rows.gold.querySelector('.lrBtn').disabled,true);await f.mod.buyEndgame(f.rows.gold);assert.deepEqual(f.sent,[]);
});
