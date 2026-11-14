import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {empty} from '../src/account/progress.js';
import * as E from '../src/account/equip.js';

// Execute the shipped handlers with a virtual clock and deferred server response.
// This measures deliberate waits, not production network or GPU latency.
const read=f=>fs.readFileSync(new URL('../src/ui/'+f,import.meta.url),'utf8');
const source=read('chest.js').replace(/^import .*;\s*$/mg,'').replace(/export /g,'');
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function chest({count=2,full=false,fail=false}={}) {
 const save=empty();for(let i=0;i<count;i++){const it=E.makeItem('armor',undefined,0,()=>.4);it.id='latency-'+i;save.chests.push(E.chestOf(it,'chest'));}
 if(full)save.inv=Array.from({length:E.CAP},(_,i)=>({...save.chests[0].it,id:'bag-'+i}));
 let now=0,epoch=1,calls=0,release,pending;const timers=[],nodes=new Map();
 const node=()=>({classList:{add(){},remove(){},contains(){return false;}},style:{setProperty(){}},querySelector(){return node();},querySelectorAll(){return[];},appendChild(){},contains(s){return s===this.stage;}});
 const ov=node();Object.defineProperty(ov,'innerHTML',{set(v){this.html=v;this.stage=node();},get(){return this.html;}});ov.querySelector=q=>q==='.cvStage'?ov.stage:node();nodes.set('chestOv',ov);
 nodes.set('cbOk',node());
 const Acc={A:{user:{id:'fixture-a'}},sessionId:()=>epoch,load:()=>save,SAVE_WAIT_MESSAGE:'pending'};
 const ctx=vm.createContext({E,Acc,Snd:{play(){}},$:id=>nodes.get(id)||null,document:{querySelector:()=>null,querySelectorAll:()=>[],createElement:node},GC:()=>'',GCi:()=>'',card:()=>'',setOf:()=>null,icon:()=>'',directGearEnabled:()=>true,
  runDirectGear:async commands=>{calls++;return new Promise((resolve,reject)=>{release=()=>{if(fail)return reject(Error('offline'));const [next,result]=E.openChests(save,commands.length,commands.map(c=>c.p_item));Object.assign(save,next);resolve(result.opened.map(o=>({ok:true,opened:[o]})));};});},
  setTimeout(fn,ms){const t={fn,at:now+ms};timers.push(t);return t;},clearTimeout(t){const i=timers.indexOf(t);if(i>=0)timers.splice(i,1);}});
 vm.runInContext(source+'\nthis.api={openChestUI,openBatch,lastChestBatch};',ctx);
 const advance=async ms=>{now+=ms;for(let n=0;n<20;n++){const i=timers.findIndex(t=>t.at<=now);if(i<0)break;timers.splice(i,1)[0].fn();await tick();}await tick();};
 return {ctx,save,ov,advance,calls:()=>calls,release:async()=>{release();await tick();},switchAccount:()=>{Acc.A.user={id:'fixture-b'};epoch++;},run:expr=>vm.runInContext(expr,ctx)};
}

// Automatic single open dispatches on the next task, never after 500 + 700ms.
{
 const f=chest({count:1});f.ctx.api.openChestUI();await f.advance(0);assert.equal(f.calls(),1);assert.equal(f.save.inv.length,0);
 f.ov.stage.onclick();f.ov.stage.onclick();await f.advance(0);assert.equal(f.calls(),1);
 await f.release();assert.equal(f.save.inv.length,1);assert.equal(f.save.chests.length,0);assert.match(f.ov.stage.className,/open/);
 console.log('PASS single auto open starts immediately, blocks repeat clicks, and waits for server confirmation');
}
{
 const f=chest();f.ctx.api.openChestUI();f.ov.stage.onclick();f.ov.stage.onclick();await f.advance(0);assert.equal(f.calls(),1);await f.release();assert.equal(f.save.inv.length,1);assert.equal(f.save.chests.length,1);
 console.log('PASS manual open starts immediately and consumes exactly one chest');
}
{
 const f=chest({full:true});f.ctx.api.openChestUI();f.ov.stage.onclick();await f.advance(0);assert.equal(f.calls(),0);assert.equal(f.save.chests.length,2);
 console.log('PASS full inventory does not dispatch or consume a chest');
}
{
 const f=chest({fail:true});f.ctx.api.openChestUI();f.ov.stage.onclick();await f.advance(0);await f.release();assert.equal(f.save.chests.length,2);assert.equal(f.run('CB.busy'),false);assert.equal(f.save.inv.length,0);
 console.log('PASS failed response leaves chest intact and releases presentation busy state');
}
{
 const f=chest();f.ctx.api.openChestUI();const p=f.ctx.api.openBatch(2);await tick();assert.equal(f.calls(),1);assert.equal(f.ctx.api.lastChestBatch(),null);await f.release();await p;await f.advance(0);assert.match(f.ov.html,/상자 2개 개봉/);assert.equal(f.save.inv.length,2);
 console.log('PASS batch summary appears without the extra 450ms after confirmed storage');
}
{
 const f=chest();f.ctx.api.openChestUI();const p=f.ctx.api.openBatch(2);await tick();await f.release();await p;const before=f.ov.html;f.switchAccount();await f.advance(0);assert.equal(f.ov.html,before);
 console.log('PASS delayed batch result cannot paint into another account session');
}

const gear=read('gear.js'),part=gear.slice(gear.indexOf('async function doDismantle()'),gear.indexOf('async function doCraft('));
for(const cancel of [false,true]) {
 let calls=0,delay,callback,release,current=true,done=false;const ui={busy:false,dis:new Set(['item-a'])};
 const ctx=vm.createContext({ui,S:()=>({inv:[{id:'item-a',g:0}]}),beginSmith:()=>{ui.busy=true;return{};},smithCurrent:()=>current,smithOwner:()=>current,
  finishSmith:()=>{ui.busy=false;return true;},renderSmith(){},askConfirm:async()=>true,Snd:{play(){}},document:{querySelectorAll:()=>[],querySelector:()=>null},hooks:{onChange(){done=true;}},alertMsg(){},
  smithLater(_j,fn,ms){delay=ms;callback=fn;},directGearEnabled:()=>true,runDirectGear:()=>{calls++;return new Promise(r=>release=()=>r([{ok:true,yield:{steel:3,crystal:0}}]));}});
 vm.runInContext(part,ctx);await vm.runInContext('doDismantle()',ctx);assert.equal(delay,0);await vm.runInContext('doDismantle()',ctx);assert.equal(calls,0);
 if(cancel)current=false;const p=callback();await tick();assert.equal(calls,cancel?0:1);
 if(!cancel){assert(ui.busy);release();await p;assert.equal(ui.busy,false);assert(done);assert.equal(ui.dis.size,0);}else await p;
}
console.log('PASS dismantle dispatch has no fixed wait, repeat clicks and cancelled sessions remain guarded');
