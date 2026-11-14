const reviewArchivedFixture=process.env.HD3D_ARCHIVED_RECOVERY_FIXTURE;
if(!reviewArchivedFixture)throw new Error('Set HD3D_ARCHIVED_RECOVERY_FIXTURE to an isolated archived test fixture; never production data');
import {assert,fs,seed,client,get,rest} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT,unpackRow} from '../src/account/direct-store.js';
import {packTypedItem} from '../src/account/direct-gear.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {makeItem} from '../src/account/equip.js';
const saved=JSON.parse(await fs.readFile(reviewArchivedFixture,'utf8'));
const cases=[['missing mainKey',x=>delete x.mainKey],['missing spec',x=>delete x.spec],['missing raw',x=>delete x.raw],['missing packed',x=>delete x.packed],['numeric packed',x=>x.packed=7],['missing hasE',x=>delete x.hasE],['missing spec.m',x=>delete x.spec.m],['null spec.m',x=>x.spec.m=null],['numeric spec.sub',x=>x.spec.sub=3],['wrong chapter',x=>x.c=2],['valid control',x=>{}]];
const rows=[],suffix=Date.now().toString(36);
for(const [n,[label,mutate]] of cases.entries()){
 const uid='audit8-legacy-'+n+'-'+suffix,token='legacy-repair-edge',c=client(uid);await seed(uid);
 await c.rpc('growth_start',{p_id:token,p_mode:'campaign',p_stage:'1-1',p_hero:'mage'});
 const d=await rest(`/hd3d_live/${uid}/hd3d_growth_runs/${uid}~${token}`,null,'owner','GET');d.fields.issuedAt={timestampValue:new Date(Date.now()-300000).toISOString()};delete d.createTime;delete d.updateTime;await rest(':commit',{writes:[{update:d}]});c.setNow(Date.now()+300000);await c.rpc('growth_progress',{p_token:token,p_completed:5,p_win:false,p_finish:true});
 const drop=packTypedItem({...makeItem('armor',null,3,()=>.4,1),id:'legacy-test-drop'});mutate(drop);
 const old={...saved.old,id:uid+'~normal~'+token,user_id:uid,token,result:{...saved.old.result,drops:[drop]}};
 const p=await get(uid,'progress');await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:saved.before,merged:true,created_at:p.created_at,updated_at:p.updated_at})},{update:directDocument(DEMO_PROJECT,uid,'hd3d_growth_investments',old.id,unpackRow('hd3d_growth_investments',old))}]});
 const before=await get(uid,'progress');let result,error;
 try{result=await c.rpc('normal_loot',{p_token:token,p_index:1});}catch(e){error={code:e.code,message:e.message};}
 const after=await get(uid,'progress'),receipt=await get(uid,'growth_investments',old.id);
 const effective=p=>authoritativeSave(p.cosmetic,p.authority);
 rows.push({label,uid,result:result?{next:result.next,total:result.total,last:result.last}:null,error,status:receipt.status,saveUnchanged:JSON.stringify(effective(before))===JSON.stringify(effective(after)),before:effective(before),after:effective(after)});
 if(error)console.log(JSON.stringify({label,error}));
 assert.equal(receipt.status,'done',label);assert.equal(!!result?.last?.skipped,label!=='valid control',label);if(label!=='valid control')assert.deepEqual(effective(after),effective(before),label);
 console.log(JSON.stringify({label,status:receipt.status,error:error?.code,skipped:result?.last?.skipped}));
}
await fs.writeFile(new URL('../../direct-firestore-evidence-22/legacy-repair-boundaries.json',import.meta.url),JSON.stringify({scope:'independent synthetic historical malformed receipt fixtures; current Rules and product transport; no actual battle or ordinary UI occurrence claimed',rows},null,2));
