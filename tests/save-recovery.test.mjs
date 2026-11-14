// No real SDK, account, network, storage or Firebase writes: actual adapter + MemoryStore.
import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import { CLOUD } from '../src/config/cloud.js';
import { MemoryStore } from '../server/memory-store.mjs';
import { execute } from '../server/operations.mjs';
import { createFirebaseClient } from '../src/account/firebase-client.js';
const values = new Map(), events = new Map();
let blockedKey = '', failReads = false, failSaves = false, loseSave = false, loseClaim = false, holdSave = null, holdClaim = null, writes = 0, claims = 0, clock = Date.parse('2026-10-27');
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem(k, v) { if (k === blockedKey) throw Error('quota'); values.set(k, String(v)); }, removeItem: k => values.delete(k) };
globalThis.addEventListener = (k, f) => events.set(k, [...(events.get(k) || []), f]);
globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
globalThis.location = { search: '', hostname: 'localhost' };
const nativeTimeout = globalThis.setTimeout;
globalThis.setTimeout = (...args) => { const t = nativeTimeout(...args); t.unref(); return t; };
const seed = id => ({ ...P.empty(), nick: id, souls: id === 'a' ? 100 : 700, ch: 5 });
const memory = new MemoryStore({
  hd3d_profiles: ['a', 'b'].map(id => ({ id, nickname: id })),
  hd3d_progress: ['a', 'b'].map(id => ({ user_id: id, data: seed(id), merged: true, updated_at: new Date(clock).toISOString() })),
  hd3d_mail: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => ({ id, user_id: 'a', reward: { souls: 2000, steel: 3 }, claimed: false, revoked: false })),
});
const auth = { currentUser: null, authStateReady: async () => {} };
const sdk = { getApps: () => [], initializeApp: () => ({}), getAuth: () => auth, setPersistence: async () => {}, browserLocalPersistence: 'mock', onAuthStateChanged: () => () => {},
  signInWithEmailAndPassword: async (_, email) => { const uid = email.split('@')[0]; auth.currentUser = { uid, email, getIdToken: async () => 'mock:' + uid }; return { user: auth.currentUser }; }, signOut: async () => { auth.currentUser = null; } };
const fetcher = async (_, options) => {
  const op = JSON.parse(options.body), id = options.headers.Authorization.slice('Bearer mock:'.length), user = { id, email: id + '@example.invalid' };
  const write = op.kind === 'query' && op.table === 'hd3d_progress' && op.action !== 'select', claim = op.kind === 'rpc' && op.name === 'hd3d_claim_mail';
  if (failReads && op.kind === 'query' && op.table === 'hd3d_progress' && op.single) throw Error('offline read');
  if (write) { writes++; if (holdSave) { const h = holdSave; holdSave = null; await h(); } if (failSaves) throw Error('offline mock'); }
  if (claim) { claims++; if (holdClaim) { const h = holdClaim; holdClaim = null; await h(); } }
  let result; try { result = await memory.transaction(tx => execute(tx, user, op, { now: ++clock })); } catch (e) { result = { data: null, error: { code: e.code, message: e.message } }; }
  if (write && loseSave) { loseSave = false; throw Error('save response lost'); }
  if (claim && loseClaim) { loseClaim = false; throw Error('claim response lost'); }
  return new Response(JSON.stringify(result));
};
globalThis.window = { __hd3dCloudMock: config => createFirebaseClient({ ...config, storageMode:'worker', apiUrl:'https://mock.invalid/api/game' }, { sdk, fetch: fetcher }) };
const Acc = await import('../src/account/account.js');
const K = CLOUD.storagePrefix, cloud = id => memory.tables.hd3d_progress.find(x => x.user_id === id);
const login = id => Acc.signIn(id + '@example.invalid', 'mock');
const pass = name => console.log('PASS ' + name);
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
Acc.store(P.empty(), { cloud: false }); Acc.playGuest(); await login('a');
try {
  const navStarted = deferred(), navReleased = deferred(); holdSave = () => { navStarted.resolve(); return navReleased.promise; };
  const priorNavWrites = writes; Acc.update(s => ({ ...s, souls: 101 })); const navSaving = Acc.flush(); await navStarted.promise;
  for (const key of ['beforeunload', 'pagehide']) for (const listener of events.get(key) || []) listener();
  navReleased.resolve(); await navSaving; await Acc.flush();
  assert.equal(writes, priorNavWrites + 1, 'leave events wait for the current save without requesting a duplicate write'); pass('navigation/unload coalesces active save');
  if (process.argv[2] !== 'mail') {
    Acc.update(s => ({ ...s, souls: 150 })); await Acc.signOut(); await login('a');
    assert.equal(Acc.load().souls, 150, 'debounced progress survives logout/login'); assert.equal(cloud('a').data.souls, 150); pass('pending logout/login');
    failSaves = true; Acc.update(s => ({ ...s, souls: 175 })); await Acc.flush(); assert.equal(Acc.A.sync, 'offline'); await Acc.signOut();
    assert.equal(Acc.load().souls, 0, 'guest remains isolated'); await login('b'); assert.equal(Acc.load().souls, 700, 'other account unchanged'); await Acc.signOut();
    await login('a'); assert.equal(Acc.load().souls, 175); failSaves = false; assert.equal(await Acc.flush(), true); assert.equal(cloud('a').data.souls, 175); pass('offline logout, other account and retry');
    const started = deferred(), released = deferred(); holdSave = () => { started.resolve(); return released.promise; };
    Acc.update(s => ({ ...s, souls: 180 })); const saving = Acc.flush(); await started.promise; await Acc.signOut(); await login('b');
    Acc.update(s => ({ ...s, souls: 710 })); await Acc.flush(); assert.equal(cloud('b').data.souls, 710, 'old in-flight save cannot block another account');
    released.resolve(); await saving; assert.equal(Acc.load().souls, 710); await Acc.signOut(); await login('a'); assert.equal(Acc.load().souls, 180); pass('in-flight save session isolation');
    Acc.update(s => ({ ...s, souls: 185 })); blockedKey = K + '_pending_a'; values.delete(blockedKey);
    await assert.rejects(Acc.signOut(), /기기|저장/); assert.equal(Acc.A.user.id, 'a'); assert.equal(Acc.load().souls, 185); blockedKey = ''; await Acc.signOut(); await login('a'); assert.equal(Acc.load().souls, 185); pass('logout refuses unsafe local snapshot');
    await Acc.signOut(); values.set(K + '_uid', 'a'); values.set(K + '_guest', JSON.stringify(P.empty())); values.set(K + '_save', JSON.stringify({ ...Acc.load(), souls: 190 })); values.set(K + '_dirty', '1');
    Acc.playGuest(); assert.equal(Acc.load().souls, 0); await login('a'); assert.equal(Acc.load().souls, 190); pass('expired session guest fallback preserves account');
    blockedKey = K + '_save'; Acc.update(s => ({ ...s, souls: 195 })); assert.equal(Acc.load().souls, 195, 'durable journal is authoritative if the legacy mirror cannot be written'); blockedKey = '';
    await Acc.signOut(); const Restarted = await import('../src/account/account.js?restart'); await Restarted.signIn('a@example.invalid', 'mock'); assert.equal(Restarted.load().souls, 195); await Restarted.signOut(); await login('a'); pass('fresh account module restores durable journal');
    Acc.update(s => ({ ...s, souls: 200 })); await Acc.signOut(); failReads = true; await login('a'); assert.equal(Acc.load().souls, 200); assert.equal(Acc.A.hydrated, false);
    failReads = false; await Promise.all(events.get('online').map(f => f())); assert.equal(Acc.A.hydrated, true); assert.equal(cloud('a').data.souls, 200); pass('offline hydration retries on reconnect');
  }
  if (process.argv[2] !== 'logout') {
    const Sh = await import('../src/account/shop.js'); await Sh.refresh();
    const before = Acc.load(), base = before.souls; failSaves = true;
    const r = await Sh.claim(1); assert.equal(r.ok, false, 'failed save cannot report completed mail'); assert.equal(r.pending, true); assert.deepEqual(Sh.pendingClaims(), [1]);
    assert.equal(Acc.load().souls, base + 2000); assert.equal(cloud('a').data.souls, base); assert.equal(memory.tables.hd3d_mail[0].claimed, true);
    await Sh.claim(1); assert.equal(Acc.load().souls, base + 2000); pass('failed save retains receipt and retry is idempotent');
    await Acc.signOut(); failSaves = false; await login('a'); await Sh.recoverClaims(); await Acc.flush();
    assert.equal(Acc.load().souls, base + 2000); assert.equal(cloud('a').data.souls, base + 2000); assert.deepEqual(Sh.pendingClaims(), []); await Sh.claim(1); assert.equal(Acc.load().souls, base + 2000); pass('relogin recovery and duplicate protection');
    const normal = await Sh.claim(2); assert.equal(normal.ok, true); assert.equal(cloud('a').data.souls, base + 4000); assert.equal(Acc.load().mat.steel, before.mat.steel + 6); assert.deepEqual(Sh.pendingClaims(), []); pass('normal claim saves reward and existing progress');
    loseClaim = true; const lost = await Sh.claim(3); assert.equal(lost.ok, false); assert.deepEqual(Sh.pendingClaims(), [3]);
    await Sh.recoverClaims(); assert.equal(cloud('a').data.souls, base + 6000); assert.deepEqual(Sh.pendingClaims(), []); await Sh.claim(3); assert.equal(Acc.load().souls, base + 6000); pass('lost RPC response replay');
    loseSave = true; const uncertain = await Sh.claim(4); assert.equal(uncertain.ok, false); assert.deepEqual(Sh.pendingClaims(), [4]);
    await Acc.signOut(); await login('a'); await Sh.recoverClaims(); assert.equal(Acc.load().souls, base + 8000); assert.equal(cloud('a').data.souls, base + 8000); assert.deepEqual(Sh.pendingClaims(), []); pass('committed save with lost response does not duplicate');
    blockedKey = K + '_mailpend_a'; const prior = claims; const noJournal = await Sh.claim(5); assert.equal(noJournal.ok, false); assert.equal(claims, prior, 'no RPC before durable journal'); blockedKey = ''; pass('storage failure prevents unsafe claim');
    const start = deferred(), release = deferred(); holdClaim = () => { start.resolve(); return release.promise; };
    const late = Sh.claim(5); await start.promise; await Acc.signOut(); await login('b'); release.resolve(); await late;
    assert.equal(Acc.load().souls, cloud('b').data.souls); assert.ok(JSON.parse(values.get(K + '_mailpend_a')).includes(5));
    await Acc.signOut(); await login('a'); await Sh.recoverClaims(); assert.equal(cloud('a').data.souls, base + 10000); pass('late mail response cannot reward another session');
    Acc.A.conflict = { local: Acc.load(), cloud: Acc.load() }; const beforeConflict = claims;
    assert.equal((await Sh.claim(6)).ok, false); assert.equal(claims, beforeConflict); Acc.A.conflict = null; pass('conflict blocks mail claims');
    Acc.update(s => ({ ...s, mailLog: Array.from({ length: 300 }, (_, i) => 1000 + i) })); await Acc.flush();
    const older = await Sh.claim(6); assert.equal(older.ok, true, 'an older unclaimed mail still fits in a full receipt ledger'); assert.ok(Acc.load().mailLog.includes(6));
    const total = Acc.load().souls; await Sh.claim(6); assert.equal(Acc.load().souls, total); pass('out-of-order mail with full receipt ledger');
    blockedKey = K + '_pending_a'; const noSave = await Sh.claim(7); assert.equal(noSave.ok, false); assert.equal(Acc.load().souls, total); assert.deepEqual(Sh.pendingClaims(), [7]);
    blockedKey = ''; await Sh.claim(7); assert.equal(cloud('a').data.souls, total + 2000); pass('local save failure after server claim recovers once');
    for (const id of [8, 9]) memory.tables.hd3d_mail.find(x => x.id === id).claimed = true;
    values.set(K + '_mailpend_a', '[8,9]'); await Sh.recoverClaims(); assert.deepEqual(Sh.pendingClaims(), []); assert.equal(cloud('a').data.souls, total + 6000); pass('legacy multi-receipt queue drains sequentially');
    const startedAgain = deferred(), releaseAgain = deferred(); holdClaim = () => { startedAgain.resolve(); return releaseAgain.promise; };
    const oldSession = Sh.claim(10); await startedAgain.promise; assert.equal((await Sh.claim(10)).busy, true);
    await Acc.signOut(); await login('a'); releaseAgain.resolve(); assert.equal((await oldSession).ok, false); assert.equal(Acc.load().souls, total + 6000);
    await Sh.recoverClaims(); assert.equal(cloud('a').data.souls, total + 8000); assert.deepEqual(Sh.pendingClaims(), []); pass('same-account new session rejects late claim and double-click');
  }
} finally { blockedKey = ''; await Acc.signOut(); }
