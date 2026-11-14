// Read only: snapshot this synthetic local browser UID, no production endpoint.
import {rest,fs} from './emulator-harness.mjs';
import {decodeFields} from '../src/account/direct-store.js';
const uid='Kk7QFy0yoQKGgUImFR04i1wF8VlK',rows={};
for(const table of ['hd3d_progress','hd3d_growth_wallet','hd3d_dungeon_wallet','hd3d_mail','hd3d_dungeon_buys','hd3d_growth_runs','hd3d_growth_investments','hd3d_growth_receipts','hd3d_sequences']){
 const data=await rest(`/hd3d_live/${uid}/${table}?pageSize=100`,null,'owner','GET');
 rows[table]=(data.documents||[]).map(d=>decodeFields(d.fields));
}
const tag=process.argv[2]||'final';if(!/^[a-z-]+$/.test(tag))throw Error('invalid tag');
await fs.writeFile(new URL(`../../direct-firestore-evidence-22/browser-server-${tag}.json`,import.meta.url),JSON.stringify({scope:'isolated demo fixture; read only',uid,rows},null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]))));
