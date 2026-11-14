// Synthetic local files only. This is not operator authorization or live IO.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {durableJournal} from './execute.mjs';
import {main} from './cli.mjs';
import {source} from '../../tests/direct-global-migration.test.mjs';
import {hash} from '../global-migration-plan.mjs';
import {ROOT,PROJECT} from '../../server/firestore.mjs';
const dir=await mkdtemp(join(tmpdir(),'hd3d-cutover-test-')),cases=[];
async function test(name,fn){await fn();cases.push(name);console.log('PASS IO '+name);}
try{
 const p=join(dir,'journal.jsonl');
 await test('exclusive journal lock, fsync chain and resume',async()=>{const j=await durableJournal(p,'fixture-job','data');await j.append({type:'intent',writesHash:'test'});await assert.rejects(durableJournal(p,'fixture-job','data'),e=>e.code==='EEXIST');await j.append({type:'confirmed'});await j.close();const k=await durableJournal(p,'fixture-job','data');await k.append({type:'resume'});await k.close();const rows=(await readFile(p,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(rows.length,3);assert.equal(rows[2].previous,rows[1].digest);});
 await test('other job/stage rejected without changing evidence',async()=>{const before=await readFile(p,'utf8');await assert.rejects(durableJournal(p,'other','data'),/changed|belongs/);await assert.rejects(durableJournal(p,'fixture-job','activate'),/changed|belongs/);assert.equal(await readFile(p,'utf8'),before);});
 await test('truncated/corrupt journal fail closed',async()=>{await writeFile(join(dir,'truncated'),'{}');await assert.rejects(durableJournal(join(dir,'truncated'),'x','data'),/Truncated/);const raw=await readFile(p,'utf8');await writeFile(join(dir,'corrupt'),raw.replace('intent','edited'));await assert.rejects(durableJournal(join(dir,'corrupt'),'fixture-job','data'),/changed/);});
 await test('offline CLI prepare and exclusive output',async()=>{await writeFile(join(dir,'source'),JSON.stringify(source()));await writeFile(join(dir,'fence'),JSON.stringify({writersStopped:true,pendingClientJournals:0,exclusiveWriterConfirmed:true,fenceId:'fixture-fence'}));const args=['prepare','--source',join(dir,'source'),'--assurance',join(dir,'fence'),'--out',join(dir,'job')];await main(args);const before=await readFile(join(dir,'job'),'utf8');await assert.rejects(main(args),e=>e.code==='EEXIST');assert.equal(await readFile(join(dir,'job'),'utf8'),before);assert.equal(JSON.parse(before).kind,'import');});
 await test('network requires matching target and explicit command',async()=>{await assert.rejects(main(['export']),/network/);await assert.rejects(main(['prepare','--network']),/Offline/);await writeFile(join(dir,'permit'),JSON.stringify({project:'wrong',database:'(default)',action:'export',reviewId:'fixture',expiresAt:'2030-01-01T00:00:00Z'}));await assert.rejects(main(['export','--network','--permit',join(dir,'permit')]),/permit/);});
 await test('file-backed inspect rejects malformed metadata without producing a plan',async()=>{
  const s=source(),at=s.snapshot.readTime,documents=s.documents.map(d=>({...d,updateTime:at})),collections={};
  for(const d of documents){const c=d.name.slice(ROOT.length+1).split('/').slice(0,-1).join('/');collections[c]=(collections[c]||0)+1;}
  const inventory={format:1,documents,snapshot:{project:PROJECT,database:'(default)',readTime:at,complete:true,collections}};
  await writeFile(join(dir,'inventory'),JSON.stringify(inventory));
  await main(['inspect','--job',join(dir,'job'),'--inventory',join(dir,'inventory'),'--out',join(dir,'inspection')]);
  assert(JSON.parse(await readFile(join(dir,'inspection'),'utf8')).writes.length>0);
  for(const [id,change] of [['count',x=>x.snapshot.collections.hd3d_progress=999],['missing',x=>delete x.snapshot.collections],['time',x=>x.snapshot.readTime='bad']]){
   const bad=structuredClone(inventory);change(bad);await writeFile(join(dir,id),JSON.stringify(bad));
   await assert.rejects(main(['inspect','--job',join(dir,'job'),'--inventory',join(dir,id),'--out',join(dir,id+'-result')]));
   await assert.rejects(readFile(join(dir,id+'-result')),e=>e.code==='ENOENT');
  }
 });
 console.log(JSON.stringify({suite:'direct-transfer-io',passed:cases.length,tests:cases}));
}finally{await rm(dir,{recursive:true,force:true});}
