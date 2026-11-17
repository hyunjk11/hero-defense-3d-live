import {run} from './hard-party-balance.mjs';
const guard=()=>{if(location.hostname!=='127.0.0.1'||location.port!=='8990'||!window.__isolatedReview?.memoryOnly)throw Error('RAM QA only');};
async function fixture({count=2,seed=12345}={}){
 guard();if(G.phase!=='build'||G.wave!==0||G.heroes.length!==2)throw Error('fresh initialized two-hero stage required');G.manual=true;G.t=0;G.onXPWave=null;G.onRunEnd=null;G.onStageClear=()=>{G.phase='over';};
 const [{prepareHardParty,startHardParty},{spawnHero,setControlled},{disposeHeroModel},E,AD,T]=await Promise.all([import('/src/heroes/hard-party.js'),import('/src/heroes/hero.js'),import('/src/render/characters.js'),import('/src/account/equip.js'),import('/src/data/advance.js'),import('/src/data/skill-tree.js')]);
 const [P,HG,HD]=await Promise.all([import('/src/account/progress.js'),import('/src/data/hero-growth.js'),import('/src/data/hard.js')]);
 const profile=await (await fetch('/tests/hard-party-profile.json')).json(),s0=profile.save;let s=structuredClone(s0),g=structuredClone(profile.growth);let xp=0,souls=0;
 const prior=Object.values(HD.HARD_STAGES).filter(x=>x.ch<=6);
 for(const st of prior){xp+=HD.hardXP(st,st.waves,true,true);souls+=HD.hardReward(st,st.waves,true,true,'mage').souls;}
 HG.credit(g,xp);s.souls+=souls;
 for(const [hero,level] of [['mage',45],['archer',30]]){const out=HG.invest(g,hero,level);if(!out.ok)throw Error('XP budget');g=out.growth;}
 for(const hero of ['mage','archer'])for(const key of ['hp','atk'])while(s.heroLv[hero][key]<10){const [next,ok]=P.buyPerm(s,hero,key);if(!ok)throw Error('soul budget');s=next;}

 for(const h of G.heroes){h.hb.dispose();disposeHeroModel(h.ch);}G.heroes=[];G.hardParty=null;G.partyAI=null;
 let trees={};for(const tier of [15,20,30,40])trees=T.changeTree(trees,'mage','flame',45,0,tier,T.treeOptions('mage','flame',tier)[0].id);
 const main={perm:s.heroLv.mage,equip:E.bonus(s,'mage'),legend:E.legendOf(s,'mage'),adv:AD.advOf('mage',{b:'flame',n:1}),heroLevel:45,heroTree:T.treeBuild(trees,'mage','flame',45),heroGear:s.inv.filter(x=>Object.values(s.eq.mage||{}).includes(x.id))};
 const sub={perm:s.heroLv.archer,equip:{},legend:null,adv:null,heroLevel:30,heroTree:null,heroGear:[]};
 const run={party:['mage','archer'],loadouts:{mage:main,archer:sub}};await prepareHardParty(run);Object.assign(G,main);G.research=structuredClone(s.research);G.focus=0;G.advBar=AD.advBarMul(main.adv);G.growthEnabled=true;spawnHero('mage',main,false);if(count===2)startHardParty(run);G.growthEnabled=true;if(G.heroes[0].C.level!==45||G.heroes[1].C.level!==30||!G.heroes[0].tree)throw Error('Loadout not applied');
 const baseline={...profile.baseline,deterministic:true,strategy:'focus',count,seed,mainLevel:45,subLevel:30,priorHardClears:prior.map(x=>x.id),modeledXP:xp,modeledSouls:souls,xpLeft:g.balance,soulsLeft:s.souls,assumptions:'Normal54 gear/research; assumed H1-6 first-clear XP/soul budget, paid permanent levels and XP investments. Mage flame assumed. No additional hard gear, no real save, no settlement.'};
 sessionStorage.setItem('qa_balance_profile',JSON.stringify(baseline));return baseline;
}

export async function runCase(spec={}){await fixture(spec);const initialActors=G.heroes.map(h=>({cls:h.cls,level:h.C.level,max:h.max,tree:h.tree}));const result=await run({settle:false});return {...result,initialActors,harness:'Real 1/60 engine, modeled progression with asserted applied levels/tree; no live saves or settlement'};}
