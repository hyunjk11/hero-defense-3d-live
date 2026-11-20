import * as HG from '../account/hero-growth.js';
import * as Acc from '../account/account.js';
import { heroOwned } from '../account/shop.js';
import { awakeningSupported, awakeningLevel, awakeningQuote, awakeningMods, AWAKENING_MAX } from '../data/awakening.js';
import { G } from '../core/state.js';

const names = { warrior:'쌍성 방벽', mage:'빙결 수렴', fighter:'묘왕파' };
const $ = id => document.getElementById(id);
const current = () => Acc.A.user?.id + ':' + Acc.sessionId();
let hero, owner, target, previous, pending = null, message = '';
const num = n => n.toLocaleString('ko-KR');
const town = () => G.screen === 'town' && !$('statPanel')?.classList.contains('hidden');

async function apply(level) {
  if (!town() || !HG.enabled() || !HG.awakeningEnabled() || !heroOwned(hero) || pending?.owner === current()) return;
  const s = Acc.load(), g = HG.HG.growth;
  if (!awakeningQuote(g,s,hero,level).ok) return;
  const job = { hero, owner:current() };
  pending = job; message = ''; renderAwakening(hero,s);
  try {
    const r = await HG.awaken(job.hero,level);
    if (job.owner !== current() || hero !== job.hero) return;
    message = r.ok ? '' : r.reason === 'conflict' ? '다른 기기에서 변경됐어요. 다시 확인해 주세요.' : HG.HG.message || '각성하지 못했어요. 잠시 후 다시 시도해 주세요.';
  } finally {
    if (pending === job) pending = null;
    if (town()) renderAwakening(hero,Acc.load());
  }
}

export function renderAwakening(selected,save) {
  const host = $('awCard');
  if (!host) return;
  if (!HG.awakeningEnabled() || !awakeningSupported(selected,save.adv?.[selected]) || !heroOwned(selected)) {
    host.classList.add('hidden'); return;
  }
  const g = HG.HG.growth;
  const level = awakeningLevel(g,selected,save.adv?.[selected]);
  const unlock = awakeningQuote(g,save,selected,0);
  if (level === null && !unlock.ok) { host.classList.add('hidden'); return; }
  if (selected !== hero || current() !== owner || previous !== level) {
    hero = selected; owner = current(); target = Math.min(AWAKENING_MAX,(level ?? -1) + 1); previous = level; message = '';
  }
  if (!host.firstElementChild) {
    host.innerHTML = `<div class="awHeading"><strong id="awTitle"></strong><button type="button" id="awSkill" class="gbtn" aria-label="각성 스킬"></button></div>
      <p id="awBonus"></p><button type="button" id="awUnlock" class="gbtn main">각성</button>
      <div id="awTrain"><div class="awChoices"><button type="button" id="awOne" class="gbtn">+1</button><button type="button" id="awFive" class="gbtn">+5</button><button type="button" id="awConfirm" class="gbtn main"></button></div><p id="awCost"></p></div><p id="awMessage" role="status"></p>`;
    $('awUnlock').onclick = () => void apply(0);
    $('awConfirm').onclick = () => void apply(target);
    for (const [id,n] of [['awOne',1],['awFive',5]]) $(id).onclick = () => {
      target = Math.min(AWAKENING_MAX,previous+n); message = ''; renderAwakening(hero,Acc.load());
    };
    $('awSkill').onclick = () => {
      HG.setAwakeningSkill(hero,!HG.awakeningSkill(hero)); renderAwakening(hero,Acc.load());
    };
  }
  host.classList.remove('hidden');
  const busy = pending?.owner === current() || !!Acc.serverSaveState();
  const disabled = busy || !HG.enabled();
  const skill = HG.awakeningSkill(hero);
  $('awTitle').textContent = level === null ? '각성' : `각성 Lv.${level}`;
  const stats = awakeningMods(level);
  $('awBonus').textContent = level > 0 ? `공격 +${num(Math.round((stats.dmg-1)*1000)/10)}% · 체력 +${num(Math.round((stats.hp-1)*1000)/10)}%` : '';
  $('awSkill').classList.toggle('hidden',level === null);
  $('awSkill').textContent = skill ? names[hero] : '기본 스킬';
  $('awSkill').setAttribute('aria-pressed',String(skill));
  $('awSkill').disabled = busy;
  $('awUnlock').classList.toggle('hidden',level !== null);
  $('awUnlock').disabled = disabled;
  $('awTrain').classList.toggle('hidden',level === null || level >= AWAKENING_MAX);
  $('awMessage').textContent = busy ? HG.HG.message || '저장 확인 중…' : message;
  if (level === null || level >= AWAKENING_MAX) return;
  const q = awakeningQuote(g,save,hero,target);
  $('awOne').disabled = $('awFive').disabled = disabled;
  $('awOne').setAttribute('aria-pressed',String(target===level+1));
  $('awFive').setAttribute('aria-pressed',String(target===level+5));
  $('awConfirm').disabled = disabled || !q.ok;
  $('awConfirm').textContent = `Lv.${target} 올리기`;
  $('awCost').textContent = [q.xp&&num(q.xp)+' XP',q.souls&&'영혼석 '+num(q.souls),q.steel&&'강철 '+num(q.steel),q.crystal&&'마력석 '+num(q.crystal)].filter(Boolean).join(' · ');
  $('awCost').classList.toggle('xpError',q.reason === 'poor');
}
