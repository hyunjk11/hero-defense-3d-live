import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLab} from './engine.mjs';

// An independent expectation table: changing the production definition requires review.
const tiers={1:[],2:[],3:[],4:[],5:[{hp:8},{cdr:5}],6:[{atk:6},{critD:12}],
  7:[{spd:6},{rng:8}],8:[{hp:8},{cdr:8}],9:[{rng:6},{skill:12}],10:[{hp:8},{atk:8}],morvia:[{hp:8},{skill:12}]};
const near=(a,b,name)=>assert.ok(Math.abs(a-b)<1e-6,`${name}: ${a} != ${b}`);
export async function runSuite() {
  const l=await createLab(), rows=[], boundaries=[];
  const check=(name,ok)=>{assert.ok(ok,name);boundaries.push({name,pass:true});};
  const expected=(key,count)=>{
    const q={};for(const it of l.E.equippedItems(l.save(),'mage'))for(const [k,v] of [it.m,...it.sub])q[k]=(q[k]||0)+v;
    for(const [i,t] of tiers[key].entries())if(count>=i+2)for(const [k,v] of Object.entries(t))q[k]=(q[k]||0)+v;
    return {q,hp:Math.round(330*(1+(q.hp||0)/100)),attack:34*(1+(q.atk||0)/100),
      rate:.95*(1+(q.spd||0)/100),range:9*(1+(q.rng||0)/100),skill:1+(q.skill||0)/100,cooldown:14*(1-Math.min(40,q.cdr||0)/100)};
  };
  for(const key0 of Object.keys(tiers)) {
    const key=key0==='morvia'?key0:Number(key0);l.reset();l.seed(key);
    for(const [step,count] of [0,1,2,3,2,1,0].entries()) {
      const action=step===0?'initial':step<=3?'equip':'unequip';
      if(action==='equip')assert.equal(l.equip(l.E.SLOT_KEYS[count-1]),true);
      if(action==='unequip')l.unequip(l.E.SLOT_KEYS[count]);
      const before=JSON.parse(JSON.stringify(l.save()));l.roundtrip();assert.deepEqual(JSON.parse(JSON.stringify(l.save())),before,'save roundtrip');
      const expect=expected(key,count),h=l.spawn(),actual=l.snapshot();
      for(const k of ['hp','attack','rate','range','skill','cooldown'])near(actual[k],expect[k],`${key}/${count} ${k}`);
      const state=l.Sets.setStatuses(l.save(),'mage').find(x=>x.key===key),html=l.View.setCard(state,'루나 · 마법사');
      assert.equal(state.count,count);assert.equal((html.match(/setTier active/g)||[]).length,tiers[key].filter((_,i)=>count>=i+2).length);
      const shown=l.Stats.finalStats(h.C,h.eq,{cls:'mage',growthEnabled:true,focus:0});
      for(const [a,b] of [['hp','hp'],['dmg','attack'],['rate','rate'],['range','range'],['skillMul','skill'],['cd','cooldown']])near(shown[a],actual[b],'display vs battle '+a);

      // Real Q -> projectile updater -> enemy HP mutation -> damage meter.
      const e=l.target(),hp0=e.hp;l.Skills.castSkill(e.g.position);const castCooldown=h.skillCd;
      near(castCooldown,expect.cooldown,'Q timer initialized');assert.equal(l.G.projs.length,1);
      l.Skills.castSkill(e.g.position);assert.equal(l.G.projs.length,1,'Q cannot recast during cooldown');
      for(let i=0;i<600&&l.G.projs.length;i++)l.tick();
      assert.equal(l.G.projs.length,0,'Q projectile landed');
      const dealt=hp0-e.hp;near(dealt,expect.attack*16*expect.skill,'actual meteor damage');near(h.dm.sk,dealt,'skill attribution');
      while(h.skillCd>1/120+1e-8)l.tick();
      l.Skills.castSkill(e.g.position);assert.equal(l.G.projs.length,0,'Q remains locked before expiry');
      l.tick();if(h.skillCd>0)l.tick();l.Skills.castSkill(e.g.position);assert.equal(l.G.projs.length,1,'Q ready after expiry');

      // Real basic attack schedules a projectile; one stationary target, no armor.
      l.spawn();const basic=l.target(),basic0=basic.hp;l.tick(1/120,{basic:true});near(l.G.hero.cd,1/expect.rate,'attack interval');
      for(let i=0;i<600&&basic.hp===basic0;i++)l.tick(1/120,{basic:true});
      near(basic0-basic.hp,expect.attack,'actual basic damage');near(l.G.hero.dm.sk,0,'basic is not skill');
      // Critical force is confined to this VM; it never changes game RNG.
      l.setRoll(0);l.spawn();const crit=l.target(),crit0=crit.hp;
      for(let i=0;i<600&&crit.hp===crit0;i++)l.tick(1/120,{basic:true});
      near(crit0-crit.hp,expect.attack*((expect.q.crit||0)>0?1.5+(expect.q.critD||0)/100:1),'critical damage');l.setRoll(.999999);
      rows.push({set:key,name:state.name,step,action,pieces:count,active:state.tiers.filter(t=>t.active).map(t=>t.pieces),expected:expect,actual,
        q:{damage:dealt,cooldown:castCooldown},basicDamage:basic0-basic.hp,critDamage:crit0-crit.hp,html,pass:true});
    }
  }
  for(const key of [7,9]) {
    l.reset();l.seed(key);for(const s of l.E.SLOT_KEYS)l.equip(s);
    l.spawn();const realRange=l.Hero.stat.range(),items=structuredClone(l.save().inv);
    for(const it of l.save().inv){delete it.c;delete it.set;}
    l.spawn();const plainRange=l.Hero.stat.range(),distance=(plainRange+realRange)/2;
    l.target(distance);for(let i=0;i<360;i++)l.tick(1/120,{basic:true});
    check(`set ${key}: target outside item-only range is not hit`,l.G.hero.dm.tot===0);
    l.save().inv=items;l.spawn();l.target(distance);for(let i=0;i<360;i++)l.tick(1/120,{basic:true});
    check(`set ${key}: same target inside active set range is hit`,l.G.hero.dm.tot>0);
  }
  l.reset();l.seed(6);
  const critAcc=[0,.1,.2,.4,.6,.8,.99].map(r=>l.E.makeItem('acc','mage',0,()=>r,6)).find(it=>it.m[0]==='crit');
  assert.ok(critAcc,'valid Desert critical accessory fixture');critAcc.id='lab-2';l.save().inv[2]=critAcc;
  for(const s of l.E.SLOT_KEYS)l.equip(s);l.setRoll(0);l.spawn();const criticalTarget=l.target(),criticalHP=criticalTarget.hp;
  for(let i=0;i<600&&criticalTarget.hp===criticalHP;i++)l.tick(1/120,{basic:true});
  near(criticalHP-criticalTarget.hp,34*1.12*1.62,'Desert 6% set attack and 12% critical damage');
  check('Desert 3-piece critical bonus changes an actual critical hit',true);l.setRoll(.999999);
  l.reset();l.seed(5,1);for(const s of l.E.SLOT_KEYS)l.equip(s);const mage=l.spawn();
  l.Hero.heroDamage(50);check('increased hero HP is used by damage intake',mage.hp===mage.max-50);
  const atSpawn=JSON.stringify(mage.equippedSets),hp= mage.max;
  l.unequip('armor');check('ongoing battle snapshot is detached',JSON.stringify(mage.equippedSets)===atSpawn&&mage.max===hp);
  l.spawn();check('next sortie applies unequip',l.G.hero.equippedSets[0].count===2);
  check('wrong hero weapon denied',!l.equip('weapon','archer'));
  l.equip('armor');l.equip('armor','archer');
  check('shared armor belongs to only one hero',!l.save().eq.mage.armor&&!!l.save().eq.archer.armor);
  check('other hero has independent set state',l.Sets.setStatuses(l.save(),'archer').find(x=>x.key===5).count===1&&l.Sets.setStatuses(l.save(),'mage').find(x=>x.key===5).count===2);
  l.roundtrip();check('save keeps unique ownership',!l.save().eq.mage.armor&&!!l.save().eq.archer.armor);
  l.spawn();const partyMage=l.G.hero,archer=l.Hero.spawnHero('archer',{perm:{hp:0,atk:0},equip:l.E.bonus(l.save(),'archer'),heroGear:l.E.equippedItems(l.save(),'archer'),heroLevel:1,adv:null,legend:null,heroTree:null},true);
  check('two spawned heroes keep separate equipped-set snapshots',partyMage.equippedSets[0].count===2&&archer.equippedSets[0].count===1&&l.G.heroes.length===2);
  const inventory=l.save().inv.length;l.equip('weapon');l.equip('weapon');check('repeat equip does not duplicate inventory',l.save().inv.length===inventory);
  const armor=l.save().inv.find(it=>it.s==='armor');l.unequip('armor','archer');l.save().inv=l.save().inv.filter(it=>it.id!==armor.id);l.save().stor.push(armor);l.roundtrip();
  check('stored item cannot activate equipped tier',l.Sets.setStatuses(l.save(),'mage').find(x=>x.key===5).count===2&&l.Sets.setStatuses(l.save(),'archer').find(x=>x.key===5).count===0);
  l.reset();check('new isolated account has no carried gear',!l.save().inv.length&&!l.Sets.setStatuses(l.save(),'mage').some(x=>x.count));
  check('network and browser storage unavailable',await l.verifyIsolation());
  check('no authentication/config/server module imported',Object.keys(l.sourceHashes).every(p=>!p.includes('/config/')&&!p.includes('/server/')&&!p.includes('/firebase/')));
  check('audio is a silent recorder',l.mutedCalls.length>0);
  return {kind:'isolated Node engine fixture; not production account or graphical browser QA',baseCommit:'a6fe24c74c1bb930900afb25de30a7454672abcb',
    pass:true,scenarioCount:rows.length,boundaryCount:boundaries.length,rows,boundaries,sourceHashes:l.sourceHashes,substitutedModules:l.stubs,
    limitations:['Models, rendering, audio, terrain and special monster abilities are substituted.','Only base mage combat is exercised; other hero set ownership is checked.','Fixed 1/120 clock and forced critical samples are test-only.','No actual browser/UI interaction after the user stopped computer control.','No live equipment grant, authentication, Firestore request, cloud save or production mutation.']};
}

export function reportHtml(r) {
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=x=>Math.round(x*10000)/10000;
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>세트 격리 검증 결과</title><style>body{font:16px system-ui;background:#111522;color:#eef0ff;margin:2rem auto;padding:0 1rem;max-width:1080px}h1{font-size:24px}small,p{color:#bac4db}details{background:#20263a;padding:14px;margin:10px 0;border-radius:10px}summary{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:right;padding:8px;border-bottom:1px solid #39425e}.scroll{overflow:auto}.setCard{padding:12px;border:1px solid #485474;margin:12px 0}.setHead,.setTier{display:flex;justify-content:space-between;gap:15px}.setSlots{display:flex;gap:10px}.setTier{color:#8994b2;padding:6px}.setTier.active{color:#9ef6ba}.setHint{display:block}</style><h1>세트 장착·해제 / 전투 적용 검증</h1><p>운영판 코드 기반 격리 시험 · ${r.scenarioCount}개 장착 상태, ${r.boundaryCount}개 경계 통과. 실제 계정이나 브라우저 실전 검증 결과가 아닙니다.</p><p>마법사 Lv.1, 강화 0, 표적 방어 0. 실제 스킬·투사체·피해 함수가 실행됐으며 그래픽과 소리는 대체됐습니다.</p>${[...new Set(r.rows.map(x=>x.set))].map(key=>{const rows=r.rows.filter(x=>x.set===key);return `<details><summary>${escape(rows[0].name)} — 0→1→2→3→2→1→0</summary><div class="scroll"><table><tr><th>장착</th><th>체력</th><th>공격</th><th>공속</th><th>사거리</th><th>Q초</th><th>Q실제 피해</th><th>활성</th></tr>${rows.map(x=>`<tr><td>${x.pieces}</td><td>${x.actual.hp}</td><td>${format(x.actual.attack)}</td><td>${format(x.actual.rate)}</td><td>${format(x.actual.range)}</td><td>${format(x.q.cooldown)}</td><td>${format(x.q.damage)}</td><td>${escape(x.active.join(',')||'없음')}</td></tr>`).join('')}</table></div>${rows[3].html}</details>`;}).join('')}<h2>경계 검사</h2><ul>${r.boundaries.map(x=>`<li>✓ ${escape(x.name)}</li>`).join('')}</ul><h2>한계</h2><ul>${r.limitations.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></html>`;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const at=process.argv.indexOf('--out'),out=at>=0&&process.argv[at+1];
  if(!out)throw Error('Usage: node --experimental-vm-modules tools/set-lab/run.mjs --out <new-local-output-folder>');
  if(fs.existsSync(out))throw Error('Output folder exists; preserve previous evidence.');
  fs.mkdirSync(out,{recursive:true});
  let result;
  try {result=await runSuite();} catch(e) {fs.writeFileSync(path.join(out,'failure.txt'),e.stack);throw e;}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(out,'report.html'),reportHtml(result));
  console.log(JSON.stringify({pass:result.pass,scenarios:result.scenarioCount,boundaries:result.boundaryCount,loadedProductModules:Object.keys(result.sourceHashes).length}));
}
