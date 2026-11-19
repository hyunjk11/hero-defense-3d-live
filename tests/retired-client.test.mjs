import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {releaseMap} from '../scripts/stamp-browser-release.mjs';
import * as storage from '../src/account/storage.js';
import * as hard from '../src/data/hard.js';
import * as spire from '../src/data/spire.js';
const retired=['src/heroes/unique.js','src/config/supabase.js','lib/supabase.mjs'];
test('retired client files are not referenced by static/dynamic imports or browser entry points',()=>{
 const {files}=releaseMap(process.cwd());
 for(const f of retired)assert.equal(fs.existsSync(f),false,f);
 for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const refs=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)].map(m=>m[1]);
  for(const ref of refs){
   if(!ref.startsWith('.'))continue;
   const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));
   assert.ok(fs.existsSync(target),`${file} -> ${target}`);
   assert.ok(!retired.includes(target),`${file} retains ${target}`);
  }
 }
 const html=fs.readFileSync('index.html','utf8');
 for(const f of retired)assert.ok(!html.includes(f));
});
test('only unused exports were removed, saved hard-version contract remains intact',()=>{
 assert.equal('bagFree' in storage,false);
 assert.equal('HARD_VERSION' in hard,false);
 assert.equal('SP_REVIVE' in spire,false);
 assert.equal(hard.cleanHard({version:1,st:{}}).version,1);
 assert.equal(hard.HARD_ELITE_CAP,2);
});
