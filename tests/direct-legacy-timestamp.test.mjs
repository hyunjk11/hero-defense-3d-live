import assert from 'node:assert/strict';
import {normalizeLegacyTimestamp as normalize} from '../direct/legacy-timestamp.mjs';
import {rankingDocuments} from '../direct/ranking-migration.mjs';
import {rankTimeKey} from '../src/account/direct-ranking.js';
import {decodeFields} from '../src/account/direct-store.js';
for(const bad of ['2026-02-30','2026-02-30T00:00:00Z','2026-02-29','1900-02-29','2026-04-31','2026-00-01','2026-13-01','2026-01-00','0000-01-01','2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','2026-01-01T00:00:00+24:00','2026-01-01T00:00:00+01:60','2026-01-01T00:00:00','2026-01-01T00:00:00.1234567890Z','0001-01-01T00:00:00+00:01','9999-12-31T23:59:59-00:01','Nov 1 2026',null,0])assert.throws(()=>normalize(bad),String(bad));
for(const [input,want] of [
 ['2026-10-27','2026-10-27T00:00:00.000Z'],['2000-02-29','2000-02-29T00:00:00.000Z'],
 ['2024-03-01T00:00:00.123456789+09:00','2024-02-29T15:00:00.123456789Z'],
 ['2026-12-31T23:59:59.000000001-00:30','2027-01-01T00:29:59.000000001Z'],
 ['0001-01-01T00:00:00Z','0001-01-01T00:00:00Z'],['0099-12-31T23:59:59Z','0099-12-31T23:59:59Z'],
 ['2026-10-27T12:00:00.123+09:00','2026-10-27T03:00:00.123Z']
])assert.equal(normalize(input),want);
for(let n=1;n<=9;n++){const f='123456789'.slice(0,n);assert.equal(normalize(`2026-10-27T12:00:00.${f}+09:00`),`2026-10-27T03:00:00.${f}Z`);}
const rows=[{uid:'z-earlier',at:'2026-10-27T12:00:00.000001+09:00'},{uid:'a-later',at:'2026-10-27T12:00:00.000002+09:00'}].map(x=>({...x,kind:'all',nick:'Test',floor:30}));
const imported=rankingDocuments(rows).map(x=>decodeFields(x.fields));
imported.sort((a,b)=>b.floor-a.floor||rankTimeKey(a.at).localeCompare(rankTimeKey(b.at))||a.uid.localeCompare(b.uid));
assert.deepEqual(imported.map(x=>x.uid),['z-earlier','a-later']);
assert.throws(()=>rankingDocuments([{...rows[0],kind:'week',week:'2026-02-30'}]));
console.log('PASS DF12-01 strict calendar/offset boundaries, 1..9 fractional digits and actual rank comparator order');
