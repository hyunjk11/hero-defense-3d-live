// Disposable local emulator account only. Never export this helper for deployment.
import fs from 'node:fs/promises';
import {rest,get} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {totalXP} from '../src/data/hero-growth.js';
const uid=process.argv[2];if(!/^[A-Za-z0-9]{20,40}$/.test(uid||''))throw Error('Explicit emulator UID required');
const p=await get(uid,'progress'),g=await get(uid,'growth_wallet'),s=authoritativeSave(p.cosmetic,p.authority);
if(!s.nick?.startsWith('phase8-')||s.stats.runs!==0||s.souls!==0)throw Error('Not an unused phase8 synthetic browser account');
await fs.writeFile(new URL('../../direct-firestore-evidence-22/browser-fixture-before.json',import.meta.url),JSON.stringify({uid,progress:p,growth:g},null,2));
s.souls=5000;s.mat={steel:500,crystal:100,essence:10};s.st['2-4']=3;s.hq.mage={boss:1,clr:0};
g.xp.mage=totalXP(10);g.granted=totalXP(10)+1000;g.spent=totalXP(10);g.balance=1000;
await rest(':commit',{writes:[{update:directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:s,merged:true,created_at:p.created_at,updated_at:p.updated_at})},{update:directDocument(DEMO_PROJECT,uid,'hd3d_growth_wallet',uid,g)}]});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/browser-fixture-after.json',import.meta.url),JSON.stringify({scope:'only local demo-hd3d-direct:9298 fixture; not earned through play',uid,save:s,growth:g},null,2));
console.log('Prepared isolated town purchase fixture');
