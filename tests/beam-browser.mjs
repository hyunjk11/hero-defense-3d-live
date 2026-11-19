// Controlled localhost-only visual/combat fixture. No account or network mutation.
const assert=(v,m)=>{if(!v)throw Error(m)};
export async function setup(branch=null,level=1){
 if(location.hostname!=='127.0.0.1'||!location.search.includes('test=1'))throw Error('Isolated QA only');
 const G=window.G;assert(!G.gear?.Acc.A.user,'No account');G.manual=true;G.grow=true;G.gold=20000;G.choose('mage');G.hero.g.position.set(22,0,14);G.Snd.cfg.sfxOn=G.Snd.cfg.bgmOn=false;G.Snd.apply();
 const {updTowers}=await import('../src/world/towers.js');
 for(let c=9;c<17;c++)for(let r=5;r<11;r++){const t=G.tileAt(c,r);t.t=G.T.GRASS;G.refreshTile(t);}G.computeDist();assert(!G.build(12,7,'guardian'),'Locked in first preparation');G.wave=4;assert(G.build(12,7,'guardian'),'Build');const tw=G.towers.at(-1);
 if(branch){G.upgradeTower(tw);G.upgradeTower(tw);G.towerXp(tw,2400);assert(G.chooseBranch(tw,branch),'Branch');}
 while(tw.lvl<level)assert(G.upgradeTower(tw),'Upgrade');
 const spawn=(x,z,type='grunt')=>{const e=G.spawnEnemy(type,100,{x,z,tile:G.toTile(x,z)});e.state='walk';e.immT=0;return e;};
 const e=spawn(1,3),near=branch==='guardian_assault'?spawn(2,3):null;
 const step=(seconds)=>{for(let i=0;i<Math.round(seconds/.05);i++){G.t+=.05;updTowers(.05);}};
 step(.2);G.select(tw);window.beamCase={tw,e,near,spawn,step};return state();
}
export function state(){const {tw,e,near}=window.beamCase;return {name:window.G.TOWERS.guardian.n,level:tw.lvl,branch:tw.branch,hp:e.hp,nearHp:near?.hp,xp:tw.xp,heat:tw.beam?.age,visible:tw.beam?.visual.g.visible,width:tw.beam?.visual.core.scale.x,shots:tw.shots,guards:tw.guards?.length||0};}
export function teardown(){const {tw}=window.beamCase,group=tw.beam.visual.g;window.G.sellTower(tw);assert(!group.parent,'Beam leaked');assert(!tw.beam,'Beam state leaked');return {disposed:true};}
