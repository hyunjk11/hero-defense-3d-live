import {assert,fs,root,config,test,rows,rest,seed,user,raw} from './emulator-harness.mjs';
import {createAdminMailTransport as current} from '../src/account/direct-admin-mail.js';
import {createAdminMailTransport as baseline} from '../../candidate-v34-firestore-direct-17/src/account/direct-admin-mail.js';
import {encodeFields} from '../src/account/direct-store.js';
const actor='cost_admin',target='cost_target';await seed(actor);await seed(target);
const ids=[actor,target,...Array.from({length:28},(_,i)=>'cost_'+i)];
await rest(':commit',{writes:ids.flatMap(uid=>[{update:raw(uid,'users',uid,{id:uid,email:uid+'@example.invalid'},0)},{update:{name:root+'/hd3d_live_accounts/'+uid,fields:encodeFields({uid})}}]).concat([{update:raw(actor,'admins',actor,{user_id:actor,owner:false},0)}])});
const directory=await rest(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_live_accounts'}],limit:100}});const accountCount=directory.filter(x=>x.document).length;if(accountCount!==ids.length)throw Error('Fresh isolated cost fixture required');const results=[];
for(const [version,factory] of [['phase17',baseline],['phase19',current]]){
 const stats={http:0,commits:0,writes:0,userGets:0,userBatchRequests:0},m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)},u=user(actor),auth={currentUser:u};
 const fetcher=async(url,opts)=>{stats.http++;const b=opts.body?JSON.parse(opts.body):{};if(url.includes('/hd3d_users/'))stats.userGets++;if(url.endsWith(':batchGet')&&b.documents?.some(x=>x.includes('/hd3d_users/')))stats.userBatchRequests++;if(url.endsWith(':commit')){stats.commits++;stats.writes+=b.writes.length;}return fetch(url,opts);};
 const fn=factory(config,{auth,fetcher,storage}),start=performance.now();const r=await fn({name:'hd3d_admin_send_mail',args:{p_email:target+'@example.invalid',p_title:'Cost test',p_body:'same synthetic account set',p_reward:{souls:1}}},u);assert(r.data.ok);results.push({version,accounts:ids.length,...stats,elapsedMs:performance.now()-start});
}
assert.equal(results[0].writes,results[1].writes);assert.equal(results[0].commits,results[1].commits);assert(results[1].http<results[0].http);
await fs.writeFile('../direct-firestore-evidence-22/admin-cost.json',JSON.stringify({scope:'same local emulator, same 30 indexed users; single samples, HTTP counts not billed reads; role checks unchanged',results},null,2));console.log(JSON.stringify(results));
