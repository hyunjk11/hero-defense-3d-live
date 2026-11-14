// Exercise the real chest controller through its buttons, including batches without legendary items.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';

const source = readFileSync(new URL('../src/ui/chest.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replace(/\bexport /g, '');
function fixture(grades, inventory = 0) {
  let save = P.empty(), writes = 0, done = 0, smith = 0;
  save.inv = Array.from({ length: inventory }, () => E.makeItem('armor', 'mage', 0));
  E.addChests(save, grades.map(g => ({ it: E.makeItem('weapon', 'archer', g), src: 'chest' })));
  const originalIds = save.chests.map(c => c.it.id), timers = [], nodes = new Map();
  const element = () => {
    const classes = new Set();
    return { classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      style: { setProperty() {} }, dataset: {}, innerHTML: '', onclick: null, disabled: false };
  };
  const overlay = element(); overlay.classList.add('hidden');
  let html = '', stage = null, tiles = [];
  Object.defineProperty(overlay, 'innerHTML', { get: () => html, set(value) {
    html = value; nodes.clear(); nodes.set('chestOv', overlay);
    for (const match of value.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], element());
    stage = value.includes('cvStage') ? element() : null;
    tiles = [...value.matchAll(/data-i="(\d+)"/g)].map(m => Object.assign(element(), { dataset: { i: m[1] } }));
  } });
  overlay.querySelector = selector => selector === '.cvStage' ? stage : null;
  overlay.querySelectorAll = selector => selector === '.sumT' ? tiles : tiles.filter(t => t.classList.contains('sel'));
  overlay.contains = node => node === stage;
  nodes.set('chestOv', overlay);
  const Acc = { A: {user: null}, sessionId: () => 0, load: () => save, update(fn) { writes++; save = fn(save); } };
  const context = { Acc, E, directGearEnabled: () => false, runDirectGear: () => {throw Error('unexpected direct transaction in Worker fixture');}, $: id => nodes.get(id), Snd: { play() {} },
    icon: () => 'icon', setOf: () => null, GCi: () => '#fff', GC: () => '#fff', card: it => `item:${it.id}`,
    document: { querySelectorAll: () => [], querySelector: () => null }, setTimeout: fn => timers.push(fn) };
  vm.runInNewContext(source + '\nthis.chest = {initChest, openChestUI};', context);
  const ui = {};
  context.chest.initChest({ ui, S: Acc.load, hooks: () => ({ onChange() {} }), closeInv() {}, closeSmith() {},
    hideTip() {}, showTip() {}, openSmith() { smith++; } });
  context.chest.openChestUI(() => { done++; });
  const click = id => { const button = nodes.get(id); assert.equal(typeof button?.onclick, 'function', `${id} click is wired`); button.onclick({ stopPropagation() {} }); };
  const flush = () => { while (timers.length) timers.shift()(); };
  return { click, flush, nodes, overlay, ui, originalIds, tiles: () => tiles,
    state: () => ({ save, writes, done, smith }) };
}

for (const grades of [[0, 1, 2, 3], [0, 0], [3, 3], [4, 0]]) {
  const f = fixture(grades);
  f.click('cbAll'); f.flush();
  assert.equal(f.state().save.inv.length, grades.length);
  assert.equal(f.state().save.chests.length, 0);
  f.tiles()[0].onclick();
  assert.match(f.nodes.get('cbDetail').innerHTML, /^item:/);
  f.click('cbOk');
  assert.ok(f.overlay.classList.contains('hidden'));
  assert.equal(f.state().done, 1);
  assert.equal(f.state().writes, 1, 'confirmation does not grant rewards again');
  assert.deepEqual(f.state().save.inv.map(it => it.id), f.originalIds);
}
{
  const f = fixture(Array(12).fill(1));
  f.click('cbTen'); f.flush();
  assert.equal(f.state().save.chests.length, 2);
  f.click('cbMore'); f.click('cbAll'); f.flush(); f.click('cbOk');
  assert.equal(f.state().save.inv.length, 12);
  assert.equal(f.state().save.chests.length, 0);
  assert.equal(f.state().writes, 2);
  assert.equal(f.state().done, 1);
}
{
  const f = fixture([0, 1, 2, 3], E.CAP - 1);
  f.click('cbAll'); f.flush();
  assert.equal(f.state().save.inv.length, E.CAP);
  assert.equal(f.state().save.chests.length, 3);
  f.click('cbSmith');
  assert.ok(f.overlay.classList.contains('hidden'));
  assert.equal(f.ui.smTab, 'dis');
  assert.equal(f.state().smith, 1);
  assert.equal(f.state().done, 1);
  assert.equal(f.state().writes, 1);
}
console.log('chest-ui.test ok: grade combinations, details, confirm, remaining batch, full bag, no duplicate rewards');
