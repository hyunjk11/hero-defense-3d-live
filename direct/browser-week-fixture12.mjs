// Explicit synthetic closed-week entitlement for UI verification, NOT played history.
import {rest} from './emulator-harness.mjs';
import {directDocument,decodeFields} from '../src/account/direct-store.js';
import {week,shiftDay} from '../server/common.mjs';
import {planWeeklyAwards} from './weekly-awards-plan.mjs';
import fs from 'node:fs/promises';
if(process.env.HD3D_DIRECT_TEST_PORT!=='9418')throw Error('Only isolated9418');
const uid='G2rTFyCSGureawR1m2yRhGm0bpLw',w=shiftDay(week(Date.now()),-7),at=new Date(Date.parse(w+'T00:00:00Z')+100000).toISOString();
const plan=planWeeklyAwards({project:'demo-hd3d-direct',complete:true,writersStopped:true,activeRuns:0,pendingJournals:0,week:w,capturedAt:new Date().toISOString(),banned:[],rows:[{uid,week:w,floor:30,at,claimed:false}]});
const doc=directDocument('demo-hd3d-direct',uid,'hd3d_spire_weeks',uid+'~'+w,{user_id:uid,week:w,best_floor:30,best_at:at,claimed:false});
await rest(':commit',{writes:[doc,...plan.grants].map(update=>({update,currentDocument:{exists:false}}))});
await fs.writeFile(new URL('../../direct-firestore-evidence-22/browser-week-fixture.json',import.meta.url),JSON.stringify({scope:'fixture-only prior week record and trusted grant, production untouched, not actual weekly competition',week:w,grant:decodeFields(plan.grants[0].fields).row.result},null,2));console.log('synthetic closed-week grant ready');
