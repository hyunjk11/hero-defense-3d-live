import { SORTIE_SETTINGS_VERSION, cleanSortieSettings, validSortieChapter, validSortieParty } from '../src/data/sortie-settings.js';
import { AWAKENING_VERSION, AWAKENING_SKILL_VERSION, awakeningQuote, cleanAwakening, awakeningLevel, cleanAwakeningSkills, awakeningSkillOn } from '../src/data/awakening.js';
import { validPartner, HARD_PARTY_VERSION } from '../src/data/hard-party.js';
import * as E from '../src/account/equip.js';
import { advOf } from '../src/data/advance.js';
import { applyMail } from '../src/account/progress.js';
import { packSave } from '../src/account/storage.js';
import { failure, denied, paidHeroes } from './common.mjs';
import * as H from '../src/data/hero-growth.js';
import { VISIBLE_HEROES } from '../src/data/heroes.js';
import { changeTree, treeBuild } from '../src/data/skill-tree.js';
import { HARD_STAGES, cleanHard, hardReward } from '../src/data/hard.js';
import { cleanTarget, validTarget } from '../src/data/repeat-target.js';
import { HARD_REWARD_VERSION } from '../src/data/hard-collection.js';
import { waveBoss } from '../src/core/roster.js';
import { STAGES, getStage, stageUnlocked, stars, STAR_STEP } from '../src/data/stages.js';
const idOK = id => typeof id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(id);
const intOK = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
export async function growthWallet(c) {
  let w = await c.get('growth_wallet', c.uid);
  if (!w) {
    const p = await c.get('progress', c.uid), source = p?.data || {};
    w = { user_id: c.uid, ...H.initialGrowth(source), migration: { release: 'hero-level-1', at: c.iso, sourceStamp: p?.updated_at || null, stages: Object.keys(source.st || {}).filter(k => STAGES[k]?.ch <= 8 && source.st[k] > 0) }, created_at: c.iso };
    await c.put('growth_wallet', w);
  }
  return w;
}
export const growthView = w => H.cleanGrowth(w);
const battlePartnerOf=p=>VISIBLE_HEROES.includes(p?.data?.battlePartner)?p.data.battlePartner:null;
const owned = async (c, hero) => VISIBLE_HEROES.includes(hero) && (!paidHeroes.includes(hero) || !!await c.get('owned', c.uid + '~hero_' + hero));
export async function creditMode(c, mode, token, cumulative) {
  const key = c.uid + '~' + mode + '~' + token, old = await c.get('growth_receipts', key);
  const w = await growthWallet(c), previous = old?.amount || 0;
  if (cumulative > previous) { H.credit(w, cumulative - previous); await c.put('growth_wallet', w); await c.put('growth_receipts', { id: key, user_id: c.uid, mode, token, amount: cumulative, at: c.iso }); }
  return { xp: Math.max(previous, cumulative), growth: growthView(w) };
}
const hardStarCount=hard=>Object.values(hard.st).reduce((sum,n)=>sum+n,0);
const validHardBosses=(bosses,stage,wave)=>Array.isArray(bosses)&&bosses.length<=wave&&bosses.every((n,i)=>Number.isSafeInteger(n)&&n>=1&&n<=wave&&!!waveBoss(stage,n)&&(i===0||n>bosses[i-1]));
function appendHardFirst(reward,s,hero,bosses,starTier,random){
  const add=odds=>{
    const slot=E.SLOT_KEYS[Math.floor(random()*E.SLOT_KEYS.length)];
    if(s.ch>=3)odds[0]=0;
    const g=E.rollGrade(odds,random);
    (reward.items??=[]).push({k:'gear',s:slot,...(slot==='weapon'?{h:hero}:{}),g,c:s.ch});
  };
  for(const wave of bosses)if(random()<E.BOSS_DROP)add(E.bossOdds(wave));
  if(starTier)add(E.chestOdds(2+starTier));
}
export async function growth(c, name, a, {hardFirstBonus=false,awakening=false,sortieSettings=false}={}) {
  c.requirePlayer();
  if (name === 'status') return { ok: true, version: H.VERSION, features:{trees:1,hard:1,repeatTarget:1,hardCollection:1,hardParty:HARD_PARTY_VERSION,...(hardFirstBonus?{hardFirstBonus:1}:{}),...(awakening?{awakening:AWAKENING_VERSION,awakeningSkill:AWAKENING_SKILL_VERSION}:{}),...(sortieSettings?{sortieSettings:SORTIE_SETTINGS_VERSION}:{})}, growth: growthView(await growthWallet(c)), ...(sortieSettings?{battlePartner:battlePartnerOf(await c.get('progress',c.uid))}:{}) };
  if(name==='sortie_settings'&&sortieSettings){
    const kind=a.p_kind,value=a.p_value;
    if(!['hard','repeat','dungeon','spire'].includes(kind))return failure('invalid');
    const fields=['p_id','p_revision','p_kind','p_value',...(kind==='hard'?['p_main']:kind==='repeat'?['p_chapter']:[])];
    if(Object.keys(a).some(k=>!fields.includes(k))||!Object.hasOwn(a,'p_value')||!idOK(a.p_id)||!intOK(a.p_revision,H.MAX_XP))return failure('invalid');
    if(kind==='hard'&&(!VISIBLE_HEROES.includes(a.p_main)||value!==null&&!validPartner(a.p_main,value)))return failure('invalid');
    if(kind==='repeat'&&(!validSortieChapter(a.p_chapter)||value!==null&&!cleanTarget(value)))return failure('invalid');
    if((kind==='dungeon'||kind==='spire')&&!validSortieParty(value))return failure('invalid');
    const key=c.uid+'~sortie-settings~'+a.p_id,body=JSON.stringify([kind,value,a.p_main??null,a.p_chapter??null,a.p_revision]);
    const prior=await c.get('growth_investments',key);
    if(prior&&prior.body!==body)return failure('id_reused');
    const w=await growthWallet(c),p=await c.get('progress',c.uid);
    const view=()=>({growth:growthView(w),battlePartner:battlePartnerOf(p)});
    if(prior)return {ok:true,already:true,...view()};
    if(w.rev!==a.p_revision)return failure('conflict',view());
    if(!p)return failure('missing_save',view());
    const heroes=kind==='hard'?[a.p_main,...(value===null?[]:[value])]:kind==='repeat'?[]:value;
    if(!(await Promise.all(heroes.map(h=>owned(c,h)))).every(Boolean))return failure('hero',view());
    if(kind==='hard'){
      // The same field is written by authoritative bag-preset apply. Never
      // shadow it in the growth wallet or change any preset, gear or tree.
      const next={...p.data};if(value===null)delete next.battlePartner;else next.battlePartner=value;
      if(view().battlePartner!==value){
        p.data=next;p.updated_at=new Date(Math.max(c.now,(Date.parse(p.updated_at)||0)+1)).toISOString();
        await c.put('progress',{...p,data:packSave(next)});
      }
    }else{
      const prefs=cleanSortieSettings(w.sortieSettings);
      if(kind==='repeat')(prefs.repeatTarget??={})[a.p_chapter]=value;
      else prefs[kind]=value.slice();
      w.sortieSettings=prefs;
    }
    w.rev++;
    await c.put('growth_wallet',w);
    await c.put('growth_investments',{id:key,user_id:c.uid,body,at:c.iso});
    return {ok:true,...view()};
  }
  if(name==='awakening_skill'&&awakening){
    if(Object.keys(a).some(k=>!['p_id','p_hero','p_on','p_revision'].includes(k))||!idOK(a.p_id)||!intOK(a.p_revision,H.MAX_XP)||typeof a.p_on!=='boolean'||!await owned(c,a.p_hero))return failure('invalid');
    const key=c.uid+'~awakening-skill~'+a.p_id,body=JSON.stringify([a.p_hero,a.p_on,a.p_revision]);
    const prior=await c.get('growth_investments',key);
    if(prior&&prior.body!==body)return failure('id_reused');
    const w=await growthWallet(c);
    if(prior)return {ok:true,already:true,growth:growthView(w)};
    if(w.rev!==a.p_revision)return failure('conflict',{growth:growthView(w)});
    const p=await c.get('progress',c.uid);
    if(!p)return failure('missing_save');
    if(awakeningLevel(w,a.p_hero,p.data?.adv?.[a.p_hero])===null)return failure('locked',{growth:growthView(w)});
    w.awakeningSkill={...cleanAwakeningSkills(w.awakeningSkill),[a.p_hero]:a.p_on};
    w.rev++;
    await c.put('growth_wallet',w);
    await c.put('growth_investments',{id:key,user_id:c.uid,body,at:c.iso});
    return {ok:true,growth:growthView(w)};
  }
  if(name==='awaken'&&awakening){
    if(Object.keys(a).some(k=>!['p_id','p_hero','p_level','p_revision'].includes(k))||!idOK(a.p_id)||!intOK(a.p_revision,H.MAX_XP)||!intOK(a.p_level,H.MAX_LEVEL)||!await owned(c,a.p_hero))return failure('invalid');
    const key=c.uid+'~awakening~'+a.p_id,body=JSON.stringify([a.p_hero,a.p_level,a.p_revision]);
    const prior=await c.get('growth_investments',key);if(prior&&prior.body!==body)return failure('id_reused');
    const p=await c.get('progress',c.uid);if(!p)return failure('missing_save');
    const resources=save=>({souls:save.souls||0,steel:save.mat?.steel||0,crystal:save.mat?.crystal||0});
    const w=await growthWallet(c);
    if(prior)return {...prior.result,already:true,resources:resources(p.data),growth:growthView(w)};
    if(w.rev!==a.p_revision)return failure('conflict',{resources:resources(p.data),growth:growthView(w)});
    const q=awakeningQuote(growthView(w),p.data,a.p_hero,a.p_level);
    if(!q.ok)return failure(q.reason,{quote:q,resources:resources(p.data),growth:growthView(w)});
    const next={...p.data,souls:(p.data.souls||0)-q.souls,mat:{...p.data.mat,steel:(p.data.mat?.steel||0)-q.steel,crystal:(p.data.mat?.crystal||0)-q.crystal}};
    w.awakening={...cleanAwakening(w.awakening),[a.p_hero]:a.p_level};
    w.balance-=q.xp;w.spent+=q.xp;w.rev++;
    if(q.souls||q.steel||q.crystal)await c.put('progress',{...p,data:packSave(next),updated_at:new Date(Math.max(c.now,(Date.parse(p.updated_at)||0)+1)).toISOString()});
    await c.put('growth_wallet',w);
    const result={ok:true,hero:a.p_hero,level:a.p_level,xp:q.xp,souls:q.souls,steel:q.steel,crystal:q.crystal,id:a.p_id};
    await c.put('growth_investments',{id:key,user_id:c.uid,body,result,at:c.iso});
    return {...result,resources:resources(next),growth:growthView(w)};
  }
  if(name==='build') {
    if(!idOK(a.p_id)||!intOK(a.p_revision,H.MAX_XP)||!await owned(c,a.p_hero))return failure('invalid');
    const key=c.uid+'~tree~'+a.p_id,body=JSON.stringify([a.p_hero,a.p_branch,a.p_preset,a.p_tier,a.p_choice,a.p_revision]);
    const prev=await c.get('growth_investments',key);if(prev)return prev.body===body?{ok:true,already:true,growth:growthView(await growthWallet(c))}:failure('id_reused');
    const w=await growthWallet(c),p=await c.get('progress',c.uid);
    if(w.rev!==a.p_revision)return failure('conflict',{growth:growthView(w)});
    if((typeof p?.data?.adv?.[a.p_hero]==='string'?p.data.adv[a.p_hero]:p?.data?.adv?.[a.p_hero]?.b)!==a.p_branch)return failure('advancement');
    const trees=changeTree(w.trees,a.p_hero,a.p_branch,H.levelOf(w.xp[a.p_hero]),a.p_preset,a.p_tier,a.p_choice);
    if(!trees)return failure('locked'); w.trees=trees;w.rev++;await c.put('growth_wallet',w);
    await c.put('growth_investments',{id:key,user_id:c.uid,body,at:c.iso});return {ok:true,growth:growthView(w)};
  }
  if (name === 'invest') {
    if (!idOK(a.p_id) || !intOK(a.p_revision, H.MAX_XP) || !Number.isInteger(a.p_level) || !await owned(c, a.p_hero)) return failure('invalid');
    const key = c.uid + '~' + a.p_id, body = JSON.stringify([a.p_hero, a.p_level, a.p_revision]), receipt = await c.get('growth_investments', key);
    if (receipt) return receipt.body === body ? { ...receipt.result, already: true, growth: growthView(await growthWallet(c)) } : failure('id_reused');
    const w = await growthWallet(c); if (w.rev !== a.p_revision) return failure('conflict', { growth: growthView(w) });
    const r = H.invest(w, a.p_hero, a.p_level); if (!r.ok) return failure(r.reason, { growth: growthView(w) });
    await c.put('growth_wallet', r.growth);
    const result = { ok: true, hero: a.p_hero, level: a.p_level, cost: r.cost, id: a.p_id, growth: growthView(r.growth) };
    await c.put('growth_investments', { id: key, user_id: c.uid, body, result, at: c.iso }); return result;
  }
  if (name === 'start') {
    if (!validTarget(a.p_target) || !idOK(a.p_id) || !['campaign', 'challenge'].includes(a.p_mode) || !await owned(c, a.p_hero)) return failure('invalid');
    const key = c.uid + '~' + a.p_id, old = await c.get('growth_runs', key), stage = a.p_mode === 'campaign' ? a.p_stage : null;
    const awakeningRequested=awakening&&a.p_awakeningVersion===AWAKENING_VERSION;
    if(awakening&&a.p_awakeningVersion!==undefined&&!awakeningRequested)return failure('invalid');
    const awakeningSkillRequested=awakeningRequested&&a.p_awakeningSkillVersion===AWAKENING_SKILL_VERSION;
    if(awakening&&a.p_awakeningSkillVersion!==undefined&&!awakeningSkillRequested)return failure('invalid');
    const firstBonusRequested=hardFirstBonus&&a.p_hardFirstBonus===1;
    if(hardFirstBonus&&a.p_hardFirstBonus!==undefined&&(!firstBonusRequested||!HARD_STAGES[stage]))return failure('invalid');
    const partyRequested = a.p_partyVersion !== undefined || a.p_partner !== undefined;
    if (partyRequested && (a.p_partyVersion !== HARD_PARTY_VERSION || !HARD_STAGES[stage] || a.p_mode !== 'campaign' || !validPartner(a.p_hero, a.p_partner) || !await owned(c, a.p_partner))) return failure('invalid_party');
    if (old) return (old.partner || null) === (a.p_partner || null) && (old.partyVersion || null) === (a.p_partyVersion || null) && (old.repeat||!!old.hardFirstBonus===firstBonusRequested) && (!old.awakeningSkillVersion||awakeningSkillRequested) && !!old.awakeningVersion===awakeningRequested && old.stage === stage && old.hero === a.p_hero && old.mode === a.p_mode && (old.requestedTarget || null) === cleanTarget(a.p_target) ? { ok: true, token: old.token, growth: growthView(await growthWallet(c)), build: old.build, ...(old.party?{party:old.party,loadouts:old.loadouts}:{}), target: old.target || null, repeat: !!old.repeat, ...(old.hardFirstBonus?{hardFirstBonus:1}:{}), ...(old.awakeningVersion?{awakeningLevel:old.awakeningLevel}:{}), ...(old.awakeningSkillVersion&&typeof old.awakeningUseE==='boolean'?{awakeningUseE:old.awakeningUseE}:{}) } : failure('id_reused');
    const p = await c.get('progress', c.uid);
    if (stage && (!getStage(stage) || !stageUnlocked({...p?.data,growth:growthView(await growthWallet(c))}, stage))) return failure('locked');
    if (a.p_mode === 'campaign' && !stage) return failure('invalid');
    const w = await growthWallet(c);
    const build=treeBuild(w.trees,a.p_hero,(typeof p?.data?.adv?.[a.p_hero]==='string'?p.data.adv[a.p_hero]:p?.data?.adv?.[a.p_hero]?.b),H.levelOf(w.xp[a.p_hero]));
    const party = partyRequested ? [a.p_hero, a.p_partner] : null;
    const launchAwakening=h=>awakeningLevel(w,h,p?.data?.adv?.[h]);
    const launchUseE=h=>awakeningSkillRequested&&launchAwakening(h)!==null?{awakeningUseE:awakeningSkillOn(w,h)}:{};
    const loadouts = party ? Object.fromEntries(party.map(h => [h, { perm: structuredClone(p.data.heroLv[h] || {hp:0,atk:0}), equip:E.bonus(p.data,h), legend:E.legendOf(p.data,h), adv:advOf(h,p.data.adv?.[h]), heroLevel:H.levelOf(w.xp[h]), heroTree:treeBuild(w.trees,h,typeof p.data.adv?.[h]==='string'?p.data.adv[h]:p.data.adv?.[h]?.b,H.levelOf(w.xp[h])), heroGear:E.equippedItems(p.data,h), ...(awakeningRequested?{awakeningLevel:launchAwakening(h)}:{}), ...launchUseE(h) }])) : null;
    const repeat = !!stage && stars({...p?.data,growth:growthView(w)},stage)>0;
    const target = repeat ? cleanTarget(a.p_target) : null;
    const run = { ...(party?{party,loadouts,partner:a.p_partner,partyVersion:HARD_PARTY_VERSION}:{}), build, repeat, target, requestedTarget: cleanTarget(a.p_target), id: key, user_id: c.uid, token: a.p_id, mode: a.p_mode, hero: a.p_hero, stage, completed: 0, xp: 0, won: false, done: false, started_at: c.iso, version: H.VERSION, ...(HARD_STAGES[stage]?{hardRewardVersion:HARD_REWARD_VERSION}:{}), ...(firstBonusRequested&&!repeat?{hardFirstBonus:1}:{}), ...(awakeningRequested?{awakeningVersion:AWAKENING_VERSION,awakeningLevel:launchAwakening(a.p_hero)}:{}), ...(awakeningSkillRequested?{awakeningSkillVersion:AWAKENING_SKILL_VERSION,...launchUseE(a.p_hero)}:{}) };
    await c.put('growth_runs', run); return { ok: true, token: run.token, build:run.build, ...(party?{party,loadouts}:{}), target:run.target, repeat:run.repeat, ...(run.hardFirstBonus?{hardFirstBonus:1}:{}), ...(awakeningRequested?{awakeningLevel:run.awakeningLevel}:{}), ...(typeof run.awakeningUseE==='boolean'?{awakeningUseE:run.awakeningUseE}:{}), growth: growthView(w) };
  }
  if (name === 'progress') {
    if (!idOK(a.p_token) || !intOK(a.p_completed, 9999) || typeof a.p_win !== 'boolean' || typeof a.p_finish !== 'boolean') return failure('invalid');
    const r = await c.get('growth_runs', c.uid + '~' + a.p_token); if (!r) return failure('bad_token');
    const w = await growthWallet(c);
    if (r.done) return { ok: true, already: true, xp: r.xp, completed: r.completed, win: r.won, hardSaved:!!r.hardSaved, hardReward:r.reward||null, growth: growthView(w) };
    const s = r.stage && getStage(r.stage);
    // Telemetry only: kills never change XP, souls or loot. Old clients omit it.
    if(s?.hard&&a.p_kills!==undefined&&!intOK(a.p_kills,1000000))return failure('invalid');
    if (s && a.p_completed > s.waves || a.p_win && (!s || a.p_completed !== s.waves)) return failure('invalid');
    const hardBosses=r.hardFirstBonus&&a.p_bossKills!==undefined?a.p_bossKills:[];
    if(r.hardFirstBonus&&!validHardBosses(hardBosses,s,a.p_completed))return failure('invalid');
    // Sanity floor, not proof of gameplay. No expiry of acknowledged or offline pending rewards.
    if ((c.now - Date.parse(r.started_at)) / 1000 < a.p_completed * 2) return failure('too_fast');
    const completed = Math.max(r.completed, a.p_completed), win = r.won || a.p_win;
    let xp = H.campaignXP(s || null, completed, win, false);
    if (win && !w.first.includes(r.stage)) { xp = H.campaignXP(s, completed, true, true); w.first.push(r.stage); r.firstBonus = xp - H.campaignXP(s, completed, true, false); }
    else xp += r.firstBonus || 0;
    H.credit(w, Math.max(0, xp - r.xp)); Object.assign(r, { completed, won: win, xp, done: a.p_finish || win, updated_at: c.iso });
    if(s?.hard)r.kills=Math.max(r.kills||0,a.p_kills||0);
    if(s?.hard&&r.done){
      w.hard=cleanHard(w.hard);const first=!w.hard.st[s.id];
      const extra=!!r.hardFirstBonus&&!r.repeat&&first&&win;
      const starBefore=extra?Math.floor(hardStarCount(w.hard)/STAR_STEP):0;
      if(win)w.hard.st[s.id]=Math.max(w.hard.st[s.id]||0,Number.isInteger(a.p_stars)&&a.p_stars>=1&&a.p_stars<=3?a.p_stars:1);
      // Only an actual repeat departure with a finishing acknowledgement uses the new contract.
      // The client's version/count/grade/target fields cannot upgrade an old run or receipt.
      const rewardVersion=r.repeat&&a.p_finish?r.hardRewardVersion:1;
      const reward=hardReward(s,completed,win,first,r.hero,c.random,win&&!first&&r.repeat?r.target:null,rewardVersion);
      if(extra){
        const starAfter=Math.floor(hardStarCount(w.hard)/STAR_STEP);
        appendHardFirst(reward,s,r.hero,hardBosses,starAfter>starBefore?starAfter:0,c.random);
      }
      r.reward={souls:reward.souls,chests:reward.items?.length||0};
      if(reward.souls||reward.items?.length||r.kills){
        const p=await c.get('progress',c.uid);if(!p) return failure('missing_save');
        let next=p.data,loot=[];
        if(reward.souls||reward.items?.length){
          const mail=await c.mail(c.uid,s.no+' 원정 보상','서버 저장 완료',reward,{claimed:true,claimed_at:c.iso,server_applied:true});
          [next,,loot]=applyMail(p.data,mail.id,reward);
        }
        r.reward={souls:reward.souls,chests:loot.filter(x=>x.chest).length,steel:next.mat.steel-(p.data.mat?.steel||0),crystal:next.mat.crystal-(p.data.mat?.crystal||0)};
        const stats={...(p.data.stats||{}),runs:(p.data.stats?.runs||0)+1,kills:(p.data.stats?.kills||0)+(r.kills||0),waves:(p.data.stats?.waves||0)+completed,souls:(p.data.stats?.souls||0)+reward.souls};
        const data={...p.data,souls:next.souls,mat:next.mat,chests:next.chests,mailLog:next.mailLog,stats,hardRewardSeq:(p.data.hardRewardSeq||0)+1};
        await c.put('progress',{...p,data:packSave(data),updated_at:new Date(Math.max(c.now,(Date.parse(p.updated_at)||0)+1)).toISOString()});r.hardSaved=true;
      }
      w.rev++;
    }
    await c.put('growth_wallet', w); await c.put('growth_runs', r);
    return { ok: true, xp, completed, win, hardSaved:!!r.hardSaved, hardReward:r.reward||null, growth: growthView(w) };
  }
  return null;
}
