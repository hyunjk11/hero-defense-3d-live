import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isMobilePage} from '../src/ui/mobile-mode.js';
import {navQuery} from '../src/core/nav.js';

const root='https://hyunjk11.github.io/hero-defense-3d-live/';
test('mobile UI is enabled only on the real Pages game and only when requested', () => {
  for(const url of [root, root+'?mobileApp=0', root+'?stage=1-1', root+'other.html?mobileApp=1',
    'https://other.example/hero-defense-3d-live/?mobileApp=1',
    'http://hyunjk11.github.io/hero-defense-3d-live/?mobileApp=1']) assert.equal(isMobilePage(new URL(url)),false);
  for(const entry of [root,root+'index.html']) assert.equal(isMobilePage(new URL(entry+'?mobileApp=1')),true);
});
test('town, stage, hard, challenge, practice, dungeon and spire keep mobile controls on navigation', () => {
  for(const to of [{town:true},{stage:'1-1'},{stage:'hard-7-6'},{challenge:true},{practice:true},{dungeon:true},{spire:3}]) {
    assert.equal(isMobilePage(new URL(root+'?'+navQuery('?mobileApp=1&town=1',to))),true);
    assert.equal(isMobilePage(new URL(root+'?'+navQuery('?town=1',to))),false);
  }
});
