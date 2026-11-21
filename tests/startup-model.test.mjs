import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStartupModel, STARTUP_MODEL_TIMEOUT_MS } from '../src/render/startup-model.js';

const path='models/mage_meshy.glb', base='https://example.test/game/?town=1';
const response = data => ({ok:true,arrayBuffer:async()=>data});
const expectedURL='https://example.test/game/'+path, expectedRoot='https://example.test/game/models/';
const ok = () => response(new ArrayBuffer(20));
test('healthy startup uses cache normally and parses the model relative to its own directory',async()=>{
  const calls=[], parsed=[];
  const result=await loadStartupModel({parseAsync(data,root){parsed.push([data.byteLength,root]);return 'model';}},path,{base,fetchModel:async (url,opts)=>{calls.push([url,opts.cache,opts.signal.aborted]);return ok();}});
  assert.equal(result,'model');assert.deepEqual(calls,[[expectedURL,'default',false]]);assert.deepEqual(parsed,[[20,expectedRoot]]);
});
test('a failed HTTP fetch is retried once, asking the browser to reload the asset',async()=>{
  const cache=[];
  const result=await loadStartupModel({parseAsync:()=>42},path,{base,fetchModel:async (_,opt)=>{cache.push(opt.cache);return cache.length===1?{ok:false,status:503}:ok();}});
  assert.equal(result,42);assert.deepEqual(cache,['default','reload']);
});
test('a stalled download, including a stalled response body, is aborted; a late body is never parsed',async()=>{
  const calls=[], parsed=[];let old;
  const result=await loadStartupModel({parseAsync(data){parsed.push(data.byteLength);return 'new';}},path,{base,timeout:15,fetchModel:async (_,opt)=>{
    calls.push(opt);return opt.cache==='default'?{ok:true,arrayBuffer:()=>new Promise(resolve=>{old=resolve;})}:ok();
  }});
  assert.equal(result,'new');assert.equal(calls[0].signal.aborted,true);assert.equal(calls[1].signal.aborted,false);
  old(new ArrayBuffer(80));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(parsed,[20]);
});
test('two pending requests reject after two bounded attempts, with both aborted',async()=>{
  const calls=[];
  await assert.rejects(loadStartupModel({parseAsync:()=>assert.fail('no body')},path,{base,timeout:15,fetchModel:(_,opt)=>{calls.push(opt);return new Promise(()=>{});}}),/Startup model timed out/);
  assert.deepEqual(calls.map(x=>[x.cache,x.signal.aborted]),[['default',true],['reload',true]]);
  assert.equal(STARTUP_MODEL_TIMEOUT_MS,12000);
});
test('late decode from the timed-out attempt cannot replace the successful retry',async()=>{
  let old;let parses=0;
  const result=await loadStartupModel({parseAsync(){if(++parses===1)return new Promise(resolve=>{old=resolve;});return 'new';}},path,{base,timeout:15,fetchModel:async()=>ok()});
  old('old');assert.equal(result,'new');assert.equal(parses,2);
});
test('double failure remains a failure, with no third automatic request',async()=>{
 let attempts=0;
 await assert.rejects(loadStartupModel({parseAsync:()=>assert.fail('invalid HTTP')},path,{base,fetchModel:async()=>{attempts++;return {ok:false,status:503};}}),/HTTP 503/);
 assert.equal(attempts,2);
});
test('PC boot owns recovery; mobile, practice, and direct runs use the legacy path',()=>{
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/const recoverPCStartup = !mobileApp && !QS.has\('run'\) && QS.get\('practice'\) !== '1'/);
 assert.match(main,/loadAssets\(PLAN.first, recoverPCStartup\)/);
 assert.match(main, /if \(!recoverPCStartup\)[\s\S]+?querySelector\('\.spin'\).classList.add\('hidden'\)[\s\S]+?\$\('loadRetry'\).classList.remove\('hidden'\)/);
});

test('lazy gameplay ensureModels never routes arguments through the startup retry path',async()=>{
 const { runInNewContext }=await import('node:vm');
 const src=fs.readFileSync(new URL('../src/render/characters.js',import.meta.url),'utf8');
 const section=src.slice(src.indexOf('const LOADING ='),src.indexOf('function prep(g)'));
 const legacy=[], applied=[];
 class GLTFLoader{setMeshoptDecoder(){}loadAsync(p){legacy.push(p);return Promise.resolve({});}}
 const api=runInNewContext(section+';({ensureModels,loadAssets})',{GLTFLoader,MeshoptDecoder:{},HIDDEN_ASSETS:[],MESHY:{},GL:{},$:()=>null,prep(){},loadStartupModel(_,p){applied.push(p);return Promise.resolve({});}});
 await api.ensureModels(['a','b','c']);await api.loadAssets(['d','e'],false);await api.loadAssets(['f','g'],true);
 assert.deepEqual(legacy,['models/a.glb','models/b.glb','models/c.glb','models/d.glb','models/e.glb']);
 assert.deepEqual(applied,['models/f.glb','models/g.glb']);
});

test('a late sibling model cannot overwrite the failed PC startup screen',async()=>{
 const { runInNewContext }=await import('node:vm');
 const src=fs.readFileSync(new URL('../src/render/characters.js',import.meta.url),'utf8');
 const section=src.slice(src.indexOf('const LOADING ='),src.indexOf('function prep(g)'));
 const text={textContent:'Loading'};let succeed;
 class GLTFLoader{setMeshoptDecoder(){}}
 const loadAssets=runInNewContext(section+';loadAssets',{GLTFLoader,MeshoptDecoder:{},HIDDEN_ASSETS:[],MESHY:{},GL:{},$:()=>text,prep(){},loadStartupModel(_,p){
   return p==='models/fail.glb' ? Promise.reject(new Error('503')) : new Promise(r=>{succeed=r;});
 }});
 await assert.rejects(loadAssets(['fail','late'],true),/503/);
 text.textContent='Failed';
 succeed({});await new Promise(r=>setImmediate(r));
 assert.equal(text.textContent,'Failed');
});

test('a late decoded GLB disposes each of its resources once and never disposes the winner',async()=>{
 let resolveLate;const calls=[], counts={geometry:0,material:0,texture:0,image:0};
 const image={close(){counts.image++;}},texture={isTexture:true,source:{data:image},dispose(){counts.texture++;}};
 const material={map:texture,normalMap:texture,dispose(){counts.material++;}},geometry={dispose(){counts.geometry++;}};
 const old={scenes:[{traverse(visit){visit({geometry,material:[material,material]});visit({geometry,material});}}]};
 const winner={scene:{traverse(){assert.fail('winner must remain intact');}}};
 const result=await loadStartupModel({parseAsync(){return calls.length===1?new Promise(r=>{resolveLate=r;}):winner;}},path,{base,timeout:15,fetchModel:async(_,opt)=>{calls.push(opt.cache);return ok();}});
 assert.equal(result,winner);resolveLate(old);await new Promise(r=>setImmediate(r));
 assert.deepEqual(counts,{geometry:1,material:1,texture:1,image:1});
});
