import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.argv[2]||path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'src/ui/saveconflict.js'),'utf8').replace(/^import .*;\r?\n/gm,'');
function fixture(){
 let focused=null;
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.inert=false;this.hidden=false;this.disabled=false;this.attrs={};this.style={};this.className='';}
  append(...ns){for(const n of ns){n.parent=this;this.children.push(n);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
  setAttribute(k,v){this.attrs[k]=v;}contains(n){return this===n||this.children.some(c=>c.contains(n));}
  matches(s){return s==='button'?this.tagName==='button':s==='[data-save-retry]'?!!this.dataset.saveRetry:s==='.sync'?this.className==='sync':s==='.hidden'?this.className.split(' ').includes('hidden'):false;}
  closest(s){return this.matches(s)?this:this.parent?.closest(s)||null;}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0];}
  focus(){focused=this;}get dataset(){return this.data||={};}set textContent(v){this.text=v;for(const c of this.children)c.parent=null;this.children=[];}get textContent(){return this.text||'';}
 }
 const body=new Node('body'),game=new Node('main'),runXP=new Node('span');runXP.id='runXP';game.append(runXP);body.append(game);
 const find=(pred,node=body)=>pred(node)?node:node.children.map(n=>find(pred,n)).find(Boolean);
 let pending=null,conflict=null;const listeners=[],blocked=[],events={},micro=[],timers=new Map();let timerId=0;
 const A={A:{user:{id:'qa-a'},get conflict(){return conflict;}},sessionId:()=>1,serverSaveState:()=>pending,onChange:f=>listeners.push(f),onSaveBlocked:f=>blocked.push(f),SAVE_WAIT_MESSAGE:'저장 확인 후 다시 시도해 주세요.',canResolveLocal:()=>false};
 let releases=[],calls=0;const H={onGrowth:f=>listeners.push(f),refresh:()=>{calls++;return new Promise(r=>releases.push(r));}};
 new Function('Acc','HG','G','document','window','URL','Blob','queueMicrotask','setTimeout','clearTimeout',source)(A,H,{screen:'town',phase:'town'},{body,createElement:t=>new Node(t),getElementById:id=>find(n=>n.id===id),querySelectorAll:s=>body.querySelectorAll(s)},{addEventListener:(n,f)=>(events[n]||=[]).push(f)},URL,Blob,f=>micro.push(f),f=>{timers.set(++timerId,f);return timerId;},id=>timers.delete(id));
 const flush=()=>{while(micro.length)micro.shift()();};flush();
 const emit=()=>{listeners.forEach(f=>f());flush();};
 return{body,game,runXP,events,A,emit,find,blocked,flush,set(v){pending=v;emit();},conflict(v){conflict=v;emit();},calls:()=>calls,release:(i=0)=>releases[i]?.(false),focus:()=>focused,
  async tick(){const ts=[...timers.values()];timers.clear();ts.forEach(f=>f());await Promise.resolve();flush();},async settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve();flush();},buttons:()=>body.querySelectorAll('[data-save-retry]')};
}
test('normal settlement reuses result text without another screen, DOM panel, focus or page lock',()=>{const f=fixture(),count=f.body.children.length;f.set({token:'run',busy:true});assert.equal(f.body.children.length,count);assert.equal(f.find(n=>n.className==='saveConflict'),undefined);assert.equal(f.game.inert,false);assert.equal(f.buttons().length,0);assert.equal(f.focus(),null);f.set(null);assert.equal(f.body.children.length,count);});
test('failed acknowledgement automatically retries once; only persistent failure exposes inline retry',async()=>{const f=fixture();f.set({token:'run',busy:false});assert.equal(f.buttons().length,0);await f.tick();assert.equal(f.calls(),1);assert.equal(f.buttons().length,0);f.release();await f.settle();assert.equal(f.buttons().length,1);assert.equal(f.buttons()[0].parent,f.runXP);await f.tick();assert.equal(f.calls(),1);const b=f.buttons()[0],first=b.onclick(),second=b.onclick();await Promise.resolve();assert.equal(f.calls(),2);f.release(1);await Promise.all([first,second]);await f.settle();assert.equal(f.buttons().length,1);});
test('automatic recovery success clears its action without another confirmation',async()=>{const f=fixture();f.set({token:'run',busy:false});await f.tick();f.set(null);f.release();await f.settle();assert.equal(f.buttons().length,0);assert.equal(f.game.inert,false);assert.equal(f.body.children.length,1);});
test('blocked mutation uses existing status; unrelated exceptions remain visible',()=>{const f=fixture();f.set({token:'run',busy:true});f.blocked[0]();f.flush();assert.equal(f.runXP.textContent,f.A.SAVE_WAIT_MESSAGE);assert.equal(f.body.children.length,1);let prevented=0;for(const fn of f.events.error)fn({error:{code:'server_save_pending'},preventDefault(){prevented++;}});assert.equal(prevented,1);for(const fn of f.events.error)fn({error:Error('unrelated'),preventDefault(){prevented++;}});assert.equal(prevented,1);});
test('A delayed recovery never leaves its controls on B',async()=>{const f=fixture();f.set({token:'run-a',busy:false});await f.tick();f.A.A.user={id:'qa-b'};f.set(null);f.release();await f.settle();assert.equal(f.buttons().length,0);assert.equal(f.game.inert,false);});
test('B can recover independently while A response remains pending',async()=>{const f=fixture();f.set({token:'run-a',busy:false});await f.tick();f.A.A.user={id:'qa-b'};f.set({token:'run-b',busy:false});await f.tick();assert.equal(f.calls(),2);f.release(0);await f.settle();assert.equal(f.buttons().length,0);f.release(1);await f.settle();assert.equal(f.buttons().length,1);f.set(null);assert.equal(f.buttons().length,0);});
test('actual snapshot conflict retains explicit choice and impossible local-choice protection',()=>{const f=fixture(),s={souls:1,stats:{runs:1},inv:[],stor:[]};f.conflict({local:s,cloud:s});const dialog=f.find(n=>n.className==='saveConflict');assert.ok(dialog);assert.equal(dialog.attrs['aria-modal'],'true');assert.equal(f.game.inert,true);assert.equal(dialog.querySelectorAll('button')[0].disabled,true);f.conflict(null);assert.equal(f.game.inert,false);});
test('repeated pending states add no panels or timers surviving account completion',async()=>{const f=fixture();for(let i=0;i<100;i++){f.set({token:'run-'+i,busy:true});f.set({token:'run-'+i,busy:false});f.set(null);}await f.tick();assert.equal(f.calls(),0);assert.equal(f.body.children.length,1);assert.equal(f.buttons().length,0);assert.equal(f.game.inert,false);});
test('saving navigation blocks game input but permits the existing statistics controls',()=>{
 const flow=fs.readFileSync(path.join(root,'src/ui/flow.js'),'utf8'),start=flow.indexOf('// Keep game-input protection'),end=flow.indexOf('  configureNavigation({',start),G={navigating:false},events={};
 assert.ok(start>=0);new Function('G','addEventListener',flow.slice(start,end))(G,(n,f)=>events[n]=f);
 for(const name of ['keydown','pointerdown','pointerup','pointermove','click','dblclick','contextmenu','touchstart','touchmove','wheel']){
  let cancelled=0;const e={key:' ',target:{closest:()=>null},preventDefault(){cancelled++;},stopImmediatePropagation(){cancelled++;}};events[name](e);assert.equal(cancelled,0,name+' idle');G.navigating=true;events[name](e);assert.equal(cancelled,2,name+' waiting');G.navigating=false;
 }
 G.navigating=true;for(const e of [{key:'c'},{key:'Escape'},{ctrlKey:true},{target:{closest:()=>({id:'scStats'})}}]){let blocked=false;events.keydown({...e,preventDefault(){blocked=true;},stopImmediatePropagation(){}});assert.equal(blocked,false);}
 let blocked=false;events.click({target:{closest:()=>({id:'scStats'})},preventDefault(){blocked=true;},stopImmediatePropagation(){}});assert.equal(blocked,false);
});

test('hard retreat reuses the existing result, statistics and town controls',()=>{
 const s=fs.readFileSync(path.join(root,'src/ui/result.js'),'utf8'),start=s.indexOf('function hardEnd(reason)');
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{classList:{remove(c){this.removed=c;}},textContent:'',innerHTML:''});return nodes.get(id);};
 let returns=0,stats=0,checkpoints=0;const G={completedWaves:1,xpRun:{token:'same'},endStatsShow:k=>{assert.equal(k,'over');stats++;}};
 const end=new Function('G','HG','$','STAGE','sumKills','goTown',s.slice(start)+';return hardEnd;')(G,{checkpoint:()=>{checkpoints++;return Promise.resolve(true);}},el,{no:'H1-1'},()=>11,()=>returns++);
 end('retreat');end('retreat');assert.equal(returns,1);assert.equal(checkpoints,1);assert.equal(stats,1);assert.equal(G.phase,'over');assert.equal(el('over').classList.removed,'hidden');assert.match(el('overTxt').textContent,/H1-1.*1.*11/);assert.equal(el('overTown').classList.removed,'hidden');
});
