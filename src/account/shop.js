import { claimableMail, createMailBatch } from './mail-actions.js';
// 상점 · 우편함 · 관리자 클라이언트 (Supabase). 유료 영웅 소유권은 서버 테이블 hd3d_owned(사용자 쓰기 불가)에서 읽은 값만 메모리에 둠 (localStorage/세이브에 저장하지 않음).
// 테이블/함수가 아직 없으면(schema.sql 미실행) status = 'missing' → UI는 '서버 준비 중'. 게스트는 구매/우편 불가.
import { A, ensureClient, load as accLoad, store as accStore, onChange as accOnChange, setBanned, onDenied, flush, ready as accountReady, serverSaveState, SAVE_WAIT_MESSAGE, sessionId, mailSaved, beginServerSave, markServerSave, finishServerSave, reloadAuthoritative } from './account.js';
import { isBannedErr, isMissingErr as isMissing } from './errors.js';
import { ls } from '../core/store.js';
import { durableSet } from './durable.js';
import { applyMail } from './progress.js';
import { itemsText } from './rewarditems.js';
import { SHOP } from '../config/shop.js';
import { CLOUD } from '../config/cloud.js';
import { CLASSES, DEFAULT_HERO, isHidden } from '../data/heroes.js';

const T = SHOP.tables;
const ready = () => accountReady() && !serverSaveState();
const canRecoverClaims = () => { const pending=serverSaveState();return accountReady()&&(!pending||A.sb?.atomicMail&&pending.token?.startsWith('mail:')&&!pending.busy); };
export const S = { mailAction: null, archivedIds: [], status: 'idle', owned: [], ownedUid: null, orders: [], mail: [], adminOrders: [], msg: '', listeners: [], me: { st: 'idle', admin: false, owner: false, banned: false, reason: null } }; // status: idle | guest | loading | ok | missing | error
// me = 서버 hd3d_my_status (관리자/owner/정지). st: idle | ok | missing(schema.sql 재실행 전) | error
const emit = () => S.listeners.forEach(f => { try { f(S); } catch (e) { console.warn(e); } });
export const onShop = f => S.listeners.push(f);
const uid = () => (A.user && A.user.id) || '';

// ---------- 소유권 (서버 hd3d_owned 를 마지막으로 읽은 값, 현재 로그인 계정 것만) ----------
export function ownedList() { const u = uid(); return u && S.ownedUid === u ? S.owned.slice() : []; }
export const owns = item => ownedList().includes(item);
export const heroOwned = cls => !!CLASSES[cls] && !isHidden(cls) && (!CLASSES[cls].paid || owns('hero_' + cls)); // 숨긴 영웅은 소유해도 사용 불가 (소유 기록은 서버에 그대로)
export const usableHero = cls => heroOwned(cls) ? cls : isHidden(cls) ? DEFAULT_HERO : 'mage';
// 판매 중인 상품 (숨긴 영웅 상품은 목록·구매에서 제외, schema 상품은 그대로)
export const onSale = item => !!SHOP.items[item] && !(SHOP.items[item].kind === 'hero' && isHidden(SHOP.items[item].hero)); // 저장된 영웅이 잠겨 있으면 기본 영웅
// 버튼 표시용 (서버가 다시 검사): 서버 상태를 받았으면 그 값(하위 관리자 포함), 아직/구버전 서버면 owner 이메일
export const isAdminUI = () => !!A.user && S.me.st === 'ok' && !!S.me.admin;
export const isOwnerUI = () => !!A.user && S.me.st === 'ok' && S.me.owner;
export const isBanned = () => !!A.user && S.me.banned;
export const unread = () => S.mail.filter(m => (!m.claimed || pendList().includes(m.id)) && !m.revoked && (m.reward || !m.read)).length;
const BAN_MSG = { order: '계정이 정지되어 구매 신청을 할 수 없습니다.', claim: '계정이 정지되어 우편을 받을 수 없습니다.' };
// 내 상태 (관리자·정지) 다시 읽기
export async function refreshMe() {
  if (!A.user) { S.me = { st: 'idle', admin: false, owner: false, banned: false, reason: null }; setBanned(false); emit(); return S.me; }
  const u = A.user.id, c = await sb(), { data, error } = await q(c.rpc('hd3d_my_status'));
  if (!A.user || A.user.id !== u) return S.me;
  if (error) S.me = { ...S.me, st: isMissing(error) ? 'missing' : 'error', admin: false, owner: false };
  else S.me = { st: 'ok', admin: !!(data && data.admin), owner: !!(data && data.owner), banned: !!(data && data.banned), reason: (data && data.ban_reason) || null, at: (data && data.banned_at) || null };
  setBanned(S.me.banned); emit(); return S.me;
}
onDenied(() => { refreshMe().catch(() => {}); }); // 저장이 42501 로 거부되면 (정지됐을 수 있음) 상태 다시 확인

async function sb() { return A.sb || ensureClient(); }
async function q(p) { try { const r = await p; return r; } catch (e) { return { data: null, error: { message: String(e && e.message || e) } }; } }
// 서버에서 소유권·내 주문·우편을 다시 읽음
let refreshJob = null, refreshedKey = '', refreshedAt = 0, refreshGeneration = 0;
const isMailMutation = action => ['archive','restore'].includes(action?.kind);
const invalidateShopRefresh = () => { refreshGeneration++; refreshedKey = ''; refreshedAt = 0; };
export function refresh({ maxAgeMs = 0, mailMutation = null } = {}) {
  const key = (A.user?.id || 'guest') + ':' + sessionId();
  if (isMailMutation(S.mailAction) && S.mailAction !== mailMutation) return Promise.resolve(S);
  const generation = refreshGeneration;
  if (refreshJob?.key === key && refreshJob.generation === generation) return refreshJob.promise;
  if (maxAgeMs > 0 && S.status === 'ok' && refreshedKey === key && Date.now() - refreshedAt < maxAgeMs) return Promise.resolve(S);
  const job = { key, generation }; refreshJob = job;
  job.promise = fetchShop(generation).then(r => {
    if (generation === refreshGeneration && key === (A.user?.id || 'guest') + ':' + sessionId() && S.status === 'ok') { refreshedKey = key; refreshedAt = Date.now(); }
    return r;
  }).finally(() => { if (refreshJob === job) refreshJob = null; }); return job.promise;
}
async function fetchShop(generation) {
  if (!A.user) { S.status = 'guest'; S.owned = []; S.ownedUid = null; S.orders = []; S.mail = []; emit(); return S; }
  if (S.status !== 'ok') S.status = 'loading'; emit();
  const u = A.user.id, epoch = sessionId(), c = await sb();
  if (generation !== refreshGeneration || A.user?.id !== u || sessionId() !== epoch) return S;
  const [o, , r, m, archived] = await Promise.all([q(c.from(T.owned).select('item').eq('user_id', u)), refreshMe().catch(() => {}), q(c.from(T.orders).select('*').eq('user_id', u).order('created_at', { ascending: false }).limit(50)), q(c.from(T.mail).select('*').eq('user_id', u).eq('archived', false).order('created_at', { ascending: false }).limit(100)), q(c.from(T.mail).select('id').eq('user_id', u).eq('archived', true).order('created_at', { ascending: false }).limit(100))]);
  if (generation !== refreshGeneration || A.user?.id !== u || sessionId() !== epoch) return S;
  const bad = [o, r, m, archived].find(x => x.error);
  if (bad) { S.status = isMissing(bad.error) ? 'missing' : 'error'; S.msg = bad.error.message || ''; emit(); return S; }
  if (!A.user || A.user.id !== u) return S;
  S.owned = [...new Set((o.data || []).map(x => x.item))]; S.ownedUid = u;
  S.archivedIds = [...new Set((archived.data || []).map(m=>m.id).filter(id=>Number.isSafeInteger(id)&&id>0))];
  const rd = readSet(); S.orders = r.data || []; S.mail = (m.data || []).map(x => ({ ...x, read: rd.has(String(x.id)) })); S.status = 'ok'; emit();
  if (canRecoverClaims() && !recovering && !claiming.size && pendList().length) setTimeout(() => recoverClaims().catch(() => {}), 0); return S;
}
const readKey = () => CLOUD.storagePrefix + '_mailread_' + uid();
function readSet() { try { return new Set(JSON.parse(ls.get(readKey()) || '[]')); } catch (e) { return new Set(); } }
export function markRead(id) { const s = readSet(); s.add(String(id)); ls.set(readKey(), JSON.stringify([...s].slice(-300))); const m = S.mail.find(x => x.id === id); if (m) m.read = true; emit(); }
export const pendingOf = item => S.orders.find(o => o.item === item && o.status === 'pending');

// ---------- 구매 신청 ----------  반환 { ok, msg }
export async function order(item) {
  if (!SHOP.items[item]) return { ok: false, msg: '알 수 없는 상품입니다.' };
  if (!onSale(item)) return { ok: false, msg: '지금은 판매하지 않는 상품입니다.' };
  if (!A.user) return { ok: false, msg: '로그인한 계정만 구매할 수 있어요. (게스트 불가)' };
  if (S.status !== 'ok') await refresh();
  if (S.status === 'missing') return { ok: false, msg: '서버 준비 중이에요. 잠시 후 다시 시도해 주세요.' };
  if (S.status !== 'ok') return { ok: false, msg: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
  if (owns(item)) return { ok: false, msg: '이미 보유한 상품이에요.' };
  if (S.me.banned) return { ok: false, banned: true, msg: BAN_MSG.order };
  if (pendingOf(item)) return { ok: false, msg: '이미 구매 신청이 접수되어 관리자 확인을 기다리는 중이에요.' };
  const c = await sb(), { error } = await q(c.from(T.orders).insert({ item }));
  if (error) { await refresh(); if (isBannedErr(error)) return { ok: false, banned: true, msg: BAN_MSG.order }; if (error.code === '23514') return { ok: false, outdated: true, msg: '이 영웅은 지금 구매할 수 없습니다. 잠시 후 다시 시도해 주세요.' }; if (error.code === '23505') return { ok: false, msg: owns(item) ? '이미 보유한 상품이에요.' : '이미 구매 신청이 접수되어 있어요.' }; if (isMissing(error)) return { ok: false, msg: '서버 준비 중이에요.' }; return { ok: false, msg: '구매 신청 실패: ' + (error.message || '') }; }
  await refresh(); return { ok: true, msg: '구매 신청이 접수되었습니다!' };
}

// ---------- 우편 받기 (서버 RPC: 한 번만 지급) ----------  반환 { ok, already, reward, msg }
// 보상 장부(S-3): RPC 를 부르기 전에 id 를 이 기기의 '받는 중' 목록(hd3d_mailpend_<uid>)에 적어 둠. 서버는 성공했는데 응답이 끊기면
// 목록에 남아 있다가 다음 refresh 때 다시 부름 → 서버는 already + reward 를 돌려주고(schema.sql), 세이브 장부(save.mailLog)에 없으면 그때 더함.
// '받는 중'이 아니었던 already(다른 기기에서 받음 등)는 더하지 않음 → 장부 도입 전에 받은 우편이 다시 지급되지 않음.
let claiming = new Set();
const pendKey = () => CLOUD.storagePrefix + '_mailpend_' + uid();
const pendList = () => { try { const a = JSON.parse(ls.get(pendKey()) || '[]'); return Array.isArray(a) ? a.filter(Number.isSafeInteger) : []; } catch (e) { return []; } };
const pendSet = (id, on) => { const a = new Set(pendList()); if (on) a.add(id); else a.delete(id); durableSet(pendKey(), JSON.stringify([...a])); };
export const pendingClaims = () => pendList();
export async function claim(id, { quiet = false, batchToken = null } = {}) {
  if(S.mailAction && batchToken!==mailBatchToken)return {ok:false,busy:true,msg:'우편 처리 중입니다.'};
  if (!A.user) return { ok: false, msg: '로그인이 필요합니다.' };
  if (serverSaveState() && !(A.sb?.atomicMail && serverSaveState().token==='mail:'+id && !serverSaveState().busy)) return {ok:false, pending:true, msg:SAVE_WAIT_MESSAGE};
  if (!canRecoverClaims()) return { ok: false, msg: '계정 저장을 불러오거나 저장 기록 선택을 마친 뒤 다시 받아 주세요.' };
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, msg: '올바르지 않은 우편입니다.' };
  if (claiming.size) return { ok: false, busy: true, msg: '처리 중…' };
  // Finish an older receipt before accepting more: pending awards must not age out of mailLog.
  if (pendList().length && pendList()[0] !== id) return { ok: false, pending: true, msg: '이전 우편 보상을 저장 중입니다. 우편함을 다시 열어 재시도해 주세요.' };
  claiming.add(id);
  const u = uid(), epoch = sessionId(), current = () => uid() === u && sessionId() === epoch, wasPending = pendList().includes(id);
  try {
    if(A.sb?.atomicMail) return await claimAtomic(id,{quiet,current,wasPending});
    pendSet(id, true);
    const c = await sb(), { data, error } = await q(c.rpc('hd3d_claim_mail', { p_mail_id: id }));
    if (!current()) return { ok: false, pending: true, msg: '계정이 바뀌었습니다. 다시 로그인하면 수령을 재시도합니다.' };
    if (error) { if (error.code === 'P0002' || /not found|revoked/i.test(error.message || '')) pendSet(id, false);
      if (isBannedErr(error)) { pendSet(id, false); refreshMe().catch(() => {}); return { ok: false, banned: true, msg: BAN_MSG.claim }; }
      if (/revoked/i.test(error.message || '') || error.hint === 'revoked') { await refresh(); return { ok: false, msg: '회수된 우편이라 받을 수 없습니다.' }; }
      return { ok: false, msg: isMissing(error) ? '서버 준비 중이에요.' : '받기 실패: ' + (error.message || '') }; }
    if (!ready()) return { ok: false, pending: true, msg: '저장 기록을 선택한 뒤 수령을 재시도해 주세요.' };
    const r = data || {}; let applied = false, got = [];
    if (r.reward && (!r.already || wasPending)) [applied, got] = applyReward(id, r.reward);
    if (r.reward && (!r.already || wasPending)) {
      const saved = await flush();
      if (!current()) return { ok: false, pending: true, msg: '계정이 바뀌었습니다. 다시 로그인하면 수령을 재시도합니다.' };
      if (!saved || !mailSaved(id)) return { ok: false, pending: true, msg: '보상 저장을 확인하지 못했습니다. 이 기기에 보관했으며 다음 접속 때 재시도합니다.' };
    }
    pendSet(id, false); if (!quiet) markRead(id); await refresh();
    const recovered = !!(r.already && applied);
    const dup = got.filter(x => x && x.dup).length, box = got.filter(x => x && !x.dup && !x.auto).length, auto = got.filter(x => x && x.auto).length;
    const extra = (box ? ` 장비 ${box}개는 🎁 보상 상자에 있어요.` : '') + (auto ? ` 상자가 가득 차 ${auto}개는 재료로 분해됐어요.` : '');
    return { ok: true, already: !!r.already && !recovered, recovered, reward: r.reward || null, got, msg: (recovered ? '지난번에 받지 못한 보상을 받았습니다!' : r.already ? '이미 받은 우편이에요.' : '보상을 받았습니다!') + (applied ? extra : '') };
  } catch (e) { return { ok: false, pending: true, msg: e.message || '보상을 저장하지 못했습니다. 다시 시도해 주세요.' }; } finally { claiming.delete(id); }
}
// Direct storage acknowledges each grant with its receipt. Keep purchases
// guarded until the authoritative reload completes; the existing pending mail
// ID and durable save marker recover an uncertain response without local replay.
async function claimAtomic(id,{quiet,current,wasPending}) {
 let job=null,confirmed=false;
 const pending=serverSaveState();
 try {
  pendSet(id,true);job=beginServerSave('mail:'+id);
  if(!pending&&!await flush())return {ok:false,pending:true,msg:SAVE_WAIT_MESSAGE};
  if(!current())return {ok:false,pending:true,msg:SAVE_WAIT_MESSAGE};
  markServerSave(job);
  const {data,error}=await q(A.sb.rpc('hd3d_claim_mail',{p_mail_id:id}));
  if(!current())return {ok:false,pending:true,msg:SAVE_WAIT_MESSAGE};
  if(error){
   // A fresh unsupported/denied operation never wrote. Older unknown commits
   // retain the marker until their authoritative result is reconciled.
   if(!pending && (error.code==='DIRECT_UNSUPPORTED'||error.code==='42501'||error.status===403)){
    confirmed=true;pendSet(id,false);
   }
   return {ok:false,pending:!confirmed,msg:error.message||SAVE_WAIT_MESSAGE};
  }
   if(data?.deferred===true&&data.reason==='balance_limit'&&data.serverSaved===true){
    if(!await reloadAuthoritative()||!current())return {ok:false,pending:true,msg:SAVE_WAIT_MESSAGE};
    confirmed=true;finishServerSave(job,true);pendSet(id,false);await refresh();
    return {ok:false,deferred:true,pending:false,got:data.got||[],msg:'재화 보유 한도를 초과했습니다. 남은 보상은 우편에 보관됩니다.'};
   }
   if(!data?.ok||!data.serverSaved||!await reloadAuthoritative()||!current())return {ok:false,pending:true,msg:SAVE_WAIT_MESSAGE};
  confirmed=true;finishServerSave(job,true);pendSet(id,false);
  if(!quiet)markRead(id);await refresh();
  return {ok:true,already:!!data.already&&!wasPending,recovered:!!data.already&&wasPending,reward:null,got:data.got||[],msg:''};
 } finally {if(job)finishServerSave(job,confirmed);}
}
// 응답이 끊겨 '받는 중'으로 남은 우편을 다시 처리 (로그인 후 refresh 때 자동)
let recovering = false;
export async function recoverClaims() { if (S.mailAction || recovering || !canRecoverClaims() || claiming.size) return 0; recovering = true; let n = 0;
  try { for (const id of pendList()) { if (mailSaved(id)) { pendSet(id, false); continue; } const r = await claim(id, { quiet: true }); if (r.recovered || (r.ok && !r.already)) n++; } } finally { recovering = false; } return n; }
// 영혼석·재료는 저장 데이터에 더하고 장부에 id 기록 (한 번만). 영웅은 서버 hd3d_owned 로 해금 → refresh
function applyReward(id, rw) { const [s, ok, res] = applyMail(accLoad(), id, rw); if (ok) accStore(s); return [ok, res || []]; }
export function rewardText(rw) { if (!rw) return ''; const o = []; if (rw.hero && CLASSES[rw.hero]) o.push(`영웅 ${CLASSES[rw.hero].nm || ''} · ${CLASSES[rw.hero].n}`); if (+rw.souls) o.push(`영혼석 ${+rw.souls}`); if (+rw.steel) o.push(`강철 ${+rw.steel}`); if (+rw.crystal) o.push(`마력석 ${+rw.crystal}`); if (+rw.essence) o.push(`전직 정수 ${+rw.essence}`); if (+rw.medals) o.push(`던전 메달 ${+rw.medals}`); const it = itemsText(rw.items); if (it) o.push(it); return o.join(' · '); }

// ---------- 관리자 (서버가 hd3d_is_admin()으로 다시 검사) ----------
export async function adminOrders() {
  const c = await sb(), { data, error } = await q(c.from(T.orders).select('*').order('created_at', { ascending: false }).limit(200));
  if (error) return { ok: false, msg: isMissing(error) ? '서버 준비 중 (schema.sql 실행 필요)' : error.message }; S.adminOrders = data || []; emit(); return { ok: true, list: S.adminOrders };
}
async function adminRpc(fn, args) { const c = await sb(), { data, error } = await q(c.rpc(fn, args)); if (error) return { ok: false, msg: isMissing(error) ? '서버 준비 중 (schema.sql 실행 필요)' : /forbidden|42501/.test(error.message + error.code) ? '관리자 권한이 없습니다.' : error.message };
  if (data && data.ok === false) return { ok: false, msg: { not_pending: '이미 처리된 신청입니다.', no_user: '해당 이메일의 사용자가 없습니다.', bad_reward: (args && args.p_reward && args.p_reward.hero === 'fighter') ? '서버 업데이트 필요: schema.sql 을 다시 실행해 주세요 (격투가 서윤)' : (args && args.p_reward && args.p_reward.medals) ? '서버 업데이트 필요: schema.sql 을 다시 실행해 주세요 (던전 메달)' : '보상 값이 올바르지 않습니다.', bad_title: '제목을 확인해 주세요.' }[data.reason] || '실패' }; return { ok: true, data }; }
export const approve = id => adminRpc('hd3d_admin_approve', { p_order_id: id });
export const reject = (id, reason) => adminRpc('hd3d_admin_reject', { p_order_id: id, p_reason: reason || null });
export const sendMail = (email, title, body, reward) => adminRpc('hd3d_admin_send_mail', { p_email: email, p_title: title, p_body: body || '', p_reward: reward && Object.keys(reward).length ? reward : null });

// 로그인/로그아웃 시 자동 갱신
let lastReady = false;
accOnChange(() => {
  const canRecover = canRecoverClaims();
  if (canRecover && !claiming.size) for (const id of pendList()) if (mailSaved(id)) { try { pendSet(id, false); } catch {} }
  if (canRecover && !lastReady && pendList().length) setTimeout(() => recoverClaims().catch(() => {}), 0);
  lastReady = canRecover;
});
addEventListener('online', () => { if (canRecoverClaims()) recoverClaims().catch(() => {}); });
let lastU = A.user?.id || null; accOnChange(() => { const u = A.user ? A.user.id : null; if (u !== lastU) { lastU = u; S.mailAction = null; S.archivedIds = []; S.owned = []; S.ownedUid = null; S.orders = []; S.mail = []; S.adminOrders = []; S.me = { st: 'idle', admin: false, owner: false, banned: false, reason: null }; setBanned(false); S.status = u ? 'loading' : 'guest'; if (u) refresh().catch(() => {}); else emit(); } });
// 새로고침으로 출정할 때(?stage&run) 유료 영웅이면 로그인·서버 소유권 확인을 먼저 (최대 ms)
export async function verifyOwned(ms = 8000) { const to = new Promise(r => setTimeout(r, ms)); try { await Promise.race([(async () => { if (!A.user) { const { autoLogin } = await import('./account.js'); await autoLogin(); } if (A.user) await refresh(); })(), to]); } catch (e) {} }

const mailBatchToken=Symbol('mail batch'),mailBatch=createMailBatch();
export const claimableCount=()=>claimableMail(S.mail,pendList()).length;
export const cleanupCount=()=>S.mail.filter(m=>m.claimed&&!pendList().includes(m.id)).length || (S.mail.length>=100?1:0);
export async function claimAll(){
 if(S.mailAction||claiming.size||recovering)return {ok:false,msg:'우편 처리 중입니다.'};
 if(!canRecoverClaims()||S.status!=='ok'||S.me.banned)return {ok:false,msg:'계정과 저장 상태를 확인해 주세요.'};
 const u=uid(),epoch=sessionId(),current=()=>uid()===u&&sessionId()===epoch;
 const action={kind:'claim',done:0,total:claimableCount()};S.mailAction=action;emit();
 try{
  const r=await mailBatch(S.mail,{pending:pendList(),isCurrent:current,claim:id=>claim(id,{batchToken:mailBatchToken}),onProgress:()=>{action.done++;if(current())emit();}});
  return {...r,msg:r.received+'개 받음'+((r.remaining+r.failed.length)?' · '+(r.remaining+r.failed.length)+'개 남음':'')+(r.failed?.[0]?.msg?' · '+r.failed[0].msg:'')};
 }catch(e){return {ok:false,msg:e.message||'수령이 중단되었습니다. 다시 확인해 주세요.'};}
 finally{if(current()&&S.mailAction===action){S.mailAction=null;emit();}}
}
export async function cleanupMail(restore=false){
 if(S.mailAction||claiming.size||recovering)return {ok:false,msg:'우편 처리 중입니다.'};
 if(!ready()||S.status!=='ok'||!uid())return {ok:false,msg:'계정과 저장 상태를 확인해 주세요.'};
 const u=uid(),epoch=sessionId(),current=()=>uid()===u&&sessionId()===epoch;
 return cleanupAllReceived(restore,current);
}

// A transaction reads each selected row before its commit; keep the 30s transport budget comfortable.
const MAIL_ARCHIVE_BATCH=24;
let lastCleanup=null;
const cleanupSessionKey=()=>uid()+':'+sessionId();
export function canUndoMailCleanup(){
 if(lastCleanup?.key===cleanupSessionKey())return lastCleanup.ids.size>0;
 return S.archivedIds.length>0;
}
async function cleanupAllReceived(restore,current){
 const action={kind:restore?'restore':'archive',done:0,total:0};
 const verb=restore?'복원':'정리',changed=()=>({ok:false,msg:'계정이 변경되었습니다.'});
 S.mailAction=action;invalidateShopRefresh();emit();
 const key=cleanupSessionKey();
 let error=null,didRequest=false,newReceipt=false;
 try{
  const c=await sb();if(!current())return changed();
  let ids;
  if(restore){
   // Prefer the precise last cleanup from this session, including partial successes.
   // Old sessions keep their original bounded archived-mail undo behavior.
   ids=lastCleanup?.key===key?[...lastCleanup.ids]:S.archivedIds.slice(0,100);
  }else{
   const reply=await q(c.rpc('hd3d_mail_archive_candidates',{p_restore:false}));
   if(!current())return changed();
   if(reply.error||reply.data?.ok!==true||!Array.isArray(reply.data.ids)||reply.data.ids.some(id=>!Number.isSafeInteger(id)||id<=0))
    return {ok:false,msg:reply.error?.message||'우편 목록을 확인하지 못했습니다.'};
   const pending=new Set(pendList());
   ids=[...new Set(reply.data.ids)].filter(id=>!pending.has(id));
  }
  if(!ids.length)return {ok:true,msg:restore?'복원할 우편이 없습니다.':'정리할 받은 우편이 없습니다.'};
  action.total=ids.length;emit();
  let skipped=0;
  for(let start=0;start<ids.length;start+=MAIL_ARCHIVE_BATCH){
   if(!current())return changed();
   const waiting=new Set(pendList());
   const chunk=ids.slice(start,start+MAIL_ARCHIVE_BATCH),batch=chunk.filter(id=>restore||!waiting.has(id));
   skipped+=chunk.length-batch.length;if(!batch.length)continue;
   const batchSet=new Set(batch);didRequest=true;
   const {data,error:rpcError}=await q(c.rpc('hd3d_mail_archive',{p_ids:batch,p_restore:restore,...(restore?{}:{p_only_new:true})}));
   if(!current())return changed();
   if(rpcError||data?.ok!==true||!Array.isArray(data.ids)||data.ids.some(id=>!batchSet.has(id))){
    error=rpcError?.message||'서버 응답을 확인하지 못했습니다.';break;
   }
   const ack=new Set(data.ids);action.done+=ack.size;skipped+=batch.length-ack.size;
   if(restore){
    S.archivedIds=S.archivedIds.filter(id=>!ack.has(id));
    if(lastCleanup?.key===key)for(const id of ack)lastCleanup.ids.delete(id);
   }else {
    if(ack.size){
     if(!newReceipt){lastCleanup={key,ids:new Set()};newReceipt=true;}
     for(const id of ack)lastCleanup.ids.add(id);
    }
    S.archivedIds=[...new Set([...S.archivedIds,...ack])];
    S.mail=S.mail.filter(m=>!ack.has(m.id));
   }
   emit();
  }
  if(didRequest){
   invalidateShopRefresh();await refresh({mailMutation:action});
   if(!current())return changed();
  }
  if(error)return {ok:false,count:action.done,msg:action.done+'개 '+verb+' 확인 · 나머지는 다시 확인해 주세요. '+error};
  if(skipped)return {ok:true,count:action.done,msg:action.done+'개 '+verb+'했습니다. · '+skipped+'개 제외'};
  return {ok:true,count:action.done,msg:action.done+'개 '+verb+'했습니다.'};
 }catch(e){
  if(!current())return changed();
  if(didRequest){invalidateShopRefresh();await refresh({mailMutation:action}).catch(()=>{});}
  if(!current())return changed();
  return {ok:false,count:action.done,msg:action.done+'개 '+verb+' 확인 · '+(e.message||'나머지는 다시 확인해 주세요.')};
 }finally{if(current()&&S.mailAction===action){S.mailAction=null;emit();}}
}
