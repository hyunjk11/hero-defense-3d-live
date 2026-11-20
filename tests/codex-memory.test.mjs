import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCodexMemory } from '../src/ui/codex-memory.js';
const keys = [1, 2, 10, 'dungeon_set'];
const node = () => { const listeners = new Set(); return { scrollTop: 0, scrollLeft: 0, addEventListener(_, f) { listeners.add(f); }, removeEventListener(_, f) { listeners.delete(f); }, scroll() { for (const f of listeners) f(); }, listeners }; };
const store = () => { let value; return { getItem: () => value, setItem: (_, v) => { value = v; } }; };
test('chapter/dungeon positions survive tab switches, close and same-tab reload without opening UI', () => {
 const storage = store(), m = createCodexMemory(() => storage, keys), panel = node(), grid = node();
 assert.equal(m.outer(), 'bag'); m.outerChanged('codex'); m.mount(2, panel, grid);
 panel.scrollTop = 412; grid.scrollLeft = 193; grid.scroll(); m.leave();
 assert.equal(panel.listeners.size, 0); assert.equal(grid.listeners.size, 0);
 m.mount('dungeon_set', panel, null); assert.equal(panel.scrollTop, 0); panel.scrollTop = 77; m.leave();
 m.mount(2, panel, grid); assert.equal(panel.scrollTop, 412); assert.equal(grid.scrollLeft, 193); m.leave();
 const reload = createCodexMemory(() => storage, keys); assert.equal(reload.tab(), 2); assert.equal(reload.outer(), 'codex');
 reload.mount('dungeon_set', panel, null); assert.equal(panel.scrollTop, 77); reload.leave();
});
test('other outer tabs and explicit bag win without contaminating codex scroll', () => {
 const storage = store(), m = createCodexMemory(() => storage, keys), panel = node();
 m.outerChanged('codex'); m.mount(10, panel, null); panel.scrollTop = 201; m.leave();
 for (const tab of ['bag', 'stor', 'presets']) { m.outerChanged(tab); panel.scrollTop = 999; panel.scroll(); assert.equal(createCodexMemory(() => storage, keys).outer(), 'bag'); }
 m.outerChanged('codex'); m.mount(10, panel, null); assert.equal(panel.scrollTop, 201); m.leave();
});
test('scroll events persist before reload and rerenders do not accumulate listeners', () => {
 const storage = store(), m = createCodexMemory(() => storage, keys), panel = node(), grid = node();
 m.mount(1, panel, grid); panel.scrollTop = 33; grid.scrollLeft = 44; panel.scroll();
 const reload = createCodexMemory(() => storage, keys), p = node(), g = node(); reload.mount(1, p, g); assert.equal(p.scrollTop, 33); assert.equal(g.scrollLeft, 44);
 for (let i = 0; i < 20; i++) m.mount(1, panel, grid);
 assert.equal(panel.listeners.size, 1); assert.equal(grid.listeners.size, 1); m.leave();
});
test('blocked storage, corrupt/unknown keys and excessive positions are safe', () => {
 for (const raw of ['{', '{}', JSON.stringify({tab: 'unknown', codex: true})]) { const m = createCodexMemory(() => ({getItem: () => raw}), keys); assert.equal(m.tab(), 1); assert.equal(m.outer(), 'bag'); }
 const m = createCodexMemory(() => { throw Error('blocked'); }, keys), panel = node(); m.outerChanged('codex'); m.mount(2, panel, null); panel.scrollTop = 30; m.leave(); m.mount(2, panel, null); assert.equal(panel.scrollTop, 30);
 const n = createCodexMemory(() => ({getItem: () => JSON.stringify({tab: 2, positions: {2: [-2, 1e20], unknown: [4,5]}})}), keys), grid = node(); n.mount(2, panel, grid); assert.equal(panel.scrollTop, 0); assert.equal(grid.scrollLeft, 100000);
});
test('integration captures before DOM changes and restores only codex real scrollers', () => {
 const gear = fs.readFileSync(new URL('../src/ui/gear.js', import.meta.url), 'utf8'), codex = fs.readFileSync(new URL('../src/ui/codex.js', import.meta.url), 'utf8');
 assert.match(gear, /invTab: codexMemory.outer\(\), cxTab: codexMemory.tab\(\)/);
 assert.match(gear, /function closeInv\(\) \{ codexMemory.leave\(\)/);
 assert.match(gear, /function openInv\(tab\) \{ codexMemory.leave\(\); if \(tab === 'stor' \|\| tab === 'bag' \|\| tab === 'codex'\) ui.invTab = tab/);
 assert.ok(gear.indexOf('codexMemory.outerChanged(ui.invTab)') < gear.indexOf("$('invTabs').innerHTML"));
 assert.match(codex, /codexMemory.mount\(ui.cxTab, \$\('invPanel'\), \$\('codexBody'\).querySelector\('\.cxGridScroll'\)\)/);
});
test('Android mode remains entirely inert, including storage and scrollers', () => {
 const m = createCodexMemory(() => { throw Error('must not access storage'); }, keys, false), panel = node();
 panel.scrollTop = 82; m.outerChanged('codex'); m.mount(10, panel, null); m.leave();
 assert.equal(m.tab(), 1); assert.equal(m.outer(), 'bag'); assert.equal(panel.scrollTop, 82); assert.equal(panel.listeners.size, 0);
});
