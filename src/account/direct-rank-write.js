// A public projection contains no save, email, inventory or permission data.
// Each write shares the exact score transaction; Rules verify the reverse link.
export function appendRankWrites(writes,{root,uid,revision,profile}){
 const added=[];
 for(const w of writes){
  const name=w.update?.name,table=name?.split('/').at(-2);if(!['hd3d_spire_best','hd3d_spire_weeks'].includes(table))continue;
  const row=w.update.fields.row.mapValue.fields,floor=Number(row.best_floor.integerValue),at=row.best_at;
  if(floor<=0)continue;
  const changed=w.updateTransforms?.some(x=>x.fieldPath==='row.best_at');
  // Pre-phase12 prototype records need a trusted timestamp migration. Never let
  // the player rewrite an old tie timestamp or substitute a guessed date.
  if(!changed&&!at?.timestampValue)continue;
  const kind=table==='hd3d_spire_best'?'all':'week',week=kind==='week'?row.week.stringValue:null;
  const nick=profile?.row?.mapValue?.fields?.nickname?.stringValue||'용사';
  added.push({update:{name:root+'/hd3d_live_ranks/'+kind+'~'+(week||'all')+'~'+uid,fields:{
   uid:{stringValue:uid},kind:{stringValue:kind},week:week?{stringValue:week}:{nullValue:null},nick:{stringValue:nick},
   floor:{integerValue:String(floor)},at,excluded:{booleanValue:false},revision:{integerValue:String(revision)}
  }},...(changed?{updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]}:{})});
 }
 return [...writes,...added];
}
