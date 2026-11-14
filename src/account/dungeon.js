import * as HG from './hero-growth.js';
// One daily entry per account (server) or per guest save (this device).
import { guestDungeonLeft, startGuestDungeon, finishGuestDungeon } from './dungeon-local.js';
import { A, ensureClient, load, store, saveAllowed, SAVE_WAIT_MESSAGE } from './account.js';
import { isBannedErr, isMissingErr } from './adminlogic.js';
import { DG_REASON } from '../data/dungeon.js';
import { ls } from '../core/store.js';

export const DGS = { st: 'idle', uid: null, left: null, used: 0, limit: 1, medals: 0, titles: [], banned: false, msg: '' };
export const UPDATE_NEEDED = '서버 업데이트 필요';
const TOK = 'hd3d_live_dgtok'; // 출발 → 새로고침(?dungeon=1&run=1) 사이에 token 을 넘기는 곳 (sessionStorage: 이 탭만)
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
const uid = () => (A.user && A.user.id) || null;
const pendingKey = u => 'hd3d_live_dgfinish_' + u;
let recoveringFinish = false;
async function recoverFinish(u) {
  if (recoveringFinish) return;
  let p; try { p = JSON.parse(ls.get(pendingKey(u)) || 'null'); } catch (_) {}
  if (!p?.token) return;
  recoveringFinish = true;
  try { await dgFinish(p.token, p.floors, p.win); } finally { recoveringFinish = false; }
}
async function rpc(fn, args) { try { const c = A.sb || await ensureClient(); const r = await c.rpc(fn, args); return r || { data: null, error: { message: 'no response' } }; } catch (e) { return { data: null, error: { message: String(e && e.message || e) } }; } }
const strs = a => Array.isArray(a) ? a.filter(x => typeof x === 'string') : [];
const offline = e => !!e && (e.status === 0 || /fetch|network|no response/i.test(e.message || ''));
function setErr(e) { DGS.st = isMissingErr(e) ? 'missing' : 'error'; DGS.msg = DGS.st === 'missing' ? UPDATE_NEEDED : offline(e) ? '서버에 연결할 수 없어요' : (e.message || '서버 오류'); }

// 오늘 남은 입장 · 메달 · 칭호 (서버)
export async function dgStatus() {
  const u = uid(); if (!u) { Object.assign(DGS, { st: 'guest', uid: null, limit: 1, left: guestDungeonLeft(load()), used: 1 - guestDungeonLeft(load()), medals: 0, titles: [], banned: false, msg: '' }); return DGS; }
  await recoverFinish(u); if (uid() !== u) return DGS;
  if (DGS.uid !== u) Object.assign(DGS, { uid: u, left: null, used: 0, medals: 0, titles: [] }); DGS.st = DGS.st === 'ok' ? 'ok' : 'loading';
  const { data, error } = await rpc('hd3d_dungeon_status'); if (uid() !== u) return DGS;
  if (error || !data) { setErr(error || {}); return DGS; }
  Object.assign(DGS, { st: 'ok', left: Math.max(0, +data.left || 0), used: +data.used || 0, limit: +data.limit || 1, medals: Math.max(0, +data.medals || 0), titles: Array.isArray(data.titles) ? data.titles.filter(x => typeof x === 'string') : [], banned: !!data.banned, msg: '' });
  return DGS;
}
// 출발: 서버 입장 등록. → { mode: 'ranked', token } | { mode: 'practice', why: 'guest'|'missing'|'error' } | { blocked: true, msg }
export async function dgStart() {
  if (!saveAllowed()) return {blocked:true,msg:SAVE_WAIT_MESSAGE};
  await HG.refresh();
  if (!saveAllowed()) return {blocked:true,msg:SAVE_WAIT_MESSAGE};
  const u = uid(); if (!u) {
    const enter = () => {
      const r = startGuestDungeon(load(), crypto.randomUUID());
      if (!r.ok) return { blocked: true, msg: DG_REASON[r.reason] };
      store(r.save); if (load().guestDungeon?.token !== r.token) return { blocked: true, msg: '기기에 입장 기록을 저장할 수 없어요.' };
      ss.set(TOK, JSON.stringify({ local: true, t: r.token, at: Date.now() }));
      DGS.left = 0; DGS.used = 1;
      return { mode: 'local', token: r.token };
    };
    return globalThis.navigator?.locks ? navigator.locks.request('hd3d_live_guest_dungeon', enter) : enter();
  }
  const { data, error } = await rpc('hd3d_dungeon_start', { p_growth: HG.enabled() ? 1 : 0 });
  if (uid() !== u) return { blocked: true, msg: '계정이 변경됐어요. 다시 입장해 주세요.' };
  if (error) { if (isBannedErr(error)) return { blocked: true, msg: '계정이 정지되어 던전에 입장할 수 없어요.' }; setErr(error); return { blocked: true, msg: DGS.msg }; }
  if (!data || data.ok === false) { if (data && data.reason === 'daily_limit') { DGS.left = 0; DGS.used = +data.used || DGS.used; } return { blocked: true, msg: DG_REASON[data && data.reason] || '입장할 수 없어요.' }; }
  DGS.left = Math.max(0, +data.left || 0); DGS.used = +data.used || 0;
  ss.set(TOK, JSON.stringify({ t: String(data.token), u, at: Date.now() })); return { mode: 'ranked', token: String(data.token) };
}
// 연습 원정 표시 (새로고침 뒤 run.js 가 읽음)
export const markPractice = why => ss.set(TOK, JSON.stringify({ practice: String(why || 'guest'), u: uid(), at: Date.now() }));
// 판 시작 때 한 번 꺼냄 (꺼낸 뒤 지움 → 판 중 새로고침 = 그 입장 소모, 메달 없음)
export function takeEntry() { let o = null; try { o = JSON.parse(ss.get(TOK) || 'null'); } catch (e) {} ss.del(TOK);
  if (!o || typeof o !== 'object' || Date.now() - (+o.at || 0) > 10 * 60 * 1000) return { mode: 'practice', why: 'reload' };
  if (o.local && !uid() && load().guestDungeon?.token === o.t && load().guestDungeon.status === 'active') return { mode: 'local', token: o.t };
  if (o.practice) return { mode: 'practice', why: String(o.practice) };
  if (typeof o.t === 'string' && /^[0-9a-f-]{36}$/i.test(o.t) && o.u && (!uid() || o.u === uid())) return { mode: 'ranked', token: o.t }; // 로그인 복원이 늦어도 token 유지 (서버가 정산 때 계정을 다시 확인)
  return { mode: 'practice', why: 'reload' }; }
// 정산: 서버가 층 수·시간을 다시 검사해 메달 지급 (token 당 한 번). → { ok, medals, total, floors, capped } | { ok:false, msg }
export async function dgFinishLocal(token, floors, win) {
  if (uid()) return { ok: false, msg: '게스트 출정의 계정이 변경됐어요.' };
  const r = finishGuestDungeon(load(), token, floors, win);
  if (r.ok && !r.already) store(r.save);
  const xp = r.ok ? await HG.guestDungeon(token, r.floors || 0, !!r.win) : {};
  return { ...xp, ok: r.ok, souls: r.souls || 0, floors: r.floors || 0, win: !!r.win, already: !!r.already, msg: DG_REASON[r.reason] };
}
export async function dgFinish(token, floors, win) {
  if (!token || !uid()) return { ok: false, msg: '로그인이 필요해요.' };
  const owner = uid();
  ls.set(pendingKey(owner), JSON.stringify({ token, floors, win }));
  let r = null; for (let i = 0; i < 3; i++) { r = await rpc('hd3d_dungeon_finish', { p_token: token, p_floors: Math.max(0, Math.floor(+floors || 0)), p_win: !!win }); if (!r.error || !offline(r.error)) break; await new Promise(f => setTimeout(f, 1500 * (i + 1))); }
  if (uid() !== owner) return { ok: false, msg: '원정 계정으로 로그인해 주세요.' };
  if (!r.error && (r.data?.ok || ['bad_token', 'used', 'expired'].includes(r.data?.reason))) ls.del(pendingKey(owner));
  const { data, error } = r; if (error) return { ok: false, msg: isMissingErr(error) ? UPDATE_NEEDED : isBannedErr(error) ? '계정이 정지되어 보상을 받을 수 없어요.' : offline(error) ? '서버에 연결할 수 없어 보상을 확인하지 못했어요.' : '정산 실패: ' + (error.message || '') };
  if (!data || data.ok === false) return { ok: false, msg: DG_REASON[data && data.reason] || '정산 실패' };
  DGS.medals = Math.max(0, +data.total || 0);
  HG.receipt(data, owner);
  return { xp: data.xp || 0, growth: data.growth, ok: true, souls: +data.souls || 0, medals: +data.medals || 0, total: DGS.medals, floors: +data.floors || 0, win: !!data.win, capped: !!data.capped, mail: data.mail || null };
}
// The server records both misses and drops against the run token. Retrying cannot reroll.
export async function dgBossDrop(token, hero) {
  if (!token || !uid()) return { ok: false, msg: '로그인이 필요해요.' };
  const owner = uid(); let r;
  for (let i = 0; i < 3; i++) {
    r = await rpc('hd3d_dungeon_boss_drop', { p_token: token, p_hero: hero });
    if (!r.error || !offline(r.error)) break;
    await new Promise(f => setTimeout(f, 1000 * (i + 1)));
  }
  if (uid() !== owner) return { ok: false, msg: '원정 계정으로 로그인해 주세요.' };
  if (r.error) return { ok: false, msg: isMissingErr(r.error) ? UPDATE_NEEDED : '보스 보상을 확인하지 못했어요.' };
  if (!r.data?.ok) return { ok: false, msg: r.data?.reason === 'too_early' ? '원정 시간이 너무 짧아 보상을 확인할 수 없어요.' : DG_REASON[r.data?.reason] || '보스 보상 확인 실패' };
  return { ok: true, item: r.data.item || null, mail: r.data.mail || null };
}
// 던전 상점 구매 (가격은 서버 상수). 재료는 우편으로 → { ok, msg, mail }
export async function dgBuy(item) {
  if (!uid()) return { ok: false, msg: '로그인한 계정만 던전 상점을 쓸 수 있어요.' };
  const owner=uid();
  let data,error;
  if(A.sb?.atomicGear){try{const {runDirectGear,pendingGear}=await import('./direct-gear-client.js');const pending=pendingGear();if(pending){const same=pending.commands.length===1&&pending.commands[0].p_action==='dungeon_buy'&&pending.commands[0].p_item===String(item);const done=await runDirectGear();if(!same)return {ok:false,msg:SAVE_WAIT_MESSAGE};[data]=done;}else [data]=await runDirectGear([{p_action:'dungeon_buy',p_item:String(item)}]);}catch(e){error={message:e.message,code:e.code,status:e.status};}}
  else ({data,error}=await rpc('hd3d_dungeon_buy',{p_item:String(item)}));
  if(uid()!==owner)return {ok:false,msg:'계정이 변경됐어요.'};
  if (error) return { ok: false, msg: isMissingErr(error) ? '상점을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.' : isBannedErr(error) ? '계정이 정지되어 구매할 수 없어요.' : offline(error) ? '서버에 연결할 수 없어요.' : '구매 실패: ' + (error.message || '') };
  if (!data || data.ok === false) { if (data && data.medals != null) DGS.medals = Math.max(0, +data.medals || 0); return { ok: false, msg: DG_REASON[data && data.reason] || '구매 실패' }; }
  DGS.medals = Math.max(0, +data.medals || 0); if (Array.isArray(data.titles)) DGS.titles = data.titles.filter(x => typeof x === 'string');
  return { ok: true, mail: data.mail || null, msg: data.mail ? '구매 완료! 우편함에서 받기를 눌러 주세요.' : '구매 완료!' };
}
