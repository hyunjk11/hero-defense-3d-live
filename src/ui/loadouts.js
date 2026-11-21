import * as Acc from '../account/account.js';
import * as HG from '../account/hero-growth.js';
import { runDirectGear,directGearEnabled } from '../account/direct-gear-client.js';
import { loadoutStamp } from '../account/loadouts.js';
import { partners,readPartner,writePartner } from '../account/hard-party.js';
import { heroLabel } from '../data/heroes.js';
import { esc } from '../core/util.js';
import { G } from '../core/state.js';
import { askConfirm } from './confirm.js';
let busy=false,message='',owner='';
const reasons={conflict:'다른 곳에서 편성이 변경됐어요. 새 상태를 확인하고 다시 눌러 주세요.',missing:'장비가 없거나 창고에 있어요. 가방으로 가져온 뒤 다시 적용해 주세요.',in_use:'다른 영웅이 사용 중인 장비가 있어요. 해제 후 다시 적용해 주세요.',advancement:'저장 당시와 전직이 달라요. 프리셋을 다시 저장해 주세요.',hero:'보유한 서로 다른 영웅을 선택해 주세요.',tree:'특성 조건이 맞지 않아 적용하지 않았어요.',empty:'먼저 현재 편성을 저장해 주세요.'};
export function mountLoadouts(host,s,refresh,onChange,isCurrent=()=>true){
 const epoch=Acc.sessionId(),key=(Acc.A.user?.id||'')+':'+epoch;if(owner!==key){owner=key;message='';busy=false;}
 const ready=directGearEnabled()&&HG.enabled()&&!HG.HG.buildBusy&&!HG.HG.pending&&G.screen==='town'&&!Acc.serverSaveState()&&!busy;
 const options=partners(s.hero),selected=readPartner(s.hero);
 const status=busy?'편성 저장 확인 중…':message||(!directGearEnabled()?'로그인하면 편성을 저장하고 적용할 수 있어요.':!HG.enabled()?'영웅 정보를 불러오는 중…':'');
 const card=i=>{
  const p=s.battlePresets?.[i],gear=p?Object.values(p.eq||{}).reduce((n,slots)=>n+Object.values(slots||{}).filter(Boolean).length,0):0;
  const talents=p?Object.values(p.builds||{}).reduce((n,b)=>n+Object.keys(b.choices||{}).length,0):0;
  return `<section class="loadoutCard ${p?'isSaved':'isEmpty'}" aria-label="편성 ${i+1}"><header><span class="loadoutNumber">0${i+1}</span><b>편성 ${i+1}</b><span class="loadoutBadge">${p?'저장됨':'비어 있음'}</span></header><div class="loadoutCardBody">${p?`<div class="loadoutSavedParty"><div><small>주영웅</small><strong>${esc(heroLabel(p.hero))}</strong></div><div><small>파트너</small><strong>${esc(heroLabel(p.partner))}</strong></div></div><p class="loadoutMeta">장비 ${gear}개 · 특성 ${talents}개 저장</p>`:'<div class="loadoutEmptyMark" aria-hidden="true">＋</div><div><strong>저장된 편성이 없어요</strong><p>현재 장비와 특성을 이 칸에 담아 두세요.</p></div>'}</div><footer><button class="gbtn loadoutSave" data-save="${i}" aria-label="편성 ${i+1}에 현재 구성 저장" ${!ready||!options.length?'disabled':''}>${p?'덮어쓰기':'편성 저장'}</button><button class="gbtn loadoutApply" data-apply="${i}" aria-label="편성 ${i+1} 적용" ${!ready||!p?'disabled':''}>적용</button></footer></section>`;
 };
 host.innerHTML=`<div class="loadoutView"><p class="loadoutIntro">장비·특성·파트너를 함께 저장하고, 원하는 조합으로 빠르게 바꿔 보세요.</p><div class="loadoutStatus" role="status" ${status?'':'hidden'}>${esc(status)}</div><section class="loadoutCurrent" aria-label="저장할 현재 편성"><div class="loadoutMain"><span class="loadoutLabel">현재 주영웅</span><strong>${esc(heroLabel(s.hero))}</strong></div><span class="loadoutLink" aria-hidden="true">＋</span><label class="loadoutPartner"><span class="loadoutLabel">함께할 파트너</span><span class="loadoutSelect"><select id="presetPartner" aria-label="프리셋 파트너" ${busy||!options.length?'disabled':''}>${options.map(h=>`<option value="${h}" ${h===selected?'selected':''}>${esc(heroLabel(h))}</option>`).join('')}</select></span></label></section><div class="loadoutGrid">${[0,1].map(card).join('')}</div><details class="loadoutRules"><summary>적용 전 알아두기</summary><p>적용하면 현재 장비와 활성 특성 칸을 저장된 구성으로 바꿉니다. 창고에 있거나 다른 영웅이 쓰는 장비, 전직이 바뀐 편성은 일부만 적용하지 않고 중단합니다.</p></details></div>`;
 const act=async(action,index)=>{
  if(!ready||busy||owner!==key)return;
  const partner=host.querySelector('#presetPartner').value;
  busy=true;let confirmed=true;
  try{
   if(action==='preset_save'&&s.battlePresets?.[index])confirmed=await askConfirm({title:'편성 덮어쓰기',body:`편성 ${index+1}을 현재 장비·특성·파트너로 바꿀까요?`,ok:'저장'});
   if(!confirmed||Acc.sessionId()!==epoch||G.screen!=='town'||!isCurrent())return;
   const expected=loadoutStamp(s,HG.HG.growth?.rev);refresh();
   const [r]=await runDirectGear([{p_action:action,p_count:index,p_hero:s.hero,p_partner:partner,p_expected:expected}]);
   if(Acc.sessionId()!==epoch)return;
   if(r.ok&&action==='preset_apply'&&!HG.sortieSettingsEnabled())writePartner(Acc.load().hero,Acc.load().battlePartner);
   await HG.refresh({maxAgeMs:0});
   if(Acc.sessionId()!==epoch)return;
   message=r.ok?(action==='preset_save'?'편성을 저장했어요.':'장비·특성·파트너를 적용했어요.'):reasons[r.reason]||'적용하지 않았어요. 저장 상태를 확인해 주세요.';onChange();
  }catch(e){if(Acc.sessionId()===epoch)message=e.message||Acc.SAVE_WAIT_MESSAGE;}
  finally{if(Acc.sessionId()===epoch){busy=false;refresh();}}
 };
 host.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>act('preset_save',+b.dataset.save));
 host.querySelectorAll('[data-apply]').forEach(b=>b.onclick=()=>act('preset_apply',+b.dataset.apply));
}
