import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/ui/loadouts.js',import.meta.url),'utf8').replace(/^import .*;\s*$/mg,'').replace(/export /g,'');
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({existing=false,confirm=async()=>true}={}){
 let epoch=1,calls=0,refreshes=0,changes=0,current=true,release;
 const s={hero:'mage',eq:{},adv:{},...(existing?{battlePresets:[{hero:'mage',partner:'archer'}]}:{})};
 const host={html:'',saves:[0,1].map(i=>({dataset:{save:String(i)}})),applies:[0,1].map(i=>({dataset:{apply:String(i)}})),set innerHTML(v){this.html=v;},querySelector:()=>({value:'archer'}),querySelectorAll(q){return q==='[data-save]'?this.saves:this.applies;}};
 const Acc={A:{user:{id:'a'}},sessionId:()=>epoch,load:()=>s,serverSaveState:()=>null,SAVE_WAIT_MESSAGE:'pending'};
 const HG={HG:{growth:{rev:1},pending:0},enabled:()=>true,refresh:async()=>true};
 const ctx=vm.createContext({Acc,HG,G:{screen:'town'},directGearEnabled:()=>true,partners:()=>['archer'],readPartner:()=> 'archer',writePartner(){},heroLabel:h=>h,esc:s=>String(s),loadoutStamp:()=> 'stamp',askConfirm:confirm,runDirectGear:async a=>{calls++;return new Promise(resolve=>release=r=>resolve([r]));}});
 vm.runInContext(source+';this.mount=mountLoadouts;',ctx);
 const mount=()=>ctx.mount(host,s,()=>{refreshes++;mount();},()=>changes++,()=>current);mount();
 return {host,ctx,calls:()=>calls,changes:()=>changes,refreshes:()=>refreshes,mount,release:r=>release(r),switchUser:()=>{epoch++;Acc.A.user={id:'b'};},close:()=>current=false};
}
test('preset repeated clicks dispatch once, success refreshes and displays status',async()=>{
 const f=fixture();const a=f.host.saves[0].onclick();await tick();f.host.saves[0].onclick();await tick();assert.equal(f.calls(),1);f.release({ok:true});await a;assert.equal(f.changes(),1);assert.match(f.host.html,/편성을 저장했어요/);
});
test('overwrite cancellation and navigation while confirming do not dispatch',async()=>{
 const f=fixture({existing:true,confirm:async()=>false});await f.host.saves[0].onclick();assert.equal(f.calls(),0);
 let answer;const g=fixture({existing:true,confirm:()=>new Promise(r=>answer=r)});const p=g.host.saves[0].onclick();g.close();answer(true);await p;assert.equal(g.calls(),0);
});
test('account switch during response cannot apply old result to new account UI',async()=>{
 const f=fixture();const p=f.host.saves[0].onclick();await tick();f.switchUser();f.release({ok:true});await p;assert.equal(f.changes(),0);f.mount();assert.doesNotMatch(f.host.html,/편성을 저장했어요/);
});
test('conflict shows explicit not-applied guidance and allows another attempt',async()=>{
 const f=fixture({existing:true});const p=f.host.applies[0].onclick();await tick();f.release({ok:false,reason:'conflict'});await p;assert.match(f.host.html,/다른 곳에서 편성이 변경/);const q=f.host.applies[0].onclick();await tick();assert.equal(f.calls(),2);f.release({ok:false,reason:'missing'});await q;assert.match(f.host.html,/창고/);
});
