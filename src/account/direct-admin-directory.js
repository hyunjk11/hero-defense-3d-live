// Batched private account lookup, still authorized by Rules on every request.
// Never caches roles or identities across invocations; missing users are omitted.
export async function adminDirectory({scan,read,decodeFields}){
 const ids=(await scan('','hd3d_live_accounts')).map(d=>decodeFields(d.fields).uid);
 if(ids.some(uid=>!/^[-A-Za-z0-9_]{1,128}$/.test(uid)))throw Error('INVALID_ACCOUNT_INDEX');
 const rows=[];
 for(let n=0;n<ids.length;n+=10){const ds=await read(ids.slice(n,n+10).map(uid=>`hd3d_live/${uid}/hd3d_users/${uid}`));for(const d of ds)if(d)rows.push(decodeFields(d.fields).row);}
 return rows;
}
