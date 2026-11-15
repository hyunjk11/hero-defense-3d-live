import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/ui/flow.js',import.meta.url),'utf8');
const line=source.split('\n').find(x=>x.includes("$('twAcct').classList.toggle('hidden'"));
const hidden=(sync,user=true,pending=null)=>{let hidden;new Function('A','Acc','$',line)({sync,user},{serverSaveState:()=>pending},()=>({classList:{toggle:(_c,v)=>hidden=v}}));return hidden;};
test('routine account labels stay hidden while pending/error/recovery remain visible',()=>{for(const sync of ['saved','local'])assert.equal(hidden(sync),true);assert.equal(hidden('local',false),true);for(const sync of ['saving','pending','loading','offline','error','conflict','banned','missing'])assert.equal(hidden(sync),false);assert.equal(hidden('saved',true,{busy:true}),false);assert.equal(hidden('saved',true,{busy:false}),false);});
