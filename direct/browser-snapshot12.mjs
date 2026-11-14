// Read-only snapshot of the explicitly isolated phase12 browser account.
import {rest} from './emulator-harness.mjs';
import {decodeFields} from '../src/account/direct-store.js';
import fs from 'node:fs/promises';
const uid='G2rTFyCSGureawR1m2yRhGm0bpLw',label=process.argv[2];if(process.env.HD3D_DIRECT_TEST_PORT!=='9418'||!/^[-a-z0-9]+$/.test(label))throw Error('Isolated snapshot only');
const tables=['growth_wallet','progress','spire_best','spire_weeks','spire_runs','growth_receipts','growth_investments','mail','dungeon_wallet','sequences'];const rows={};
for(const t of tables){const r=await rest(`/hd3d_live/${uid}:runQuery`,{structuredQuery:{from:[{collectionId:'hd3d_'+t}]}});rows[t]=r.filter(x=>x.document).map(x=>decodeFields(x.document.fields));}
const q=await rest(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_live_ranks'}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:uid}}}}});
const out={scope:'synthetic local9418 browser account only',uid,rows,ranks:q.filter(x=>x.document).map(x=>decodeFields(x.document.fields))};await fs.writeFile(new URL('../../direct-firestore-evidence-22/browser-server-'+label+'.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify({runs:rows.spire_runs.length,status:rows.spire_runs.reduce((a,x)=>(a[x.row.status]=(a[x.row.status]||0)+1,a),{}),xp:rows.growth_wallet[0]?.row.balance,ranks:out.ranks.length}));
