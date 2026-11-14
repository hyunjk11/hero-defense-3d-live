import assert from 'node:assert/strict';
const values = new Map(), elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { value: '', textContent: '', dataset: {}, disabled: false, hidden: false, addEventListener() {} });
  return elements.get(id);
};
globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, visibilityState: 'visible', getElementById: element,
  querySelectorAll: () => ['lgIn', 'lgUp', 'lgGuest', 'lgEmail', 'lgPw'].map(element) };
globalThis.location = { search: '', hostname: 'localhost' };
let signupCalls = 0, signinCalls = 0, signupReply, signinReply;
const client = { auth: {
  onAuthStateChange() {},
  signUp: async () => { signupCalls++; return await signupReply; },
  signInWithPassword: async () => { signinCalls++; return signinReply; },
  signOut: async () => ({}),
}, from: () => {
  const query = { select: () => query, eq: () => query, limit: async () => ({ data: [] }),
    maybeSingle: async () => ({ data: null }), upsert: async () => ({}), insert: () => query,
    then: resolve => Promise.resolve({ data: [{ updated_at: 'saved' }] }).then(resolve) };
  return query;
} };
globalThis.window = { __hd3dCloudMock: () => client };
const Acc = await import('../src/account/account.js');
const user = { id: 'auth-test', email: 'test@example.invalid', identities: [{ provider: 'email' }] };
// Immediate-session signup must activate the account and perform cloud initialization.
signupReply = { data: { user, session: { user } } };
assert.equal((await Acc.signUp(user.email, 'unused')).id, user.id);
assert.equal(Acc.A.user.id, user.id);
assert.equal(signinCalls, 0, 'signup uses its session, without another login request');
assert.equal(Acc.A.sync, 'saved');
await Acc.signOut();

// A misconfigured backend must never look like a successful authenticated session.
signupReply = { data: { user, session: null } };
await assert.rejects(Acc.signUp(user.email, 'unused'), e => e.code === 'signup_configuration_mismatch');
assert.equal(Acc.A.user, null);
assert.equal(signinCalls, 0);
assert.equal(Acc.resendConfirmation, undefined, 'email confirmation resend has been removed');
assert.doesNotMatch(Acc.koErr({ code: 'email_not_confirmed' }), /확인 링크|스팸함/);
assert.doesNotMatch(Acc.koErr({ code: 'over_email_send_rate_limit' }), /재발송|스팸함/);
signupReply = { data: { user: { ...user, identities: [] }, session: null } };
await assert.rejects(Acc.signUp(user.email, 'unused'), /이미 가입/);
signupReply = { error: { code: 'user_already_exists', status: 422 } };
await assert.rejects(Acc.signUp(user.email, 'unused'), e => e.code === 'user_already_exists');

// Exercise the actual UI module: a signup click enters the menu directly.
const { Snd } = await import('../src/audio/audio.js'); Snd.play = () => {};
const { G } = await import('../src/core/state.js');
const UI = await import('../src/ui/auth.js');
UI.initAuth({ show: screen => { G.screen = screen; } });
G.screen = 'login'; element('lgEmail').value = user.email; element('lgPw').value = 'unused';
let finish;
signupReply = new Promise(resolve => { finish = resolve; });
const beforeSignup = signupCalls, first = UI.doAuth('up');
await UI.doAuth('up'); await UI.doAuth('in');
finish({ data: { user, session: { user } } }); await first;
assert.equal(signupCalls, beforeSignup + 1, 'double-click/Enter cannot create concurrent requests');
assert.equal(signinCalls, 0);
assert.equal(G.screen, 'menu');
assert.equal(Acc.A.user.id, user.id);
assert.equal(element('lgMsg').textContent, '');
assert.equal(element('lgIn').disabled, false);
assert.equal(element('lgPw').value, '');
await Acc.signOut();

G.screen = 'login'; element('lgPw').value = 'unused';
signinReply = { error: { code: 'invalid_credentials', message: 'Invalid login credentials' } };
await UI.doAuth('in');
assert.equal(G.screen, 'login'); assert.match(element('lgMsg').textContent, /비밀번호가 맞지/);
assert.equal(element('lgIn').disabled, false, 'errors release the input lock');
signinReply = { data: { user } }; await UI.doAuth('in');
assert.equal(G.screen, 'menu'); assert.equal(Acc.A.user.id, user.id);
assert.equal(element('lgPw').value, '');
await Acc.signOut();
console.log('Immediate signup/session/cloud initialization, no email flow, duplicate rejection, concurrent input and password login passed.');
