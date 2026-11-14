import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {releaseArtifacts} from './release-artifacts.mjs';
const [output,...extra]=process.argv.slice(2);
if(!output||extra.length)throw Error('Usage: node direct/prepare-release.mjs NEW-output-directory (offline only)');
const plan=releaseArtifacts(await readFile(new URL('./firestore.rules',import.meta.url),'utf8'),JSON.parse(await readFile(new URL('./firestore.indexes.json',import.meta.url),'utf8')));
const dir=resolve(output);await mkdir(dir); // Fails if present; never overwrites a prior review.
const json=x=>JSON.stringify(x,null,2)+'\n';
const files={'firestore.rules':plan.rules,'firestore.indexes.json':json(plan.indexes),'firebase.direct.json':json(plan.firebaseConfig),'catalog.json':json(plan.catalog)};
for(const [name,body]of Object.entries(files))await writeFile(join(dir,name),body,{flag:'wx'});
await writeFile(join(dir,'manifest.json'),json({project:plan.project,productionReady:false,network:false,files:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,createHash('sha256').update(s).digest('hex')])),required:plan.required}),{flag:'wx'});
console.log(json({directory:dir,project:plan.project,catalog:plan.catalog.length,network:false,productionReady:false}));
