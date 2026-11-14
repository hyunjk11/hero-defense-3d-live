// File-only review tool. Never opens Firebase, loads credentials or applies data.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {planGlobalReverse} from './global-reverse-plan.mjs';
import {prepareReverse} from './operator-plan.mjs';
import {reverseCollisionReport} from './reverse-collisions.mjs';
import {hash} from './global-migration-plan.mjs';
export function inspectMapping(source){return {version:1,noExternalWrites:true,directHash:hash(source.direct),targetHash:hash(source.target),collisions:reverseCollisionReport(source.direct.documents,source.target.documents),supported:'Explicit new, fully applied, non-item mail only. Other collisions remain blocked. Operator supplies every destination above all prior high-water marks.'};}
export function reviewMapping(source,mapping,assurance){
 const input={...source,idMapping:mapping},plan=planGlobalReverse(input),job=prepareReverse(input,assurance);
 return {version:1,productionReady:false,noExternalWrites:true,plan,job,reviewRequired:['Every source/destination and changed reference in mappingLedger','Both complete frozen exports, no pending journals, all writers fenced','Item mail, global audit references and other numeric tables are unsupported; do not edit around rejection']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [mode,bundle,file,out]=process.argv.slice(2);
 if(!['--inspect','--plan'].includes(mode)||!bundle||!file||(mode==='--plan'&&!out))throw Error('Usage: review-mapping.mjs --inspect bundle.json NEW-report.json | --plan bundle.json reviewed-mapping-and-assurance.json NEW-plan.json');
 const source=JSON.parse(await readFile(bundle,'utf8'));
 const result=mode==='--inspect'?inspectMapping(source):await (async()=>{const x=JSON.parse(await readFile(file,'utf8'));return reviewMapping(source,x.mapping,x.assurance);})();
 await writeFile(mode==='--inspect'?file:out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({noExternalWrites:true,productionReady:false,resultHash:hash(result)}));
}
