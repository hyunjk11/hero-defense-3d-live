// Capability audit, not a passing feature test. This records known unfinished
// paths explicitly so they cannot be hidden by successful unrelated regressions.
import {fs,root,rest,seed,client,user,raw,config} from './emulator-harness.mjs';
import {createDirectTransport} from '../src/account/direct-store.js';
const uid='remaining_'+Date.now().toString(36);await seed(uid);const c=client(uid),out=[];
for(const [name,fn] of [['customer_order_insert',()=>c.query({table:'hd3d_orders',action:'insert',values:{item:'hero_gunner'},returning:true})],['admin_spire_reset',()=>c.rpc('admin_spire_reset',{p_user:uid,p_reason:'capability probe'})]]){
 try{out.push({name,status:'unexpectedly_executed',result:await fn()});process.exitCode=1;}catch(e){out.push({name,status:'UNIMPLEMENTED',code:e.code,message:e.message});}
}
await fs.writeFile('../direct-firestore-evidence-22/outstanding-paths.json',JSON.stringify({scope:'isolated demo capability probe; expected failures are NOT implemented features',out},null,2));console.log(JSON.stringify(out));
