
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
const src=fs.readFileSync(new URL('../src/ui/select.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export \{[^}]+\};/g,'');
let disposed=0;const scene=new THREE.Scene(),els=new Map(),get=id=>{if(!els.has(id))els.set(id,{classList:{add(){},remove(){}},textContent:''});return els.get(id)};
const sandbox={THREE,scene,AbortController,$:get,GH:8,G:{},VISIBLE_HEROES:['mage','warrior'],modelsReady:()=>true,heroAssets:c=>[c],makeHeroModel:()=>({g:new THREE.Group(),mixer:{update(){}},ring:{material:{},scale:{setScalar(){}}}}),play(){},disposeHeroModel(ch){disposed++;ch.g.removeFromParent()},disposeOwned(){},mk(){},toon(){},rnd(){},cam:{target:{set(){}}},document:{querySelectorAll:()=>[]},Snd:{play(){}},heroOwned:()=>true,console};
vm.createContext(sandbox);vm.runInContext(src+';globalThis.show=showSelect;',sandbox);
for(let i=0;i<100;i++)sandbox.show();
assert.equal(scene.children.length,1,'Repeated showSelect must retain one podium');assert.equal(disposed,198);
console.log('PASS repeated showSelect 100 cycles retains one podium/two heroes and disposes previous 198 models');
const full=fs.readFileSync(new URL('../src/render/characters.js',import.meta.url),'utf8'),part=full.slice(full.indexOf('const LOADING ='),full.indexOf('async function loadAssets'));
const loaders=new Map();class Loader{setMeshoptDecoder(){}loadAsync(url){return new Promise((resolve,reject)=>loaders.set(url,{resolve,reject}))}}
const context={GL:{},GLTFLoader:Loader,MeshoptDecoder:{},HIDDEN_ASSETS:[],MESHY:{},prep(){},console:{warn(){}},AbortController};
vm.createContext(context);vm.runInContext(part+';globalThis.api={whenModels,loadModel,waitCount:()=>WAIT.size??WAIT.length};',context);
const {api}=context;const controller=new AbortController();const canceled=api.whenModels(['missing'],{signal:controller.signal}).catch(e=>e.name);controller.abort();assert.equal(await canceled,'AbortError');assert.equal(api.waitCount(),0);
const failed=api.whenModels(['missing']).then(()=>false,e=>e.message);const load=api.loadModel('missing').catch(e=>e.message);loaders.get('models/missing.glb').reject(new Error('404'));assert.equal(await failed,'404');assert.equal(await load,'404');assert.equal(api.waitCount(),0);assert.equal(await api.whenModels(['missing']).catch(e=>e.message),'404');
const fallback=api.whenModels(['seoyun_meshy']);const fl=api.loadModel('seoyun_meshy');loaders.get('models/seoyun_meshy.glb').reject(new Error('404'));await new Promise(r=>setTimeout(r,0));loaders.get('models/warrior_meshy.glb').resolve({animations:[]});await fl;await fallback;assert.equal(api.waitCount(),0);
console.log('PASS model waiter cancellation, 404 rejection, late subscription and fallback success release all waiters');


const retried=api.loadModel('missing');const retryWait=api.whenModels(['missing']);assert.equal(api.waitCount(),1);loaders.get('models/missing.glb').resolve({animations:[]});await retried;await retryWait;assert.equal(api.waitCount(),0);
console.log('PASS failed model retry clears recorded failure and resolves new waiter normally');
