// Offline preparation only. Creates a NEW review artifact; never overwrites an
// existing job, reads credentials, contacts a service or changes a database.
import {readFile,writeFile} from 'node:fs/promises';
import {prepareImport,prepareReverse,prepareWeekly} from './operator-plan.mjs';
const [kind,input,assurance,output,...extra]=process.argv.slice(2);
const prepare={import:prepareImport,reverse:prepareReverse,weekly:prepareWeekly}[kind];
if(!prepare||!input||!assurance||!output||extra.length)throw Error('Usage: node operator-prepare.mjs import|reverse|weekly source.json assurance.json NEW-job.json');
const result=prepare(JSON.parse(await readFile(input,'utf8')),JSON.parse(await readFile(assurance,'utf8')));
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({kind,jobHash:result.jobHash,productionReady:false,before:result.before.length,phases:result.phases.map(x=>x.length)},null,2));
