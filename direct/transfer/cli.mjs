// Explicit operator entry point. No network in any command without --network.
import {readFile,open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PROJECT} from '../../server/firestore.mjs';
import {hash} from '../global-migration-plan.mjs';
import {prepareTransfer,prepareRollback,rollbackSource,legacyExport,transferStep,verifyTransfer} from './plan.mjs';
import {firestoreStore} from './transport.mjs';
import {executeTransfer,durableJournal} from './execute.mjs';
const fail=s=>{throw Error(s);};
const json=async p=>JSON.parse(await readFile(p,'utf8'));
async function output(p,value){const f=await open(p,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.sync();}finally{await f.close();}}
function flags(args){const out={};for(let i=0;i<args.length;i++){const k=args[i];if(!/^--[a-z-]+$/.test(k)||Object.hasOwn(out,k))fail('Invalid/duplicate option');out[k]=['--network','--execute'].includes(k)?true:args[++i];if(!out[k]||typeof out[k]==='string'&&out[k].startsWith('--'))fail('Missing option value');}return out;}
async function credential(){let value='';for await(const chunk of process.stdin){value+=chunk;if(value.length>16384)fail('Credential input too large');}value=value.trim();if(!value||/\s/.test(value))fail('Supply one ephemeral access token through stdin');return ()=>value;}
export async function main(args){
 const [command,...rest]=args,f=flags(rest),allowed=new Set(['--source','--inventory','--assurance','--out','--job','--mapping','--stage','--review','--network','--execute','--permit','--journal']);
 for(const k of Object.keys(f))if(!allowed.has(k))fail('Unknown option '+k);
 const take=k=>f[k]||fail('Required '+k);
 if(['prepare','reverse-input','reverse','inspect'].includes(command)){
  if(f['--network']||f['--execute']||f['--permit'])fail('Offline command cannot use network/execution flags');
  if(command==='prepare')return output(take('--out'),prepareTransfer(await json(take('--source')),await json(take('--assurance'))));
  if(command==='reverse-input')return output(take('--out'),rollbackSource(await json(take('--job')),await json(take('--inventory')),await json(take('--assurance'))));
  if(command==='reverse')return output(take('--out'),prepareRollback(await json(take('--job')),await json(take('--inventory')),await json(take('--assurance')),f['--mapping']?await json(f['--mapping']):undefined));
  return output(take('--out'),transferStep(await json(take('--job')),await json(take('--inventory')),{stage:f['--stage']||'data',review:f['--review']?await json(f['--review']):undefined}));
 }
 if(!['export','apply'].includes(command)||!f['--network'])fail('Usage: prepare/reverse/inspect (offline), or export/apply --network with reviewed permit');
 const permit=await json(take('--permit')),stage=f['--stage']||'data',job=command==='apply'?verifyTransfer(await json(take('--job'))):null;
 const action=command==='export'?'export':f['--execute']?stage:'inspect';
 if(permit.project!==PROJECT||permit.database!=='(default)'||permit.action!==action||typeof permit.reviewId!=='string'||!permit.reviewId.trim()||!Number.isFinite(Date.parse(permit.expiresAt))||Date.parse(permit.expiresAt)<=Date.now()||job&&permit.jobHash!==job.hash)fail('Matching unexpired action-specific operator permit required');
 if(command==='export'&&f['--execute'])fail('Export cannot write database');
 const store=firestoreStore({token:await credential(),allowWrites:command==='apply'&&f['--execute']===true});
 if(command==='export'){
  const inventory=await store.inventory(),assurance=await json(take('--assurance'));
  // Import source export fails closed on any unknown/direct collection. A raw inventory
  // supports reverse planning separately without silently discarding collection types.
  const value=f['--stage']==='inventory'?inventory:legacyExport(inventory,assurance);
  await output(take('--out'),value);return {documents:inventory.documents.length,hash:hash(value),stats:store.stats};
 }
 const review=f['--review']?await json(f['--review']):undefined;
 let journal;
 try{if(f['--execute'])journal=await durableJournal(take('--journal'),job.hash,stage);
  const result=await executeTransfer(job,store,{stage,execute:f['--execute']===true,review,journal:journal?.append});
  await output(take('--out'),result);return result;
 }finally{await journal?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await main(process.argv.slice(2));console.log(JSON.stringify(result||{written:true}));}catch(e){console.error(e.message);process.exitCode=1;}}
