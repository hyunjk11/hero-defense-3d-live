import assert from 'node:assert/strict';
import {batchSnapshotReads} from '../src/account/direct-snapshot-batch.js';
const calls=[],signal=new AbortController().signal;
const request=batchSnapshotReads(async(method,path,body,options)=>{calls.push({method,path,body,options});return body.documents.map(n=>n==='missing'?{missing:n}:{found:{name:n}}).reverse();});
const get=(name,transaction='a',s=signal)=>request('POST','root:batchGet',{documents:[name],transaction},{signal:s});
assert.deepEqual(await Promise.all([get('first'),get('missing'),get('last'),get('first')]),[[{found:{name:'first'}}],[{missing:'missing'}],[{found:{name:'last'}}],[{found:{name:'first'}}]]);
assert.equal(calls.length,1);assert.deepEqual(calls[0].body.documents,['first','missing','last']);
await get('first');assert.equal(calls.length,2,'no permission/data cache across reads');
await Promise.all([get('a','x'),get('a','y'),get('a','x',new AbortController().signal)]);assert.equal(calls.length,5);
await Promise.all(Array.from({length:21},(_,i)=>get('n'+i)));assert.equal(calls.length,8);assert(calls.every(c=>c.body.documents.length<=10));
for(const result of [[],[{found:{name:'unknown'}}],[{missing:'a'},{missing:'a'}]]){const broken=batchSnapshotReads(async()=>result);await assert.rejects(broken('POST','root:batchGet',{documents:['a'],transaction:'s'}),/snapshot batch/i);}
const failure=new Error('denied');const rejected=batchSnapshotReads(async()=>{throw failure;});assert((await Promise.allSettled(['a','b'].map(n=>rejected('POST','root:batchGet',{documents:[n],transaction:'s'})))).every(r=>r.status==='rejected'&&r.reason===failure));
let methods=[];const direct=batchSnapshotReads(async(...a)=>{methods.push(a);return 'unmodified';});assert.equal(await direct('POST','root:commit',{writes:[]}), 'unmodified');assert.equal(await direct('POST','root:batchGet',{documents:['a']}),'unmodified');assert.equal(methods.length,2);
console.log('PASS same-snapshot batching, duplicates/missing, fresh reads, token/signal separation, bounds, malformed/denied propagation and writes unchanged');
