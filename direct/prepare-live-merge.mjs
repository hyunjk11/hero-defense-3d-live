// Offline output only. Never authenticate or deploy.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {mergeLiveRules} from './merge-live-rules.mjs';
import {freshRelease} from './fresh-release.mjs';
const [baseline,output,...extra]=process.argv.slice(2);
if(!baseline||!output||extra.length)throw Error('Usage: node direct/prepare-live-merge.mjs CURRENT-RULES NEW-output-directory');
const current=await readFile(resolve(baseline),'utf8');
const plan=freshRelease(await readFile(new URL('./firestore.rules',import.meta.url),'utf8'),JSON.parse(await readFile(new URL('./firestore.indexes.json',import.meta.url),'utf8')));
const merged=mergeLiveRules(current,plan.rulesCandidate),dir=resolve(output);
await mkdir(dir); // Fail closed on existing output; no recursive overwrite.
await writeFile(join(dir,'firestore.merged.prototype.rules'),merged.rules,{flag:'wx'});
await writeFile(join(dir,'merge-metadata.json'),JSON.stringify(merged.metadata,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(merged.metadata,null,2));
