// A repeat handoff is one-use, tab-local, and only written by intentional
// navigation. A plain reload, copied link or stale save does not arm the loop.
export const REPEAT_QUERY = 'repeatRun';
const KEY = 'hd3d_live_repeat_run_v1', MAX_AGE = 60_000;
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
// Star CSS pop starts at 350ms and finishes 500ms later; every earned star has
// an additional 350ms offset. Never navigate before that last earned pop.
export const repeatStarDelay = stars => 850 + 350*(Math.min(3,Math.max(1,stars))-1);
export const repeatNormalOK = (r,stage,token,waves) => !!token&&r?.token===token&&r.ok===true&&r.kind==='normal'&&
  r.won===true&&r.first===false&&r.stage===stage&&r.wave===waves&&Number.isSafeInteger(r.total)&&r.total>=0&&r.next===r.total&&
  Array.isArray(r.loot)&&r.loot.length===r.total&&!r.deferred&&!r.loot.some(x=>!x||x.auto||x.skipped);
export const repeatHardOK = (r,stage,waves) => r?.stage===stage&&r.completed===waves&&r.ok===true&&!r.reward?.steel&&!r.reward?.crystal;
