// Disposable localhost QA only; never reads or mutates a real account.
const assert=(v,m)=>{if(!v)throw Error(m)};
export async function run(branch=null){
 if(location.hostname!=='127.0.0.1'||!location.search.includes('test=1'))throw Error('Isolated QA only');
 const G=window.G;assert(!G.gear?.Acc.A.user,'Account must be absent');G.manual=true;G.grow=true;G.gold=20000;G.choose('mage');G.hero.g.position.set(22,0,14);G.Snd.cfg.sfxOn=G.Snd.cfg.bgmOn=false;G.Snd.apply();
 const {updTowers}=await import('../src/world/towers.js');const {updEnemies}=await import('../src/monsters/ai.js');
 // Prepare a small isolated open area; movement/attacks remain actual production code.
 for(let c=9;c<17;c++)for(let r=5;r<11;r++){const t=G.tileAt(c,r);t.t=G.T.GRASS;G.refreshTile(t);}G.computeDist();
 assert(G.build(12,7,'guardian'),'Build rejected');const tw=G.towers.at(-1);
 if(branch){G.upgradeTower(tw);G.upgradeTower(tw);G.towerXp(tw,2400);assert(G.chooseBranch(tw,branch),'Specialization');G.upgradeTower(tw);G.upgradeTower(tw);}
 const tick=(n)=>{for(let i=0;i<n;i++){G.t+=.05;updEnemies(.05);updTowers(.05);}};
 updTowers(.05);assert(tw.guards.length===2,'Two soldiers required');
 const guards=tw.guards;const g0=guards[0];const pos=g0.m.g.position;const cell=G.toTile(pos.x,pos.z);
 const e=G.spawnEnemy('grunt',100,{x:pos.x+.25,z:pos.z+.25,tile:cell});e.state='walk';e.E={...e.E,spd:.15,dps:3};
 const hp=e.hp;tick(100);assert(e.hp<hp,'No soldier damage');assert(tw.xp>0,'No XP');assert(e.guardTotal>0,'No block');assert(e.guardTotal<=8,'Block cap');
 const before=tw.guards.map(s=>s.hp);if(!branch){G.upgradeTower(tw);tick(1);assert(tw.guards.length===2,'Upgrade duplicates');assert(tw.guards.every(s=>s.m.g.parent===G.scene),'Orphan model');}
 // Death and re-summoning preserve count, detach old render objects.
 const dead=tw.guards[0],old=dead.m.g;dead.hp=0;tick(1);assert(!old.parent,'Dead model retained');tick(Math.ceil((tw.S.respawn+1)/.05));assert(tw.guards.length===2&&dead.hp>0&&dead.m.g.parent===G.scene,'Respawn');
 G.select(tw);const result={branch,level:tw.lvl,damage:hp-e.hp,xp:tw.xp,guardTotal:e.guardTotal,soldiers:tw.guards.length,hp:tw.guards.map(s=>s.hp),meter:tw.dmT||0};
 window.guardCase={tw,tick,result};return result;
}
export function teardown(){const G=window.G,tw=window.guardCase.tw,models=tw.guards.map(s=>s.m?.g).filter(Boolean);G.sellTower(tw);if(models.some(m=>m.parent))throw Error('Soldier leaked after sale');if(G.enemies.some(e=>e.guardSoldier?.tw===tw))throw Error('Lease leaked');return {disposed:models.length};}
