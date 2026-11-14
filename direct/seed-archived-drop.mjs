const reviewArchivedFixture=process.env.HD3D_ARCHIVED_RECOVERY_FIXTURE;
if(!reviewArchivedFixture)throw new Error('Set HD3D_ARCHIVED_RECOVERY_FIXTURE to an isolated archived test fixture; never production data');
// Reconstruct an archived already-paid pending receipt in OUR fresh emulator.
// This is not a replay against the implementer's original browser account.
import {assert,fs,seed,client,get,rest} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT,unpackRow} from '../src/account/direct-store.js';
const old=JSON.parse(await fs.readFile(reviewArchivedFixture,'utf8'));
assert.deepEqual(old.before,old.after);assert.equal(old.old.status,'pending');assert.equal(old.old.result.next,1);
old.uid='phase9-archived-drop';old.old.user_id=old.uid;old.old.id=old.uid+'~normal~'+old.old.token;await seed(old.uid);const c=client(old.uid),token=old.old.token;
assert.equal((await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'})).ok,true);
const d=await rest(`/hd3d_live/${old.uid}/hd3d_growth_runs/${old.uid}~${token}`,null,'owner','GET');d.fields.issuedAt={timestampValue:new Date(Date.now()-300000).toISOString()};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});c.setNow(Date.now()+300000);
assert.equal((await c.rpc('growth_progress',{p_token:token,p_completed:5,p_win:false,p_finish:true})).ok,true);
const p=await get(old.uid,'progress');await rest(':commit',{writes:[
 {update:directDocument(DEMO_PROJECT,old.uid,'hd3d_progress',old.uid,{user_id:old.uid,data:old.before,merged:true,created_at:p.created_at,updated_at:p.updated_at})},
 {update:directDocument(DEMO_PROJECT,old.uid,'hd3d_growth_investments',old.old.id,unpackRow('hd3d_growth_investments',old.old))}
]});
console.log('Cloned archived pending receipt and previously granted save into independent emulator; original account untouched');
