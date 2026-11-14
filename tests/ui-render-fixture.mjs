// Runs the unchanged product UI functions with a small DOM recorder and fake account.
// It measures JS formatting/save decoding only, not layout, WebGL or network time.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function fixture(root, {items=0, level=30, hero='mage', branch, enabled=true}={}) {
  root=path.resolve(root);
  const imp=f=>import(pathToFileURL(path.join(root,'src',f)));
  const [P,E,H,AD,Heroes,Tree,Stats,Preview,HeroE]=await Promise.all([
    imp('account/progress.js'),imp('account/equip.js'),imp('data/hero-growth.js'),imp('data/advance.js'),
    imp('data/heroes.js'),imp('data/skill-tree.js'),imp('data/herostats.js'),imp('ui/growth-preview.js'),imp('data/hero-e.js')]);
  let save=P.empty(),reads=0,epoch=1;save.hero=hero;save.souls=1000;save.nick='Local fixture';
  if(branch)save.adv[hero]={b:branch,n:1};
  let seed=8123;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const originalNow=Date.now;Date.now=()=>1800000000000;
  try{for(let i=0;i<items;i++){const it=E.makeItem(['weapon','armor','acc'][i%3],hero,i%5,rng,1+i%10);it.id='fixture-'+i;if(i<40)save.inv.push(it);else save.stor.push(it);}}finally{Date.now=originalNow;}
  let raw=JSON.stringify(P.clean(save));
  const HG={HG:{owner:'fixture-a',growth:H.initialGrowth(),features:{trees:1},pending:0,hasInvestment:false,status:'ready',message:'',buildBusy:false},
    available:()=>enabled,enabled:()=>enabled,level:h=>H.levelOf(HG.HG.growth.xp[h]),
    viewSave:(s=Acc.load())=>({...s,growth:enabled?HG.HG.growth:null}),onGrowth(){},refresh:async()=>true,
    changeBuild:async()=>({ok:true}),invest:async()=>({ok:false,reason:'not-used'})};
  HG.HG.growth.xp[hero]=H.totalXP(level);HG.HG.growth.balance=5000;
  const Acc={A:{user:{id:'fixture-a'}},load:()=>{reads++;return P.clean(JSON.parse(raw));},sessionId:()=>epoch};
  const nodes=new Map();
  class Node {
    constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.disabled=false;this.dataset={};this.classes=new Set();this.classList={contains:k=>this.classes.has(k),add:k=>this.classes.add(k),remove:k=>this.classes.delete(k),toggle:(k,on)=>{on=on??!this.classes.has(k);on?this.classes.add(k):this.classes.delete(k);return on;}};}
    get firstElementChild(){return !!this.innerHTML;}
    insertAdjacentHTML(_pos,s){this.innerHTML+=s;}
    querySelectorAll(){return [];}
    focus(){}
  }
  const $=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
  const document={getElementById:id=>id==='statBtn'?null:$(id),querySelectorAll:()=>[],activeElement:null};
  const G={screen:'town',phase:'town'};
  const Sh={heroOwned:()=>true,usableHero:h=>h};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const deps={HG,H,Acc,Sh,AD,G,document,esc,...Heroes,...Tree,...Stats,...Preview,...HeroE,
    $ ,Snd:{play(){}},E,escLayer(){},definePanel:()=>({show(){},hide(){}}),addEventListener(){},meterDps:()=>0,skillShare:()=>0};
  const load=(file,names)=>{
    const original=fs.readFileSync(path.join(root,'src/ui',file),'utf8');
    const imports=[...original.matchAll(/^import (.*?) from /gm)].flatMap(m=>m[1].startsWith('* as ')?[m[1].slice(5)]:m[1].replace(/[{}]/g,'').split(',').map(s=>s.trim().split(/\s+as\s+/).at(-1)));
    const keys=[...new Set([...imports,'document','addEventListener'])];
    const src=original.replace(/^import .*;[^\r\n]*\r?\n/gm,'').replace(/\bexport /g,'');
    return new Function(...keys,src+'\nreturn {'+names+'};')(...keys.map(k=>deps[k]));
  };
  const tree=load('skill-tree.js','mountTree,selectedBuild');Object.assign(deps,tree);
  const growth=load('hero-growth.js','mountGrowth,refreshCard,confirm,refreshGrowthUI');Object.assign(deps,growth);
  const stats=load('stats.js','renderTown,townData,openStats,closeStats');
  return {root,P,E,H,AD,HG,Acc,G,$,nodes,growth,tree,stats,
    readCount:()=>reads,resetReads:()=>{reads=0;},
    render:()=>stats.openStats(hero),refresh:()=>stats.renderTown(),
    snapshot:()=>Object.fromEntries([...nodes].map(([k,n])=>[k,{html:n.innerHTML,text:n.textContent,value:n.value,disabled:n.disabled,min:n.min,classes:[...n.classes].sort(),dataset:n.dataset}]).sort()),
    update(fn){const s=JSON.parse(raw);fn(s);raw=JSON.stringify(P.clean(s));},
    raw:()=>raw,switchAccount(){epoch++;HG.HG.owner='fixture-b';Acc.A.user={id:'fixture-b'};raw=JSON.stringify(P.empty());HG.HG.growth=H.initialGrowth();},
  };
}
