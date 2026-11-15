import { denied } from './common.mjs';
// Inbox cleanup never removes entitlement, receipt, reward, or mailbox rows.
export async function archiveMail(c,a) {
 c.requirePlayer();
 if(Object.keys(a).some(k=>!['p_ids','p_restore'].includes(k))||!Array.isArray(a.p_ids)||a.p_ids.length>100||a.p_ids.some(id=>!Number.isSafeInteger(id)||id<=0)||('p_restore'in a&&typeof a.p_restore!=='boolean'))denied('invalid mail selection','23514');
 const ids=[...new Set(a.p_ids)],restore=a.p_restore===true,changed=[],skipped=[];
 for(const id of ids){const m=await c.get('mail',id);if(!m||m.user_id!==c.uid||(!restore&&!m.claimed)){skipped.push(id);continue;}
  if(restore){if(m.archived_at){const row={...m};delete row.archived_at;await c.put('mail',row);}changed.push(id);}
  else {if(!m.archived_at)await c.put('mail',{...m,archived_at:c.iso});changed.push(id);}
 }
 return {ok:true,restored:restore,ids:changed,skipped};
}
