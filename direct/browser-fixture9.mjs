import {rest,get} from './emulator-harness.mjs';
import {directDocument,DEMO_PROJECT} from '../src/account/direct-store.js';
import {authoritativeSave} from '../src/account/direct-authority.js';
import {totalXP} from '../src/data/hero-growth.js';
const uid='Kk7QFy0yoQKGgUImFR04i1wF8VlK';const p=await get(uid,'progress'),save=authoritativeSave(p.cosmetic,p.authority),g=await get(uid,'growth_wallet');
save.souls=1000;save.keepLegacy={array:[1,2],text:'browser9'};save.research.arrow={atk:10,rng:2,spd:0,start:1};save.st['1-1']=3;
g.xp.mage=totalXP(10);g.spent=totalXP(10);g.granted=g.spent+1000;g.balance=1000;
await rest(':commit',{writes:[directDocument(DEMO_PROJECT,uid,'hd3d_progress',uid,{user_id:uid,data:save,merged:true,created_at:p.created_at,updated_at:new Date().toISOString()}),directDocument(DEMO_PROJECT,uid,'hd3d_growth_wallet',uid,g),directDocument(DEMO_PROJECT,uid,'hd3d_dungeon_wallet',uid,{user_id:uid,medals:200,earned:200,spent:0,titles:[],uniques:[],uq_pity:0,updated_at:new Date().toISOString()})].map(update=>({update}))});
console.log(JSON.stringify({uid,syntheticLocalOnly:true,souls:1000,medals:200,mageLevel:10,legacyUnknownAndAlias:true}));
