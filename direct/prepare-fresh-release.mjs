import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {freshRelease} from './fresh-release.mjs';
const [output,...extra]=process.argv.slice(2);
if(!output||extra.length)throw Error('Usage: node direct/prepare-fresh-release.mjs NEW-local-directory (offline only)');
const plan=freshRelease(await readFile(new URL('./firestore.rules',import.meta.url),'utf8'),JSON.parse(await readFile(new URL('./firestore.indexes.json',import.meta.url),'utf8')));
const {rulesCandidate,indexes,...metadata}=plan,dir=resolve(output),json=x=>JSON.stringify(x,null,2)+'\n';
await mkdir(dir); // Never overwrite a prior review.
const files={'firestore.live.candidate.rules':rulesCandidate,'firestore.live.indexes.json':json(indexes),'fresh-plan.json':json(metadata)};
for(const [name,text]of Object.entries(files))await writeFile(join(dir,name),text,{flag:'wx'});
await writeFile(join(dir,'manifest.json'),json({productionReady:false,network:false,files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))}),{flag:'wx'});
console.log(json({directory:dir,initialDocuments:plan.initialWrites.length,project:plan.project,productionReady:false,network:false}));
