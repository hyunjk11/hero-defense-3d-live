import {clean} from './progress.js';
import {authorityOf,stable,trainingIntent} from './direct-authority.js';

// The UI intentionally normalizes old saves; that view is not a migration of
// their economic authority. Reconcile only an exact view/no-op or the existing
// one-level permanent training intent against the fresh raw server snapshot.
export function reconcileDirectSave(raw,incoming){
 const before=authorityOf(clean(raw)),after=authorityOf(clean(incoming));
 const intent=stable(before)===stable(after)?null:trainingIntent(before,after);
 if(!intent&&stable(before)!==stable(after))throw Object.assign(Error('Typed account action required'),{code:'DIRECT_ACTION_REQUIRED'});
 const next=structuredClone(raw);
 for(const key of ['hero','nick','settings'])if(Object.hasOwn(incoming,key))next[key]=structuredClone(clean(incoming)[key]);
 if(intent){next.souls=raw.souls-(before.souls-after.souls);next.heroLv={...raw.heroLv,[intent.hero]:{...raw.heroLv?.[intent.hero],[intent.stat]:after.heroLv[intent.hero][intent.stat]}};}
 return next;
}
