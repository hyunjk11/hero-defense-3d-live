// Transport adapter keeps existing save CAS, mail receipts and gameplay account APIs intact.
import {resolveFunctionsConfig} from './functions-config.js';
export async function createFirebaseClient(config, options = {}) {
  // A misspelled/unreleased direct profile must not silently use the Sites API.
  if(config.storageMode && !['worker','firestore-direct-prototype','firestore-direct','functions','functions-prototype'].includes(config.storageMode))
    throw Object.assign(new Error('Unsupported storage profile; no fallback connection was made'),{code:'STORAGE_MODE_UNSUPPORTED'});
  const directModule = ['firestore-direct-prototype','firestore-direct'].includes(config.storageMode) ? await import('./direct-store.js') : null;
  const directConfig=directModule?.assertDirectConfig(config);
  const functionsConfig=['functions','functions-prototype'].includes(config.storageMode)?resolveFunctionsConfig(config):null;
  const authConfig=directConfig||functionsConfig;
  const sdk = options.sdk || await (authConfig?import('../../lib/firebase-auth-direct.mjs'):import('../../lib/firebase-auth.mjs'));
  // Demo Auth must stay isolated. Live direct uses the existing Firebase app/session.
  if(authConfig?.emulated && (!/^http:\/\/127\.0\.0\.1:\d+$/.test(config.authEmulator||'') || typeof sdk.connectAuthEmulator!=='function'))
    throw Object.assign(new Error('Direct prototype requires a local Auth emulator-capable SDK'),{code:'DIRECT_AUTH_UNAVAILABLE'});
  const appName = authConfig?.emulated ? 'hero-defense-live-demo' : 'hero-defense-live';
  const app = sdk.getApps().find(x => x.name === appName) || sdk.initializeApp(config.firebase, appName);
  if(app.options && app.options.projectId!==config.firebase.projectId)throw Object.assign(Error('Firebase app project mismatch'),{code:'DIRECT_CONFIG_INVALID'});
  const auth = sdk.getAuth(app);
  if(authConfig && !authConfig.emulated && auth.emulatorConfig)throw Object.assign(Error('Live profile cannot reuse emulator Auth'),{code:'DIRECT_CONFIG_INVALID'});
  if(authConfig?.emulated && !auth.emulatorConfig)sdk.connectAuthEmulator(auth,config.authEmulator,{disableWarnings:true});
  await sdk.setPersistence(auth, sdk.browserLocalPersistence);
  await auth.authStateReady();
  const fetcher = options.fetch || fetch;
  const direct = directModule
    ? (options.directFactory || directModule.createDirectTransport)(config, { auth, fetcher })
    : null;
  const userOf = user => user ? { id: user.uid, email: user.email, identities: [{ provider: 'email' }] } : null;
  const marker = value => { try { if (value) localStorage.setItem(config.authStorageKey, '1'); else localStorage.removeItem(config.authStorageKey); } catch {} };
  const ensureAccount=async user=>{if(direct&&user){const {ensureDirectAccount}=await import('./direct-bootstrap.js');await ensureDirectAccount(config,{auth,user,fetcher});}};
  const authResult = async action => { try { const credential = await action(); await ensureAccount(credential.user); marker(true); return { data: { user: userOf(credential.user), session: { user: userOf(credential.user) } }, error: null }; } catch (e) { return { data: null, error: { code: e.code, message: e.message } }; } };
  const writes = new Map();
  const readonly = op => op.kind === 'query' && op.action === 'select' || op.kind === 'rpc' && ['hd3d_my_status','hd3d_is_admin','hd3d_is_owner','hd3d_is_banned'].includes(op.name);
  const changed = () => ({ data: null, error: { code: 'ACCOUNT_CHANGED', message: 'Account session changed' }, status: 0 });
  async function dispatch(body, user) {
    try {
      if (auth.currentUser !== user) return changed();
      if (direct) return await direct(JSON.parse(body), user);
      const token = await user.getIdToken();
      if (auth.currentUser !== user) return changed();
      const response = await fetcher(config.apiUrl, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token }, body });
      const result = await response.json();
      if (auth.currentUser !== user) return changed();
      if (!response.ok && !result.error) return { data: null, error: { message: 'Server request failed', status: response.status }, status: response.status };
      return { ...result, status: response.status };
    } catch (e) { return { data: null, error: { message: e.message || String(e), code: e.code || 'NETWORK_ERROR', status: 0 }, status: 0 }; }
  }
  async function send(operation) {
    // Snapshot the operation/session before a queue wait. Never reuse a queued A
    // operation with B's newly acquired token. No transport-level replay.
    await auth.authStateReady(); const user = auth.currentUser;
    if (!user) return { data: null, error: { code: '42501', message: 'not authenticated' }, status: 401 };
    const body = JSON.stringify(operation);
    if (readonly(operation)) return dispatch(body, user);
    const task = (writes.get(user.uid) || Promise.resolve()).then(() => dispatch(body, user));
    writes.set(user.uid, task);
    const cleanup = () => { if (writes.get(user.uid) === task) writes.delete(user.uid); };
    task.then(cleanup, cleanup);
    return task;
  }
  async function drain() {
    await auth.authStateReady(); const user = auth.currentUser;
    if (!user) return;
    while (auth.currentUser === user && writes.has(user.uid)) await writes.get(user.uid);
  }
  function from(table) {
    const state = { kind: 'query', table, action: 'select', columns: '*', filters: {}, returning: false };
    let promise;
    const q = {
      select(columns = '*') { state.columns = columns; if (state.action !== 'select') state.returning = true; return q; },
      eq(field, value) { state.filters[field] = value; return q; },
      limit(count) { state.limit = count; return q; },
      order(field, { ascending = true } = {}) { state.order = { field, ascending }; return q; },
      maybeSingle() { state.single = true; return q; },
      insert(values) { state.action = 'insert'; state.values = values; return q; },
      update(values) { state.action = 'update'; state.values = values; return q; },
      upsert(values) { state.action = 'upsert'; state.values = values; return q; },
      then(resolve, reject) { promise ||= send(state); return promise.then(resolve, reject); },
    };
    return q;
  }
  return {
    from, drain, atomicMail:!!direct||!!functionsConfig, atomicGear:!!direct||!!functionsConfig, serverEconomy:!!functionsConfig,
    rpc: (name, args = {}) => send({ kind: 'rpc', name, args }),
    auth: {
      async getSession() { await auth.authStateReady(); await ensureAccount(auth.currentUser); const user = userOf(auth.currentUser); return { data: { session: user ? { user } : null }, error: null }; },
      signInWithPassword: ({ email, password }) => authResult(() => sdk.signInWithEmailAndPassword(auth, email, password)),
      signUp: ({ email, password }) => authResult(() => sdk.createUserWithEmailAndPassword(auth, email, password)),
      async signOut() { await sdk.signOut(auth); marker(false); return { error: null }; },
      onAuthStateChange(callback) {
        let first = true;
        return sdk.onAuthStateChanged(auth, user => { marker(!!user); const event = first ? 'INITIAL_SESSION' : user ? 'SIGNED_IN' : 'SIGNED_OUT'; first = false; callback(event, user ? { user: userOf(user) } : null); });
      },
    },
  };
}
