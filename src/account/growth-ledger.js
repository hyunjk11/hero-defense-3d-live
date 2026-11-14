// Guest-only ledger. One durable document commits balance and receipt together.
// Caller supplies a cross-tab lock; never used as an authenticated account authority.
import { cleanTarget, validTarget } from '../data/repeat-target.js';
import { changeTree,treeBuild } from '../data/skill-tree.js';
import * as H from '../data/hero-growth.js';
import { STAGES, stageUnlocked } from '../data/stages.js';
export function localGrowth(doc, name, a, save, owns) {
  const d = structuredClone(doc || { wallet: H.initialGrowth(save), runs: {}, investments: {}, modes: {} });
  let w = d.wallet, r;
  if (name === 'status') r = { ok: true, version: 1, features:{trees:1,hard:0,repeatTarget:1} };
  else if(name==='build') {
    const key='tree:'+a.p_id,body=JSON.stringify(a),prev=d.investments[key];
    if(prev)r=prev.body===body?{ok:true,already:true}:{ok:false,reason:'id_reused'};
    else if(a.p_revision!==w.rev)r={ok:false,reason:'conflict'};
    else if(!owns(a.p_hero)||save.adv?.[a.p_hero]?.b!==a.p_branch)r={ok:false,reason:'advancement'};
    else {const t=changeTree(w.trees,a.p_hero,a.p_branch,H.levelOf(w.xp[a.p_hero]),a.p_preset,a.p_tier,a.p_choice);r={ok:!!t,reason:t?null:'locked'};if(t){w.trees=t;w.rev++;d.investments[key]={body};}}
  }
  else if (name === 'invest') {
    const body = JSON.stringify(a), prev = d.investments[a.p_id];
    if (prev) r = prev.body === body ? { ...prev.result, already: true } : { ok: false, reason: 'id_reused' };
    else if (!owns(a.p_hero)) r = { ok: false, reason: 'locked' };
    else if (a.p_revision !== w.rev) r = { ok: false, reason: 'conflict' };
    else { const q = H.invest(w, a.p_hero, a.p_level); r = { ok: q.ok, reason: q.reason, cost: q.cost, level: a.p_level };
      if (q.ok) { d.wallet = w = q.growth; d.investments[a.p_id] = { body, result: r }; } }
  } else if (name === 'start') {
    if (!validTarget(a.p_target) || String(a.p_stage).startsWith('hard-') || !owns(a.p_hero) || a.p_stage && (!STAGES[a.p_stage] || !stageUnlocked(save, a.p_stage))) r = { ok: false, reason: 'locked' };
    else { const prev = d.runs[a.p_id], body = JSON.stringify(a);
      if (prev && prev.body !== body) r = { ok: false, reason: 'id_reused' };
      else { d.runs[a.p_id] ||= { body, repeat: !!save.st?.[a.p_stage], target: save.st?.[a.p_stage] ? cleanTarget(a.p_target) : null, stage: a.p_stage || null, completed: 0, xp: 0, done: false }; d.runs[a.p_id].build ||= treeBuild(w.trees,a.p_hero,save.adv?.[a.p_hero]?.b,H.levelOf(w.xp[a.p_hero])); r = { ok: true, token: a.p_id, build:d.runs[a.p_id].build, target:d.runs[a.p_id].target||null, repeat:!!d.runs[a.p_id].repeat }; } }
  } else if (name === 'progress') {
    const run = d.runs[a.p_token];
    if (!run) r = { ok: false, reason: 'bad_token' };
    else if (!Number.isSafeInteger(a.p_completed) || a.p_completed < 0 || a.p_completed > (STAGES[run.stage]?.waves || 9999)) r = { ok: false, reason: 'invalid' };
    else {
      if (!run.done) {
        run.completed = Math.max(run.completed, a.p_completed); const s = STAGES[run.stage];
        const win = !!(a.p_win && s && run.completed === s.waves), first = win && !w.first.includes(run.stage);
        const xp = H.campaignXP(s || null, run.completed, win, first);
        H.credit(w, Math.max(0, xp - run.xp)); if (first) w.first.push(run.stage);
        Object.assign(run, { xp, done: !!a.p_finish || win });
      }
      r = { ok: true, xp: run.xp };
    }
  } else if (name === 'dungeon') {
    const maxFloors = a.maxFloors === 10 || (save.guestDungeon?.token === a.token && save.guestDungeon.maxFloors === 10) ? 10 : 5;
    const amount = H.dungeonXP(a.floors, a.win, maxFloors), previous = d.modes[a.token] || 0;
    H.credit(w, Math.max(0, amount - previous)); d.modes[a.token] = Math.max(previous, amount); r = { ok: true, xp: d.modes[a.token] };
  } else r = { ok: false, reason: 'invalid' };
  return { doc: d, result: { ...r, growth: H.cleanGrowth(w) } };
}
