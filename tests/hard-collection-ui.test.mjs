import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as P from '../src/account/progress.js';import * as E from '../src/account/equip.js';
import * as ST from '../src/data/stages.js';import {CLASSES,heroLabel} from '../src/data/heroes.js';
import {CHSET,CH_KEYS,CODEX_RW} from '../src/data/items.js';
import {COLLECTION_ODDS,optionalCollectionGrade} from '../src/data/hard-collection.js';
import {MORVIA,MORVIA_HEROES} from '../src/data/boss-sets.js';
import {setStatuses,setDefinition} from '../src/account/set-status.js';
const ui=new URL('../src/ui/',import.meta.url);
function fixture(features={hardCollection:1}){
 const body={innerHTML:''},buttons=[];let tip='';
 const deps={P,E,ST,CLASSES,heroLabel,MORVIA,MORVIA_HEROES,setStatuses,setDefinition,SLOTS:E.SLOTS,STAT:E.STAT,CHSET,CH_KEYS,CODEX_RW,optionalCollectionGrade,HG:{available:()=>true,HG:{features}},
  $:()=>body,document:{querySelectorAll:s=>s.endsWith('.cxC')?buttons:[]},Acc:{update(){}},Snd:{play(){}},
  esc:s=>s,iconKey:s=>s,weaponIcon:s=>s,icon:()=>'<i>item</i>',clsN:s=>s,GC:g=>'#fff',card:it=>'card '+it.g,
  showTip:(_b,s)=>tip=s,hideTip(){}};
 const view=fs.readFileSync(new URL('setview.js',ui),'utf8').replace(/^import .*;[^\r\n]*\r?\n/gm,'').replace(/\bexport /g,'');
 Object.assign(deps,new Function(...Object.keys(deps),view+';return {setCard};')(...Object.values(deps)));
 const source=fs.readFileSync(new URL('codex.js',ui),'utf8').replace(/^import .*;[^\r\n]*\r?\n/gm,'').replace(/\bexport /g,'');
 const {renderCodex}=new Function(...Object.keys(deps),source+';return {renderCodex};')(...Object.values(deps));
 return {render(s,ch){buttons.length=0;const b={dataset:{ch,row:'mage',g:0,extra:optionalCollectionGrade(ch,0)&&(features.hardCollection||P.codexBits(s,ch,'mage')&1)?'1':'0'},classList:{contains:c=>c==='seen'?!!(P.codexBits(s,ch,'mage')&1):c==='na'&&!(features.hardCollection&&ch<=5)}};buttons.push(b);renderCodex(s,{ui:{cxTab:ch},tipLater(){}});b.onclick();return {html:body.innerHTML,tip};}};
}
test('H3..5 white cells become optional collection while 28 completion cells and claims remain unchanged',()=>{
 const f=fixture();for(const ch of [3,4,5]){const s=P.empty();s.codex[ch]=Object.fromEntries(P.codexRows().map(r=>[r,30]));const before=f.render(s,ch);
  assert.match(before.html,/추가 수집 0\/7/);assert.match(before.html,/도감 수집 <b>28\/28/);assert.match(before.html,/🏆 완성 보상 받기/);assert.match(before.tip,/추가 수집 · 완성 보상 제외 · 미획득/);assert.doesNotMatch(before.tip,/나오지 않아요/);
  E.codexAdd(s,E.makeItem('weapon','mage',0,()=>.1,ch));const seen=f.render(s,ch);assert.match(seen.html,/추가 수집 1\/7/);assert.match(seen.html,/28\/28/);assert.doesNotMatch(seen.tip,/미획득/);
 }
});
test('old-server cells remain unavailable until supported, but previously owned white gear is still visible',()=>{
 const f=fixture({}),s=P.empty();assert.doesNotMatch(f.render(s,5).html,/추가 수집 0\/7/);assert.match(f.render(s,5).tip,/나오지 않아요/);
 E.codexAdd(s,E.makeItem('weapon','mage',0,()=>.1,5));assert.match(f.render(s,5).html,/추가 수집 1\/7/);assert.match(f.render(s,5).tip,/추가 수집/);
 assert.doesNotMatch(fixture().render(P.empty(),6).html,/추가 수집/);assert.match(fixture().render(P.empty(),6).tip,/나오지 않아요/);
});
test('existing drop preview keeps high-grade odds separate from additional 50/35/15 and adds no panel',()=>{
 const source=fs.readFileSync(new URL('stagesel.js',ui),'utf8'),part=source.slice(source.indexOf('function dropHtml'),source.indexOf('let tipT'));
 const render=new Function('E','GRADES','COLLECTION_ODDS','weaponIcon','iconKey',part+';return dropHtml;')(E,E.GRADES,COLLECTION_ODDS,()=>'',()=>''),d=P.dropPreview('hard-5-1','mage');
 const old=render(d),now=render(d,2);assert.ok(now.includes(old.slice(0,-6)));assert.match(now,/추가 상자 2개 · 일반 50% · 고급 35% · 희귀 15%/);assert.doesNotMatch(old,/추가 상자/);assert.doesNotMatch(now,/<dialog|confirm|panel/i);
});
