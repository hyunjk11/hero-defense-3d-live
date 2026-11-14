import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script id="bootRecovery">([\s\S]*?)<\/script>/)[1];
assert.ok(html.indexOf('id="bootRecovery"')<html.indexOf('type="module" src="src/main.js"'));
assert.ok(!/fetch|localStorage|sessionStorage|Math\.random|import\(/.test(source));
function fixture(hidden=false){
 const classes=()=>({values:new Set(),contains(v){return this.values.has(v);},add(v){this.values.add(v);},remove(v){this.values.delete(v);}});
 const loading={classList:classes()},listeners=new Map(),events=new Map();
 if(hidden)loading.classList.add('hidden');
 const retry={classList:classes(),disabled:false,addEventListener(k,f){listeners.set(k,f);},removeEventListener(k){listeners.delete(k);}};retry.classList.add('hidden');
 const text={textContent:'loading'};let timer,delay,cleared=0,disconnected=0,observer,reloads=0;
 const context={document:{getElementById:id=>({loading,loadRetry:retry,loadTxt:text}[id])},window:{addEventListener(k,f){events.set(k,f);},removeEventListener(k){events.delete(k);},location:{reload(){reloads++;}}},setTimeout(f,ms){timer=f;delay=ms;return 7;},clearTimeout(id){assert.equal(id,7);cleared++;},MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){disconnected++;}}};
 vm.runInNewContext(source,context);
 return {loading,retry,text,events,listeners,expire:()=>timer(),finish:()=>{loading.classList.add('hidden');observer();},stats:()=>({delay,cleared,disconnected,reloads})};
}
let a=fixture();assert.equal(a.retry.classList.contains('hidden'),true);assert.equal(a.stats().delay,30000);
a.finish();a.expire();assert.equal(a.retry.classList.contains('hidden'),true);assert.equal(a.events.size,0);assert.equal(a.listeners.size,0);assert.equal(a.stats().disconnected,1);
let b=fixture();b.events.get('error')({target:{tagName:'IMG'}});assert.equal(b.retry.classList.contains('hidden'),true);
b.events.get('error')({target:{tagName:'SCRIPT'}});assert.equal(b.retry.classList.contains('hidden'),false);assert.notEqual(b.text.textContent,'loading');
const click=b.listeners.get('click');click();click();assert.equal(b.stats().reloads,1);assert.equal(b.retry.disabled,true);
let c=fixture();c.expire();c.expire();assert.equal(c.retry.classList.contains('hidden'),false);assert.equal(c.text.textContent,'loading');assert.equal(c.stats().reloads,0);
c.finish();assert.equal(c.retry.classList.contains('hidden'),true);assert.equal(c.stats().disconnected,1);
let d=fixture(true);assert.equal(d.listeners.size,0);assert.equal(d.events.size,0);
console.log('PASS: normal cleanup, module failure, 30s non-automatic retry, double click, late success, no storage/network changes');
