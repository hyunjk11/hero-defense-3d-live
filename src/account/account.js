// Local-first saves with session ownership, CAS and explicit whole-snapshot conflicts.
import { CLOUD } from '../config/cloud.js';
import * as P from './progress.js';
import * as ST from './storage.js';
import { reconcile, sameSave } from './snapshots.js';
import { ls } from '../core/store.js';
import { durableSet } from './durable.js';
import {authorityOf,stable,trainingIntent} from './direct-authority.js';
import { isHidden } from '../data/heroes.js';

const T = CLOUD.tables, AUTH_KEY = CLOUD.authStorageKey, K = CLOUD.storagePrefix, K_SAVE = K + '_save', K_GUEST = K + '_guest', K_UID = K + '_uid', K_DIRTY = K + '_dirty', K_MODE = K + '_mode';
const mergedKey = uid => K + '_merged_' + uid, tsKey = uid => K + '_cloud_ts_' + uid;
// 📦 창고 (2026-10-24): 서버에는 창고를 압축해서 저장(ST.packSave) · 이 계정의 마지막 동기화 창고를 기기에 따로 보관 → 옛 클라이언트가 'stor' 없이 덮어쓴 행을 읽으면 복구(ST.healStor)
const storKey = uid => K + '_stor_' + uid, storBak = (uid, d) => { const p = ST.packSave(d); ls.set(storKey(uid), JSON.stringify({ stor: p.stor || [], storX: d.storX || 0 })); };
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

export const A = { sb: null, user: null, tables: 'unknown', sync: 'local', msg: '', listeners: [], mode: ls.get(K_MODE) || '', conflicts: 0, conflict: null, leaving: false, banned: false, hydrated: false }; // mode: '' | 'guest' | 'account'
let timer = 0, retry = 0, sbP = null, sessionEpoch = 0;
export const sessionId = () => sessionEpoch;
export const ready = () => !!A.user && A.hydrated && !A.conflict && !A.banned;
let confirmedMail = new Set();
export const mailSaved = id => confirmedMail.has(id) && load().mailLog.includes(id);
const pendingKey = uid => K + '_pending_' + uid;
const nickKey = uid => K + '_nick_pending_' + uid;
const pendingNick = uid => { const p = parse(ls.get(nickKey(uid))); return p && typeof p.nick === 'string' ? p : null; };
function clearNick(uid, expected) {
  if (expected && pendingNick(uid)?.nick !== expected.nick) return;
  durableSet(nickKey(uid), 'null'); ls.del(nickKey(uid));
}
const dirty = uid => ls.get(K_DIRTY) === '1' || !!pendingNick(uid);
const serverSaveKey = uid => K + '_server_save_' + uid;
let serverSaveJob = null;
export function serverSaveState() {
  const uid=A.user?.id;if(!uid)return null;
  const pending=parse(ls.get(serverSaveKey(uid))),job=serverSaveJob?.uid===uid&&serverSaveJob.epoch===sessionEpoch?serverSaveJob:null;
  return pending||job?{token:pending?.token||job.token,busy:!!job}:null;
}
export const SAVE_WAIT_MESSAGE = '저장 확인 후 다시 시도해 주세요.';
const saveBlockedListeners = [];
export const onSaveBlocked = fn => saveBlockedListeners.push(fn);
export function saveAllowed() {
  if (!serverSaveState()) return true;
  saveBlockedListeners.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
  return false;
}
function guardServerSave(){if(!saveAllowed())throw Object.assign(new Error(SAVE_WAIT_MESSAGE),{code:'server_save_pending'});}
// Guard before flush; the durable marker survives an uncertain server commit.
export function beginServerSave(token){
  if(!A.user||serverSaveJob?.uid===A.user.id&&serverSaveJob.epoch===sessionEpoch)throw new Error('저장 확인이 이미 진행 중입니다.');
  const pending=serverSaveState();if(pending&&pending.token!==token)throw new Error('이전 보상 저장을 확인해 주세요.');
  const job={uid:A.user.id,epoch:sessionEpoch,token};serverSaveJob=job;emit();return job;
}
export function markServerSave(job){if(!ownsSession(job.uid,job.epoch))return false;durableSet(serverSaveKey(job.uid),JSON.stringify({token:job.token}));return true;}
export function finishServerSave(job,confirmed=false){
  const current=ownsSession(job.uid,job.epoch);
  if(current&&confirmed&&parse(ls.get(serverSaveKey(job.uid)))?.token===job.token){durableSet(serverSaveKey(job.uid),'null');ls.del(serverSaveKey(job.uid));}
  if(serverSaveJob===job)serverSaveJob=null;if(current)emit();
}
export const canResolveLocal = () => !A.conflict || (A.conflict.local.hardRewardSeq||0)===(A.conflict.cloud.hardRewardSeq||0);
function preservePending(uid = ls.get(K_UID), data = load()) {
  if (uid && (ls.get(K_DIRTY) === '1' || ls.get(pendingKey(uid)))) durableSet(pendingKey(uid), JSON.stringify({ data, base: ls.get(tsKey(uid)), merged: ls.get(mergedKey(uid)) === '1' }));
}
function restorePending(uid) {
  const p = parse(ls.get(pendingKey(uid))); if (!p?.data) return;
  durableSet(K_SAVE, JSON.stringify(P.clean(p.data))); durableSet(K_DIRTY, '1');
  if (p.base) durableSet(tsKey(uid), p.base); else ls.del(tsKey(uid));
  if (p.merged) durableSet(mergedKey(uid), '1'); else ls.del(mergedKey(uid));
}
function confirmed(uid, data) {
  confirmedMail = new Set(P.clean(data).mailLog);
  if (sameSave(data, load())) { durableSet(K_SAVE, JSON.stringify(P.clean(data))); ls.del(K_DIRTY); ls.del(pendingKey(uid)); }
  else preservePending(uid);
}
const ownsSession = (uid, epoch) => A.user?.id === uid && sessionEpoch === epoch;
function backup(reason, local, cloud) {
  const key = K + '_snapshot_backups', rows = parse(ls.get(key)) || [];
  rows.push({ at: new Date().toISOString(), uid: A.user?.id || null, reason, local, cloud });
  ls.set(key, JSON.stringify(rows.slice(-5)));
}
function conflict(local, cloud, updatedAt) {
  clearTimeout(timer); backup('conflict', local, cloud);
  A.conflicts++; A.conflict = { local: P.clean(local), cloud: P.clean(cloud), updatedAt };
  A.sync = 'conflict'; ls.set(K_DIRTY, '1'); emit();
}
const emit = () => { if (A.banned && A.user) A.sync = 'banned'; A.listeners.forEach(f => { try { f(A); } catch (e) { console.warn(e); } }); };
export const onChange = f => A.listeners.push(f);
// 계정 정지 (서버 hd3d_my_status → account/shop.js): 서버 저장을 멈추고 이 기기에만 저장. 해제되면 밀린 저장을 다시 올림
let deniedHook = () => {};
export const onDenied = f => { deniedHook = f; };
export function setBanned(b) { b = !!b; if (A.banned === b) return; A.banned = b; clearTimeout(timer);
  if (b) { A.sync = 'banned'; emit(); } else if (A.user && A.tables === 'ok') { if (dirty(A.user.id)) save(); else { A.sync = 'saved'; emit(); } } }

// ---------- 로컬 저장 ----------
export function load() { const owner = ls.get(K_UID), raw = (owner && parse(ls.get(pendingKey(owner)))?.data) || parse(ls.get(K_SAVE)) || {}; if (raw.v && raw.v < 2 && !ls.get(K + '_pre_v2')) ls.set(K + '_pre_v2', JSON.stringify(raw)); if (raw.v && raw.v < 3) { const bk = K + '_pre_unique_removal_' + (ls.get(K_UID) || 'guest'); if (!ls.get(bk)) ls.set(bk, JSON.stringify(raw)); } if (raw.v && raw.v < 4) { const key = K + '_pre_growth_' + (owner || 'guest'); if (!ls.get(key)) durableSet(key, JSON.stringify(raw)); } const s = P.clean(raw); if (raw.v && raw.v < 3) ls.set(K_SAVE, JSON.stringify(s)); if (!ls.get(K_SAVE)) migrateOld(s); else if (raw.hero !== s.hero && isHidden(raw.hero)) store(s); return s; } // 숨긴 영웅 → 기본 영웅 이전은 바로 저장
function migrateOld(s) { const b = +ls.get(K + '_best') || 0; s.bestWave = Math.max(s.bestWave, b); const a = parse(ls.get(K + '_audio')); if (a) s.settings.audio = P.clean({ settings: { audio: a } }).settings.audio; }
export function store(s, { cloud = true } = {}) {
  if(cloud)guardServerSave();
  s = P.clean(s);
  if(cloud&&A.user&&A.sb?.atomicGear){const before=authorityOf(P.clean(parse(ls.get(K_SAVE))||{})),after=authorityOf(s);
    if(stable(before)!==stable(after)&&!trainingIntent(before,after))throw Object.assign(new Error('아직 지원하지 않는 저장 요청입니다.'),{code:'DIRECT_ACTION_REQUIRED'});
  }
  // Write ahead before replacing the active save. A failed local write must be visible.
  if (cloud && A.user) { durableSet(K_DIRTY, '1'); preservePending(A.user.id, s); }
  if (!cloud && A.user && ls.get(pendingKey(A.user.id))) preservePending(A.user.id, s);
  // The account journal is authoritative until acknowledged; K_SAVE is a legacy mirror.
  if (A.user && ls.get(pendingKey(A.user.id))) ls.set(K_SAVE, JSON.stringify(s)); else durableSet(K_SAVE, JSON.stringify(s));
  if (cloud && A.user) schedule(); emit(); return s;
}
export function update(fn) { guardServerSave();return store(fn(load())); }

export function koErr(e) {
  const c = String(e?.code || e?.error_code || ''), m = String(e?.message || e || '');
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(c)) return '이메일 또는 비밀번호가 맞지 않습니다.';
  if (c === 'auth/email-already-in-use') return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (c === 'auth/weak-password') return '비밀번호는 6자 이상이어야 합니다.';
  if (c === 'auth/invalid-email') return '이메일 형식이 올바르지 않습니다.';
  if (c === 'auth/user-disabled') return '사용이 중지된 계정입니다.';
  if (c === 'auth/too-many-requests') return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (c === 'invalid_credentials' || /invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않습니다.';
  if (c === 'email_not_confirmed' || /email not confirmed/i.test(m)) return '계정 서버에 이전 가입 설정이 남아 있습니다. 운영자에게 계정 활성화를 요청해 주세요.';
  if (c === 'user_already_exists' || c === 'email_exists' || /already registered/i.test(m)) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (c === 'weak_password' || /password should|at least/i.test(m)) return '비밀번호는 6자 이상이어야 합니다.';
  if (c === 'email_address_invalid' || /invalid format|is invalid|validate email/i.test(m)) return '이메일 형식이 올바르지 않습니다.';
  if (c === 'signup_disabled' || /signups not allowed/i.test(m)) return '현재 회원가입이 막혀 있습니다.';
  if (c === 'over_email_send_rate_limit' || c === 'email_address_not_authorized' || /email rate limit/i.test(m)) return '계정 서버의 가입 설정이 아직 적용되지 않았습니다. 운영자에게 문의해 주세요.';
  if (c.startsWith('over_') || /rate limit|too many/i.test(m) || e?.status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (/failed to fetch|network|load failed|fetch/i.test(m)) return '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';
  return '오류가 발생했습니다: ' + (m || c || '알 수 없음');
}
function authError(e) {
  return Object.assign(new Error(koErr(e)), { code: e?.code || e?.error_code || '', status: e?.status });
}

// ---------- Firebase 클라이언트 ----------
async function loadClient() {
  const create = window.__hd3dCloudMock || (await import('./firebase-client.js')).createFirebaseClient;
  // 페이지를 떠나는 중(A.leaving)에 보내는 쓰기 요청은 keepalive (탭이 닫혀도 브라우저가 끝까지 보냄, 본문 64KB 제한 = 저장 jsonb 상한과 같음)
  const kf = (u, o = {}) => fetch(u, A.leaving && o.method && o.method !== 'GET' ? { ...o, keepalive: true } : o);
  // The old provider session cannot authenticate Firebase. Keep its local save and CAS base until the same UID signs in.
  if (ls.get(CLOUD.legacyAuthStorageKey) && !ls.get(K + '_pre_firebase')) ls.set(K + '_pre_firebase', JSON.stringify({ uid: ls.get(K_UID), save: ls.get(K_SAVE), dirty: ls.get(K_DIRTY), at: new Date().toISOString() }));
  A.sb = await create(CLOUD, { fetch: kf });
  A.sb.auth.onAuthStateChange(ev => { const epoch = sessionEpoch; setTimeout(() => { if (ev === 'SIGNED_OUT' && A.user && epoch === sessionEpoch) { try { restoreGuest(); } catch (e) { A.msg = e.message; emit(); } } }, 0); });
  return A.sb;
}
export function ensureClient() { if (!sbP) sbP = loadClient().catch(e => { sbP = null; throw e; }); return sbP; }
export const hasSession = () => !!ls.get(AUTH_KEY);

// 저장된 세션이 있으면 자동 로그인. 결과: true(로그인됨) / false
export async function autoLogin() {
  if (!hasSession()) return false;
  try { const sb = await ensureClient(); const { data } = await sb.auth.getSession(); if (data?.session?.user) { await onLogin(data.session.user); return true; } } catch (e) { A.msg = koErr(e); }
  // Expired/offline sessions must not replace unsynced account progress with a guest snapshot.
  return false;
}
export async function signIn(email, pw) {
  const sb = await ensureClient(); const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) throw authError(error); await onLogin(data.user); return A.user;
}
// 가입 응답의 세션으로 바로 로그인한다.
export async function signUp(email, pw) {
  const sb = await ensureClient(); const { data, error } = await sb.auth.signUp({ email, password: pw });
  if (error) throw authError(error);
  if (data?.session?.user) { await onLogin(data.session.user); return A.user; }
  if (data?.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.');
  if (data?.user) throw Object.assign(new Error('계정 서버의 가입 설정이 아직 적용되지 않았습니다. 운영자에게 문의해 주세요.'), { code: 'signup_configuration_mismatch' });
  throw new Error('가입 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}
export function playGuest() { if (A.user) return; if (ls.get(K_UID)) restoreGuest(); A.mode = 'guest'; ls.set(K_MODE, 'guest'); A.sync = 'local'; emit(); }
export async function signOut() { restoreGuest(); try { if (A.sb) await A.sb.auth.signOut(); } catch (e) {} }

function restoreGuest() {
  preservePending(); // Refuse logout if the unsynced account snapshot cannot be kept.
  durableSet(K_SAVE, ls.get(K_GUEST) || JSON.stringify(P.empty()));
  sessionEpoch++; A.conflict = null; A.hydrated = false; confirmedMail.clear();
  A.user = null; A.tables = 'unknown'; A.sync = 'local'; A.banned = false; clearTimeout(timer);
  ls.del(K_GUEST); ls.del(K_UID); ls.del(K_DIRTY); A.mode = ''; ls.set(K_MODE, ''); emit();
}

async function onLogin(u) {
  if (A.user?.id === u.id) return;
  const cur = ls.get(K_UID) || ''; if (cur && cur !== u.id) restoreGuest();
  const epoch = ++sessionEpoch;
  if (!ls.get(K_UID)) durableSet(K_GUEST, JSON.stringify(load()));
  restorePending(u.id); A.hydrated = false; confirmedMail.clear();
  A.user = u; A.conflict = null; A.mode = 'account'; ls.set(K_MODE, 'account'); ls.set(K_UID, u.id);
  ls.del(CLOUD.legacyAuthStorageKey);
  A.sync = 'loading'; emit();
  // The actual row reads also check availability; avoid a second pair of empty probes.
  A.tables = 'unknown'; await loadCloud();
}
async function onRetry(uid, epoch) {
  if (ownsSession(uid, epoch)) await loadCloud();
}
export async function reloadAuthoritative(){const uid=A.user?.id,epoch=sessionEpoch;if(!uid)return false;await loadCloud();return ownsSession(uid,epoch)&&ready()&&A.sync==='saved';}
async function loadCloud() {
  if (!A.user) return; const uid = A.user.id, epoch = sessionEpoch;
  try {
    const [progress, pr] = await Promise.all([
      A.sb.from(T.progress).select('data, merged, updated_at').eq('user_id', uid).maybeSingle(),
      A.sb.from(T.profiles).select('nickname').eq('id', uid).maybeSingle(),
    ]);
    if (!ownsSession(uid, epoch)) return;
    const error = progress.error || (pr.error?.code !== '42501' && pr.error);
    if (error) { A.tables = ['PGRST205', '42P01'].includes(error.code) || progress.status === 404 || pr.status === 404 ? 'missing' : 'error'; throw error; }
    A.tables = 'ok'; const row = progress.data;
    const local = load(), cloud = ST.healStor(row?.data || null, parse(ls.get(storKey(uid))));
    const decision = !cloud&&A.sb?.serverEconomy ? {source:'cloud',data:{...P.empty(),hero:local.hero,settings:local.settings,nick:local.nick}} : reconcile(local, cloud, { first: ls.get(mergedKey(uid)) !== '1', dirty: ls.get(K_DIRTY) === '1', changed: row?.updated_at !== ls.get(tsKey(uid)) });
    confirmedMail = new Set(P.clean(cloud || {}).mailLog);
    if (decision.source === 'conflict') { A.hydrated = true; conflict(local, cloud, row?.updated_at); return; }
    backup('hydrate', local, row?.data || null);
    ls.set(mergedKey(uid), '1'); if (row) ls.set(tsKey(uid), row.updated_at); else ls.del(tsKey(uid));
    store(decision.data, { cloud: false }); storBak(uid, load()); A.hydrated = true;
    if (!ownsSession(uid, epoch)) return;
    const nick = pendingNick(uid);
    if (nick) { store({ ...load(), nick: nick.nick }, { cloud: false }); ls.set(K_DIRTY, '1'); }
    else if (!pr.error && pr.data?.nickname) store({ ...load(), nick: pr.data.nickname }, { cloud: false });
    else if (!pr.error && !serverSaveState()) queueNick(load().nick || (A.user.email || '용사').split('@')[0].slice(0, 12));
    if (!ownsSession(uid, epoch)) return;
    if (pendingNick(uid) || !cloud || cloud.v !== 4 || !sameSave(cloud, load())) { ls.set(K_DIRTY, '1'); await save(); }
    else { confirmed(uid, cloud); A.sync = 'saved'; }
  } catch (e) {
    if (!ownsSession(uid, epoch)) return; A.sync = A.tables === 'missing' ? 'missing' : 'offline'; A.msg = koErr(e);
    if (A.hydrated) schedule(true);
    else { clearTimeout(timer); timer = setTimeout(() => { if (ownsSession(uid, epoch)) loadCloud(); }, CLOUD.retryMs[Math.min(retry++, CLOUD.retryMs.length - 1)]); }
  }
  emit();
}
export async function resolveConflict(source) {
  if (!A.conflict || !A.user || !['local', 'cloud'].includes(source)) return false;
  if(source==='local'&&!canResolveLocal())throw new Error('서버 보상 전의 기록은 덮어쓸 수 없습니다. 두 기록을 백업한 뒤 서버 기록을 확인해 주세요.');
  const uid = A.user.id, epoch = sessionEpoch, pending = A.conflict;
  const c = await A.sb.from(T.progress).select('data, updated_at').eq('user_id', uid).maybeSingle();
  if (!ownsSession(uid, epoch)) return false; if (c.error) throw new Error(koErr(c.error));
  if (c.data?.updated_at !== pending.updatedAt) { conflict(load(), c.data?.data || {}, c.data?.updated_at); return false; }
  backup('user-choice-' + source, load(), c.data?.data || null);
  const chosen = source === 'local' ? load() : P.clean(c.data?.data || {});
  if (source === 'cloud' && pendingNick(uid)) clearNick(uid);
  A.conflict = null; A.hydrated = true; ls.set(mergedKey(uid), '1');
  if (c.data) ls.set(tsKey(uid), c.data.updated_at); else ls.del(tsKey(uid));
  store(chosen, { cloud: false });
  if (source === 'cloud') { confirmed(uid, chosen); A.sync = 'saved'; storBak(uid, chosen); emit(); return true; }
  ls.set(K_DIRTY, '1'); preservePending(uid); emit(); return save();
}
function queueNick(nick) {
  guardServerSave(); nick = String(nick || '').trim().slice(0, 12) || '용사';
  // Persist the intent before either request. Profile and progress must both be
  // confirmed; an offline profile failure cannot be hidden by a saved progress.
  if (A.user) durableSet(nickKey(A.user.id), JSON.stringify({ nick }));
  store({ ...load(), nick }, { cloud: !!A.user });
  return nick;
}
export async function saveNick(nick) {
  nick = queueNick(nick);
  if (ready() && A.tables === 'ok') await save();
  return nick;
}
function schedule(isRetry) {
  clearTimeout(timer); if (!A.user || !A.hydrated || A.tables !== 'ok' || A.conflict) return; if (A.banned) { A.sync = 'banned'; return; }
  const ms = isRetry ? CLOUD.retryMs[Math.min(retry++, CLOUD.retryMs.length - 1)] : CLOUD.saveDebounceMs; A.sync = isRetry ? 'offline' : 'pending';
  timer = setTimeout(() => save(), ms);
}
let inflight = null;
export function save() {
  if (!A.user || !A.hydrated || A.tables !== 'ok' || A.conflict) return Promise.resolve(false); if (A.banned) { A.sync = 'banned'; emit(); return Promise.resolve(false); }
  const uid = A.user.id, epoch = sessionEpoch;
  if (inflight?.epoch === epoch) { inflight.again = true; return inflight.promise; }
  const job = { epoch, again: false }; inflight = job;
  job.promise = (async () => { let r; do { job.again = false; r = await saveOnce(); } while (job.again && r && ownsSession(uid, epoch)); return r; })().finally(() => {
    if (inflight === job) inflight = null;
    if (ownsSession(uid, epoch) && !A.conflict && dirty(uid) && A.sync !== 'offline') schedule();
  });
  return job.promise;
}
async function saveOnce() {
  if (!A.user || A.tables !== 'ok' || A.conflict) return false; clearTimeout(timer); A.sync = 'saving'; emit(); const uid = A.user.id, epoch = sessionEpoch;
  try {
    for (let i = 0; i < 4; i++) {
      const nick = pendingNick(uid);
      if (nick && load().nick !== nick.nick) store({ ...load(), nick: nick.nick }, { cloud: false });
      const base = ls.get(tsKey(uid)), data = load(), row = { data: ST.packSave(data), merged: true };
      if (nick) {
        const p = await A.sb.from(T.profiles).upsert({ id: uid, nickname: nick.nick });
        if (!ownsSession(uid, epoch)) return false;
        if (p.error) throw p.error;
      }
      const r = base ? await A.sb.from(T.progress).update(row).eq('user_id', uid).eq('updated_at', base).select('updated_at')
        : await A.sb.from(T.progress).insert({ user_id: uid, ...row }).select('updated_at');
      if (r.error && !(!base && r.error.code === '23505')) throw r.error;
      const ok = !r.error && Array.isArray(r.data) && r.data[0];
      if (!ownsSession(uid, epoch)) return false;
      if (ok) { ls.set(tsKey(uid), ok.updated_at); storBak(uid, data); if (nick) clearNick(uid, nick); confirmed(uid, data); retry = 0; A.sync = dirty(uid) ? 'pending' : 'saved'; emit(); return true; }
      // CAS failed: preserve both snapshots and require a whole-save decision.
      const c = await A.sb.from(T.progress).select('data, updated_at').eq('user_id', uid).maybeSingle(); if (c.error) throw c.error;
      if (!ownsSession(uid, epoch)) return false;
      if (!c.data) { conflict(load(), {}, undefined); return false; }
      conflict(load(), c.data.data, c.data.updated_at); return false;
    }
    throw new Error('save conflict');
  } catch (e) { if (!ownsSession(uid, epoch)) return false; A.msg = koErr(e); if (e && e.code === '42501') deniedHook(); schedule(true); emit(); return false; }
}
// 즉시 저장 (판 종료 시 등) — 디바운스 무시
export async function flush() {
  if (!ready() || A.tables !== 'ok') return false;
  const uid = A.user.id, epoch = sessionEpoch;
  // Wait for existing work without asking save() to write the same snapshot again.
  // If a new edit arrived in flight, its journal stays dirty and is drained below.
  do {
    if (inflight?.epoch === epoch) { if (!await inflight.promise) return false; }
    else if (dirty(uid) || ls.get(pendingKey(uid))) { if (!await save()) return false; }
    else return ownsSession(uid, epoch) && ready();
  } while (ownsSession(uid, epoch) && ready());
  return false;
}
// 네트워크 복구(online): 백오프(최대 60초)를 기다리지 않고 바로 재시도 + 백오프 단계 초기화 (Q-12)
addEventListener('online', () => { retry = 0; if (!A.user) return; clearTimeout(timer); if (!A.hydrated) return onRetry(A.user.id, sessionEpoch); if (dirty(A.user.id)) return save(); });
// 탭 숨김(앱 전환·화면 끔)·페이지 닫힘: 디바운스 기다리지 않고 바로 저장 (beforeunload 의 async 저장은 자주 누락됨)
function leaveFlush() { if (A.user && dirty(A.user.id)) { A.leaving = true; flush().finally(() => { A.leaving = false; }); } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leaveFlush(); });
addEventListener('pagehide', leaveFlush);
addEventListener('beforeunload', leaveFlush);
export const SYNC_TXT = { conflict: '저장 기록 선택 필요', local: '이 기기에 저장', loading: '불러오는 중…', missing: '서버 준비 중 · 이 기기에 저장', error: '서버 오류 · 이 기기에 저장', pending: '저장 대기', saving: '저장 중…', saved: '클라우드 저장됨 ✓', offline: '오프라인 · 재시도 예정', banned: '⛔ 계정 정지 · 서버 저장 중단 (이 기기에만 저장)' };

export function syncText() { const p=serverSaveState(); return p ? p.busy?'저장 중…':'저장 확인 필요' : SYNC_TXT[A.sync] || ''; }
