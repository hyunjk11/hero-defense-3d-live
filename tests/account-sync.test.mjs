import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import { CLOUD } from '../src/config/cloud.js';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
globalThis.location = { search: '', hostname: 'localhost' };
const user = { id: 'test-account', email: 'test@example.invalid' };
let cloud = { data: { ...P.empty(), souls: 1000, nick: 'cloud' }, updated_at: 'v1' }, pending = null, started = null, rejectCAS = false, writes = 0;
const client = {
  auth: { onAuthStateChange() {}, signInWithPassword: async () => ({ data: { user } }), signOut: async () => ({}) },
  from(table) {
    let op = 'select', payload;
    const query = {
      select() { return query; }, eq() { return query; }, limit: async () => ({ data: [] }),
      update(data) { op = 'update'; payload = data; return query; },
      insert(data) { op = 'insert'; payload = data; return query; },
      upsert: async () => ({}),
      maybeSingle() {
        if (table === CLOUD.tables.profiles) return Promise.resolve({ data: { nickname: 'cloud' } });
        if (pending) { const p = pending; pending = null; started?.(); return p; }
        return Promise.resolve({ data: structuredClone(cloud) });
      },
      then(resolve, reject) {
        if (op !== 'select') {
          writes++;
          if (rejectCAS) { rejectCAS = false; cloud.updated_at = 'other-device'; return Promise.resolve({ data: [] }).then(resolve, reject); }
          cloud = { ...payload, updated_at: 'saved-' + writes };
          return Promise.resolve({ data: [{ updated_at: cloud.updated_at }] }).then(resolve, reject);
        }
        return Promise.resolve({ data: [] }).then(resolve, reject);
      },
    };
    return query;
  },
};
globalThis.window = { __hd3dCloudMock: () => client };
const Acc = await import('../src/account/account.js');

Acc.store({ ...P.empty(), souls: 12 }, { cloud: false }); Acc.playGuest();
let release; pending = new Promise(r => release = r); const readStarted = new Promise(r => started = r);
const login = Acc.signIn('test@example.invalid', 'unused'); await readStarted; await Acc.signOut();
release({ data: { data: { ...P.empty(), souls: 900 }, updated_at: 'late' } }); await login;
assert.equal(Acc.A.user, null); assert.equal(Acc.load().souls, 12, 'late cloud response cannot overwrite guest after logout');

const item = E.makeItem('armor', undefined, 2, () => .25, 1); item.id = 'dismantled'; cloud.data.inv = [item];
Acc.store(P.empty(), { cloud: false }); await Acc.signIn('test@example.invalid', 'unused');
assert.equal(Acc.load().souls, 1000);
Acc.update(s => { const [next] = P.buyPerm(s, 'mage', 'atk'); E.dismantle(next, [item.id]); return next; });
rejectCAS = true; await Acc.flush();
assert.equal(Acc.A.sync, 'conflict'); assert.equal(Acc.load().souls, 960); assert.equal(Acc.load().inv.length, 0);
const writeCount = writes; await Acc.flush(); assert.equal(writes, writeCount, 'conflict blocks autosave');
await Acc.resolveConflict('local'); assert.equal(Acc.A.conflict, null); assert.equal(cloud.data.souls, 960); assert.equal(cloud.data.inv.length, 0);
assert.ok(JSON.parse(values.get(CLOUD.storagePrefix + '_snapshot_backups')).some(s => s.reason === 'conflict'));
await Acc.signOut();
console.log('Late logout response, CAS conflict, sync freeze, backups and explicit local choice passed.');
