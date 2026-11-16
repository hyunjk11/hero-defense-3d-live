import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {navQuery} from '../src/core/nav.js';
const terrain=fs.readFileSync(new URL('../src/world/terrain.js',import.meta.url),'utf8');
const util=fs.readFileSync(new URL('../src/core/util.js',import.meta.url),'utf8');
const generator=terrain.slice(terrain.indexOf('function genMap()'),terrain.indexOf('// 던전 원정 동굴 방'));
const mulberry=util.slice(util.indexOf('function mulberry32'),util.indexOf('// HTML'));
const flow=fs.readFileSync(new URL('../src/ui/flow.js',import.meta.url),'utf8');
function map(seed){const c={seed,STAGE:null,DUNGEON:false,G:{tiles:[]},GW:24,GH:16,SPAWN:[0,8],CORE:[22,7],SPAWNS:[[0,8]],T:{GRASS:0,CARVED:1,DIRT:2,FOREST:3,ROCK:4,BEDROCK:5,SPAWN:6,CORE:7},BLK:{2:{hp:100},3:{hp:180},4:{hp:300}},LAVA:[],WALLS:[]};vm.runInNewContext(mulberry+generator+'genMap();',c);return c.G.tiles;}
const signature=m=>m.map(col=>col.map(t=>t.t).join('')).join('|');
test('new challenge replaces even inherited seed and clears other modes without changing combat RNG',()=>{let search='?stage=hard-6-6&dungeon=1&spire=10&town=1&run=1&seed=42&rng=99';for(let i=0;i<100;i++){const old=new URLSearchParams(search),q=new URLSearchParams(navQuery(search,{challenge:true}));assert.equal(q.get('challenge'),'1');assert.equal(q.get('run'),'1');assert.equal(q.get('rng'),'99');assert.notEqual(q.get('seed'),old.get('seed'));for(const key of ['stage','dungeon','spire','town'])assert.equal(q.has(key),false);search=q.toString();}});
test('other modes clear challenge but preserve prior seed behavior',()=>{for(const to of [{town:1},{stage:'1-1'},{stage:'hard-6-6'},{dungeon:1},{spire:10}]){const q=new URLSearchParams(navQuery('?challenge=1&run=1&seed=42',to));assert.equal(q.has('challenge'),false);assert.equal(q.get('seed'),'42');}});
test('same seed reproduces terrain; sampled seeds vary and all have diggable entrance-to-core paths',()=>{assert.equal(signature(map(42)),signature(map(42)));const layouts=new Set();for(let seed=1;seed<=1000;seed++){const m=map(seed);layouts.add(signature(m));assert.equal(m[21][7].t,0);const queue=[[0,8]],seen=new Set(['0,8']);for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=a+','+b;if(a<0||a>=24||b<0||b>=16||m[a][b].t===5||seen.has(k))continue;seen.add(k);queue.push([a,b]);}}assert.ok(seen.has('22,7'),`seed ${seed}`);}assert.equal(layouts.size,1000);});
test('departure and retry navigate fresh documents; map is never regenerated in place',()=>{assert.match(flow,/await go\(\{ challenge: true \}, 650\)/);assert.match(flow,/else go\(\{ challenge: true \}\)/);assert.doesNotMatch(flow,/genMap\(/);assert.match(flow,/QS.has\('challenge'\).*startChallengeRun\(\)/);assert.equal((flow.match(/prepareGrowth\(null, s.hero\)/g)||[]).length,1);});
