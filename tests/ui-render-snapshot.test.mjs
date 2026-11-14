import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture} from './ui-render-fixture.mjs';
const root=process.argv[2]||path.resolve(import.meta.dirname,'..');
test('one town panel refresh uses one decoded save without mutating it',async()=>{
 const f=await fixture(root,{items:100,hero:'mage',branch:'frost'});const original=f.raw();f.render();f.resetReads();f.refresh();
 assert.equal(f.readCount(),1);assert.equal(f.raw(),original);assert.match(f.$('statDetails').innerHTML,/블리자드/);
});
test('fresh refresh reflects equipment, permanent upgrades and re-specialization',async()=>{
 const f=await fixture(root,{items:100,hero:'mage',branch:'frost'});f.render();const old=f.$('statDetails').innerHTML;
 f.update(s=>{s.heroLv.mage.atk=5;s.adv.mage={b:'flame',n:2};s.eq.mage.weapon=s.inv.find(i=>i.s==='weapon'&&i.h==='mage').id;});
 f.refresh();assert.notEqual(f.$('statDetails').innerHTML,old);assert.doesNotMatch(f.$('statDetails').innerHTML,/블리자드/);
 assert.equal(f.stats.townData('mage').L.perm.atk,5);
});
test('target edits read a fresh snapshot instead of a cached render',async()=>{
 const f=await fixture(root,{hero:'warrior',level:9});f.render();const before=f.$('xpPreview').innerHTML;
 f.update(s=>{s.heroLv.warrior.hp=2;});f.$('xpTarget').value=10;f.resetReads();f.$('xpTarget').oninput();
 assert.equal(f.readCount(),1);assert.notEqual(f.$('xpPreview').innerHTML,before);assert.match(f.$('xpPreview').innerHTML,/이번 투자로 해금/);
});
test('new account and level update discard the previous preview and target',async()=>{
 const f=await fixture(root,{hero:'mage',level:40,branch:'frost'});f.render();f.$('xpTarget').value=49;
 f.switchAccount();f.refresh();assert.match(f.$('xpHero').textContent,/Lv\.1/);assert.equal(+f.$('xpTarget').value,2);assert.equal(f.$('xpBalance').textContent,'0');assert.match(f.$('heroTree').innerHTML,/전직 후 해금/);
});
test('max level, unavailable growth and invalid target remain disabled',async()=>{
 const max=await fixture(root,{level:50});max.render();assert.equal(max.$('xpConfirm').disabled,true);assert.equal(max.$('xpControls').classList.contains('hidden'),true);
 const offline=await fixture(root,{enabled:false});offline.render();assert.equal(offline.$('xpConfirm').disabled,true);
 const f=await fixture(root);f.render();f.$('xpTarget').value='NaN';f.$('xpTarget').oninput();assert.equal(f.$('xpConfirm').disabled,true);assert.match(f.$('xpPreview').innerHTML,/정수 레벨/);
});
test('asynchronous investment completion uses latest account state',async()=>{
 const f=await fixture(root);f.render();let release,calls=0;f.HG.invest=()=>{calls++;return new Promise(r=>release=r);};
 const request=f.growth.confirm();await Promise.resolve();assert.equal(calls,1);assert.equal(f.$('xpConfirm').disabled,true);
 await f.growth.confirm();assert.equal(calls,1);f.switchAccount();f.refresh();release({ok:true,level:31,cost:1260});await request;
 assert.match(f.$('xpHero').textContent,/Lv\.1/);assert.equal(f.$('xpBalance').textContent,'0');assert.doesNotMatch(f.$('xpMessage').textContent,/완료/);
});
