// A single-stage auto-play handoff is one-use, tab-local, and only written by intentional
// navigation. A plain reload, copied link or stale save does not arm the loop.
export const REPEAT_QUERY = 'repeatRun';
const KEY = 'hd3d_live_auto_stage_v1', MAX_AGE = 60_000;
const nonceOK = n => typeof n === 'string' && /^[0-9a-f-]{36}$/i.test(n);
export function repeatHandoff(storage, now = Date.now) {
  const clear = () => { try { storage.removeItem(KEY); } catch {} };
  return {
    clear,
    arm(nonce,owner,stage) {
      if (!nonceOK(nonce) || !owner || !stage) return false;
      try {
        const raw=JSON.stringify({nonce,owner,stage,expires:now()+MAX_AGE});
        storage.setItem(KEY,raw);
        return storage.getItem(KEY)===raw;
      } catch { clear(); return false; }
    },
    take(nonce,owner,stage) {
      let v;
      try { v=JSON.parse(storage.getItem(KEY)||'null'); storage.removeItem(KEY); if(storage.getItem(KEY)!=null)return false; }
      catch { return false; }
      return nonceOK(nonce)&&!!owner&&!!stage&&v?.nonce===nonce&&v.owner===owner&&v.stage===stage&&v.expires>=now();
    },
  };
}
