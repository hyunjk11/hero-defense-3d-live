
import assert from 'node:assert/strict';
import {renderHeroEffects} from '../src/ui/hero-effects.js';
import {StatusNode} from './support/status-dom.mjs';
const el=new StatusNode(),doc=el.ownerDocument;
el.id='heroEffects';
const a={hp:100,max:100,dead:0,treeMods:{},eShield:{value:35,until:16}};
const b={hp:100,max:100,dead:0,treeMods:{},hardSlowUntil:20};
renderHeroEffects(el,a,{now:10});
const first=el.children[0],tip=doc.body.children[0];
assert.equal(first.tagName,'BUTTON');assert.equal(first.type,'button');
assert.equal(first.textContent,'🛡');assert.equal(first.getAttribute('aria-label'),'버프 · 성광 방벽 · 35 · 6.0초');
assert.equal(tip.hidden,true);
first.fire('pointerenter',{pointerType:'mouse'});
assert.equal(tip.hidden,false);assert.equal(tip.textContent,first.getAttribute('aria-label'));
assert.equal(first.getAttribute('aria-describedby'),tip.id);
a.eShield.value=23;renderHeroEffects(el,a,{now:12});
assert.equal(tip.textContent,'버프 · 성광 방벽 · 23 · 4.0초');
assert.equal(el.children[0],first);assert.equal(first.writes,1);
first.fire('pointerleave');assert.equal(tip.hidden,true);
first.fire('focus');assert.equal(tip.hidden,false);
doc.fire('keydown',{key:'Escape'});assert.equal(tip.hidden,true);
first.fire('blur');first.fire('pointerenter',{pointerType:'touch'});assert.equal(tip.hidden,true);
first.fire('focus');first.fire('click');assert.equal(tip.hidden,false);
first.fire('pointerleave');assert.equal(tip.hidden,false);
first.fire('click');assert.equal(tip.hidden,true);
first.fire('click');doc.fire('pointerdown',{target:new StatusNode(doc)});assert.equal(tip.hidden,true);
first.fire('focus');el.scrollTop=60;el.scrollLeft=20;renderHeroEffects(el,b,{now:10});
assert.equal(tip.hidden,true);assert.equal(el.scrollTop,0);assert.equal(el.scrollLeft,0);
assert.equal(el.children.length,1);assert.equal(el.children[0].textContent,'❄');
assert.equal(el.children[0].getAttribute('aria-label'),'디버프 · 빙판 둔화 · 이속 −20% · 10.0초');
el.children[0].fire('focus');renderHeroEffects(el,b,{now:20});
assert.equal(el.hidden,true);assert.equal(tip.hidden,true);assert.equal(el.children.length,0);
renderHeroEffects(el,a,{now:10});el.children[0].fire('focus');el.fire('scroll');assert.equal(tip.hidden,true);
const fixed={hp:100,max:100,dead:0,treeMods:{},mech:{inv:true,shield:40}};
renderHeroEffects(el,fixed);
assert.equal(el.children[0].getAttribute('aria-label'),'버프 · 무적');
assert.equal(el.children[1].getAttribute('aria-label'),'버프 · 기계 보호막 · 40');
const original=JSON.stringify(fixed);for(let i=0;i<30;i++)renderHeroEffects(el,fixed);assert.equal(JSON.stringify(fixed),original);
for(const width of [320,390,600,768,1024,1440]){
 doc.defaultView.innerWidth=width;
 for(const left of [0,width-32]){
  el.children[0].rect={left,top:120,width:32,height:32};tip.rect={left:0,top:0,width:240,height:64};
  el.children[0].fire('focus');
  assert.ok(parseFloat(tip.style.left)>=8);
  assert.ok(parseFloat(tip.style.left)+240<=width-8);
  assert.ok(parseFloat(tip.style.top)+64<120);
 }
}
console.log('PASS effect icons: actual values/timers, hover, keyboard, touch, dismiss, expiry, control switch, no mutation, viewport tooltip bounds');
