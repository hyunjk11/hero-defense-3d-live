import { HARD_PARTY_VERSION } from '../data/hard-party.js';
import { readTarget } from './repeat-target.js';
import { cleanTarget } from '../data/repeat-target.js';
import * as Acc from './account.js';
import * as H from '../data/hero-growth.js';
import { localGrowth } from './growth-ledger.js';
import { CLASSES } from '../data/heroes.js';
import { ls } from '../core/store.js';
import { durableSet } from './durable.js';
import { isMissingErr } from './adminlogic.js';

export const HG = { owner: null, session: -1, status: 'idle', growth: null, message: '', pending: 0, hasInvestment: false, rewardXP: {}, hardRewards: {}, features: {}, buildBusy:false };
const listeners = [], prefix = 'hd3d_live_growth_v1_', guestKey = prefix + 'guest_ledger';
const owner = () => Acc.A.user?.id || (Acc.A.mode === 'guest' ? 'guest' : null);
const stamp = () => owner() + ':' + Acc.sessionId();
const parse = k => { const s = ls.get(k); if (!s) return null; try { return JSON.parse(s); } catch { throw new Error('XP 저장 기록을 읽지 못했습니다. 복구 전에는 변경하지 않습니다.'); } };
const write = (k, d) => durableSet(k, JSON.stringify(d));
const emit = () => listeners.forEach(f => f());
export const onGrowth = f => listeners.push(f);
export const enabled = () => HG.owner === owner() && HG.session === Acc.sessionId() && HG.status === 'ready';
export const available = () => HG.owner === owner() && HG.session === Acc.sessionId() && !!HG.growth && ['ready', 'offline'].includes(HG.status);
export const viewSave = (s = Acc.load()) => ({ ...s, growth: available() ? HG.growth : null });
export const level = h => available() ? H.levelOf(HG.growth.xp[h]) : 1;
const valid = s => s === stamp();
async function locked(u, fn) {
  if (!globalThis.navigator?.locks) throw new Error('안전한 XP 저장을 위해 브라우저 업데이트가 필요합니다.');
  return navigator.locks.request(prefix + u, fn);
}
function accept(r, s) { if (!valid(s)) return false; if (r?.growth && (!HG.growth || r.growth.rev >= HG.growth.rev)) { HG.growth = H.cleanGrowth(r.growth); if (owner() !== 'guest') write(prefix + owner() + '_cache', HG.growth); } emit(); return true; }
async function rpc(u, name, args) {
  if (u === 'guest') {
    const r = localGrowth(parse(guestKey), name, args, Acc.load(), h => !!CLASSES[h] && !CLASSES[h].paid);
    write(guestKey, r.doc); return r.result;
  }
  if (owner() !== u || !Acc.ready()) throw new Error('원래 계정으로 로그인하고 저장 동기화를 완료해 주세요.');
  const r = await Acc.A.sb.rpc((['spire_finish', 'spire_ping', 'dungeon_ping'].includes(name) ? 'hd3d_' : 'hd3d_growth_') + name, args);
  if (r?.error) throw r.error; if (!r?.data) throw new Error('XP 서버 응답을 확인하지 못했습니다.'); return r.data;
}
const outKey = u => prefix + u + '_outbox';
const readOut = u => parse(outKey(u)) || { rewards: {}, investment: null, dungeon: null, modes: {} };
export async function retry() {
  const u = owner(), s = stamp(); if (!u || !enabled()) return false;
  return locked(u, async () => {
    if (!valid(s)) return false; const out = readOut(u); HG.hasInvestment = !!out.investment;
    if (u === 'guest' && out.dungeon) { const r = await rpc(u, 'dungeon', out.dungeon); if (!valid(s)) return false; accept(r, s); out.dungeon = null; write(outKey(u), out); }
    if(out.build){const r=await rpc(u,'build',out.build);if(!valid(s))return false;accept(r,s);out.build=null;write(outKey(u),out);if(!r.ok)HG.message='특성 저장: '+r.reason;}
    if (out.investment) {
      const r = await rpc(u, 'invest', out.investment); if (!valid(s)) return false;
      accept(r, s); out.investment = null; HG.hasInvestment = false; write(outKey(u), out);
      if (!r.ok) HG.message = '이전 XP 투자 확인: ' + (r.reason || '실패') + '. 잔액을 확인해 다시 선택해 주세요.';
    }
    for (const [id, m] of Object.entries(out.modes || {})) { const r = await rpc(u, m.name, m.args); if (!valid(s)) return false; accept(r, s); if (r.ok) { delete out.modes[id]; write(outKey(u), out); } else { HG.message = '원정 XP 미확정: ' + r.reason; if (['expired','used','bad_token','unsupported'].includes(r.reason)) { out.failed ||= {}; out.failed[id] = { ...m, reason: r.reason }; delete out.modes[id]; write(outKey(u), out); } } }
    if (Object.keys(out.failed || {}).length) HG.message = '출정 만료 또는 종료로 미확정 XP가 남았습니다. 이미 지급된 XP는 유지됩니다. (기기 기록 보관)';
    for (const [token, a] of Object.entries(out.rewards)) {
      if (!valid(s)) return false;
      const hardFinish=u!=='guest'&&a.p_finish&&String(a.p_stage||'').startsWith('hard-');
      let lease=null,r;
      try{
        if(hardFinish){lease=Acc.beginServerSave(token);if(!await Acc.flush()||!valid(s)||!Acc.markServerSave(lease))return false;}
        r=await rpc(u,'progress',a);if(!valid(s))return false;accept(r,s);
        if(lease){
          if(!await Acc.reloadAuthoritative()||!valid(s)){HG.message='보상 저장 확인 대기';continue;}
          Acc.finishServerSave(lease,true);lease=null;
        }
        if(!r.ok){HG.message='XP 지급 대기: '+r.reason;continue;}
        HG.rewardXP[token]=r.xp;if(r.hardReward)HG.hardRewards[token]=r.hardReward;
      }finally{if(lease)Acc.finishServerSave(lease,false);}
      delete out.rewards[token]; write(outKey(u), out);
    }
    HG.pending = Object.keys(out.rewards).length + Object.keys(out.modes || {}).length + !!out.investment + !!out.build; emit(); return !HG.pending;
  }).catch(e => { if (valid(s)) { HG.message = 'XP 확인 대기: ' + (e.message || e); emit(); } return false; });
}
let refreshJob = null, refreshedAt = 0;
export function refresh({ maxAgeMs = 0 } = {}) {
  const u = owner(), s = stamp();
  if (refreshJob?.stamp === s) return refreshJob.promise;
  if (enabled() && !HG.pending && maxAgeMs > 0 && Date.now() - refreshedAt < maxAgeMs) return Promise.resolve(true);
  const job = { stamp: s }; refreshJob = job;
  job.promise = (async () => {
    if (!u) return false;
    const hadView = available();
    HG.owner = u; HG.session = Acc.sessionId(); HG.status = hadView ? HG.status : 'loading'; HG.message = ''; if (!hadView && u !== 'guest') { try { HG.growth = H.cleanGrowth(parse(prefix + u + '_cache')); } catch { HG.growth = null; } } emit();
    try {
      // A failed post-commit read sets tables=error. Recover that read before
      // flush's readiness check, without clearing the durable settlement guard.
      const pending = Acc.serverSaveState();
      if (u !== 'guest' && pending && !pending.busy && Acc.A.tables !== 'ok' && !Acc.A.conflict) await Acc.reloadAuthoritative();
      if (!valid(s)) return false;
      // Establish migration snapshot only after the existing progress journal is acknowledged.
      if (u !== 'guest' && (!Acc.ready() || !await Acc.flush())) throw new Error('진행 저장을 먼저 동기화해야 합니다.');
      if (!valid(s)) return false;
      const r = await locked(u, () => rpc(u, 'status', {})); if (!valid(s)) return false;
      if (!r.ok || r.version !== 1 || !r.growth) throw new Error('지원하지 않는 XP 서버 버전입니다.');
      HG.features=r.features||{}; HG.status = 'ready'; refreshedAt = Date.now(); accept(r, s); await retry(); return true;
    } catch (e) {
      if (valid(s)) { HG.status = isMissingErr(e) ? 'missing' : HG.growth ? 'offline' : 'error'; if (HG.status !== 'offline') HG.growth = null; HG.message = HG.status === 'missing' ? '성장 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.' : HG.status === 'offline' ? '오프라인 · 마지막 확인 레벨입니다. XP 투자·획득은 연결 후 가능합니다.' : '성장 정보 확인 대기 · 연결을 확인해 주세요. ' + (e.message || e); emit(); }
      return false;
    }
  })().finally(() => { if (refreshJob === job) refreshJob = null; }); return job.promise;
}
export async function invest(hero, target) {
  const u = owner(), s = stamp(); if (!enabled()) return { ok: false, reason: 'not_ready' };
  if (!Acc.saveAllowed()) return { ok: false, reason: 'pending' };
  return locked(u, async () => {
    if (!valid(s)) return { ok: false, reason: 'account_changed' };
    if (!Acc.saveAllowed()) return { ok: false, reason: 'pending' };
    const out = readOut(u); if (out.investment) return { ok: false, reason: 'pending' };
    const q = H.quote(HG.growth, hero, target); if (!q.ok) return q;
    const a = { p_id: crypto.randomUUID(), p_hero: hero, p_level: target, p_revision: HG.growth.rev };
    out.investment = a; write(outKey(u), out); HG.hasInvestment = true; HG.pending++; emit();
    const r = await rpc(u, 'invest', a); if (!valid(s)) return { ok: false, reason: 'account_changed' };
    accept(r, s); out.investment = null; HG.hasInvestment = false; write(outKey(u), out); HG.pending = Object.keys(out.rewards).length; emit(); return r;
  }).catch(e => { if (valid(s)) { HG.message = 'XP 투자 확인 대기 · 다시 연결하면 같은 요청을 확인합니다. ' + (e.message || e); emit(); } return { ok: false, reason: 'pending' }; });
}
export async function startRun(stage, hero) {
  if (!Acc.saveAllowed()) return null;
  const requestedBy = stamp();
  const hard = String(stage).startsWith('hard-');
  if (hard && !await Acc.flush()) return null;
  if (!valid(requestedBy)) return null;
  await refresh(); if (!valid(requestedBy) || !Acc.saveAllowed()) return null; if (!enabled() || String(stage).startsWith('hard-') && HG.features.hard!==1) return null;
  if (hard && HG.features.hardParty !== HARD_PARTY_VERSION) { HG.message = '2인 출정 서버 연결을 확인해 주세요.'; return null; }
  const u = owner(), s = stamp();
  const partner = hard ? (await import('./hard-party.js')).readPartner(hero) : null;
  if (!valid(s)) return null;
  const a = { ...(hard?{p_partyVersion:HARD_PARTY_VERSION,p_partner:partner}:{}), ...(HG.features.repeatTarget===1?{p_target:readTarget(stage)}:{}), p_id: crypto.randomUUID(), p_mode: stage ? 'campaign' : 'challenge', p_stage: stage || null, p_hero: hero };
  try {
    // Retry the same start ID after a lost response; no progress exists until it is acknowledged.
    const r = await locked(u, async () => { try { return await rpc(u, 'start', a); } catch { return rpc(u, 'start', a); } });
    if (!valid(s)) return null; accept(r, s); if (!r.ok) throw new Error(r.reason);
    if (hard && (r.party?.length !== 2 || r.party[0] !== hero || r.party[1] !== a.p_partner || !r.loadouts?.[hero] || !r.loadouts?.[a.p_partner])) throw new Error('출정 편성 불일치');
    return { owner: u, session: Acc.sessionId(), token: r.token, stage: stage || null, build:r.build||null, ...(hard?{party:r.party,loadouts:r.loadouts}:{}), repeat:HG.features.repeatTarget===1&&r.repeat===true, target:HG.features.repeatTarget===1?cleanTarget(r.target):null };
  } catch (e) { if (valid(s)) { HG.status = 'error'; HG.message = 'XP 출정 준비 실패 · 연결을 확인해 주세요. ' + (e.message || e); emit(); } return null; }
}
// Navigation awaits this durable checkpoint; a shared cross-tab lock serializes journal edits.
export async function checkpoint(run, completed, win = false, finish = false, stars = 1, kills = 0) {
  if (!run) return true;
  if (owner() !== run.owner || Acc.sessionId() !== run.session) return false;
  const u = run.owner, s = stamp();
  try {
    await locked(u, () => {
      if (!valid(s)) return; const out = readOut(u), old = out.rewards[run.token];
      out.rewards[run.token] = { p_token: run.token, p_stage:run.stage, p_completed: Math.max(old?.p_completed || 0, completed), p_win: !!win || !!old?.p_win, p_finish: !!finish || !!old?.p_finish, p_stars:Math.max(old?.p_stars||1,Math.min(3,stars|0)) };
      if(String(run.stage||'').startsWith('hard-'))out.rewards[run.token].p_kills=Math.max(old?.p_kills||0,Number.isSafeInteger(kills)&&kills>=0?Math.min(kills,1000000):0);
      write(outKey(u), out); HG.pending = Object.keys(out.rewards).length + Object.keys(out.modes || {}).length + !!out.investment + !!out.build;
    }); emit(); void retry(); return true;
  } catch (e) { HG.message = 'XP 완료 기록 저장 실패: ' + (e.message || e); emit(); return false; }
}
export async function guestDungeon(token, floors, win) {
  if (owner() !== 'guest') return { ok: false }; const s = stamp();
  return locked('guest', async () => { const out = readOut('guest'); out.dungeon = { token, floors, win }; write(outKey('guest'), out); const r = await rpc('guest', 'dungeon', out.dungeon); if (!valid(s)) return { ok: false }; accept(r, s); out.dungeon = null; write(outKey('guest'), out); return r; });
}
export function receipt(r, expectedOwner) { if (owner() === expectedOwner && enabled() && r?.growth) accept(r, stamp()); }
Acc.onChange(() => { if (HG.owner !== owner() || HG.session !== Acc.sessionId()) { HG.status = 'idle'; HG.growth = null; HG.owner = owner(); HG.session = Acc.sessionId(); HG.pending = 0; HG.hasInvestment = false; HG.rewardXP = {}; HG.hardRewards={}; HG.features={}; HG.buildBusy=false; HG.message = ''; emit(); } });
addEventListener('online', () => { void refresh(); });

export async function settleMode(name, args) {
  if (!['spire_finish', 'spire_ping', 'dungeon_ping'].includes(name) || !enabled() || owner() === 'guest') return null;
  const u = owner(), s = stamp();
  try { return await locked(u, async () => {
    if (!valid(s)) return { ok: false, reason: 'account_changed' };
    const out = readOut(u); out.modes ||= {}; const id = name + ':' + args.p_token + (name.endsWith('_ping') ? ':' + (args.p_floor ?? args.p_floors) : '');
    out.modes[id] ||= { name, args }; write(outKey(u), out);
    const r = await rpc(u, name, out.modes[id].args); if (!valid(s)) return { ok: false, reason: 'account_changed' };
    accept(r, s); if (r.ok) { delete out.modes[id]; write(outKey(u), out); }
    HG.pending = Object.keys(out.rewards).length + Object.keys(out.modes).length + !!out.investment; emit(); return r;
  }); } catch (e) { if (valid(s)) { HG.message = '원정 XP 확인 대기 · 마을에서 재시도합니다.'; emit(); } return { ok: false, reason: 'pending', msg: '정산 확인 대기 · 마을에서 자동 재시도합니다.' }; }
}

export async function changeBuild(hero,branch,preset,tier,choice,inTown=false) {
  const u=owner(),s=stamp();if(!inTown||!enabled()||HG.features.trees!==1||HG.buildBusy)return {ok:false,reason:'not_ready'};
  if (!Acc.saveAllowed()) return {ok:false,reason:'pending'};
  HG.buildBusy=true;emit();
  try{return await locked(u,async()=>{
    if(!valid(s))return {ok:false,reason:'account_changed'};if(!Acc.saveAllowed())return {ok:false,reason:'pending'};const out=readOut(u);if(out.build)return {ok:false,reason:'pending'};
    const a={p_id:crypto.randomUUID(),p_revision:HG.growth.rev,p_hero:hero,p_branch:branch,p_preset:preset,p_tier:tier,p_choice:choice};
    out.build=a;write(outKey(u),out);HG.pending++;
    const r=await rpc(u,'build',a);if(!valid(s))return {ok:false,reason:'account_changed'};
    accept(r,s);out.build=null;write(outKey(u),out);HG.pending=Object.keys(out.rewards).length+Object.keys(out.modes||{}).length+!!out.investment;return r;
  });}catch(e){if(valid(s))HG.message='특성 저장 확인 대기';return {ok:false,reason:'pending'};}finally{if(valid(s)){HG.buildBusy=false;emit();}}
}
