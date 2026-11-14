import * as Acc from '../account/account.js';
import * as HG from '../account/hero-growth.js';

// Explicit selection preserves each complete snapshot, including consumption and upgrades.
let panel, shownConflict;
let blocked = [];
function closePanel() { panel?.remove(); panel = null; shownConflict = null; blocked.forEach(([el, old]) => el.inert = old); blocked = []; }
// Capture first: document/window shortcuts must not spend currency behind this dialog.
window.addEventListener('keydown', e => { if (Acc.A.conflict) { if (!panel?.contains(e.target)) e.preventDefault(); e.stopImmediatePropagation(); } }, true);
Acc.onChange(() => {
  if (!Acc.A.conflict) { closePanel(); return; }
  if (panel && shownConflict === Acc.A.conflict) return;
  closePanel(); shownConflict = Acc.A.conflict;
  panel = document.createElement('div');
  panel.className = 'saveConflict';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const box = document.createElement('section'); panel.append(box);
  const title = document.createElement('h2'); title.textContent = '저장 기록 선택'; box.append(title);
  const note = document.createElement('p');
  note.textContent = '이 기기와 서버의 기록이 다릅니다. 사용할 기록 하나를 선택해 주세요. 두 기록은 이 기기에 백업됩니다.';
  box.append(note);
  for (const [source, label] of [['local', '이 기기 기록'], ['cloud', '서버 기록']]) {
    const s = Acc.A.conflict[source];
    const button = document.createElement('button'); button.className = 'gbtn';
    if(source==='local'&&!Acc.canResolveLocal()){button.disabled=true;note.textContent='서버 보상 전의 기기 기록은 덮어쓸 수 없습니다. 두 기록을 백업한 뒤 서버 기록을 확인해 주세요.';}
    button.textContent = `${label} · 영혼석 ${s.souls} · 출정 ${s.stats.runs}회 · 장비 ${s.inv.length + s.stor.length}개`;
    button.onclick = async () => {
      box.querySelectorAll('button').forEach(b => b.disabled = true);
      try { await Acc.resolveConflict(source); } catch (e) { note.textContent = e.message; }
      box.querySelectorAll('button').forEach(b => b.disabled = b.dataset.source==='local'&&!Acc.canResolveLocal());
    };
    button.dataset.source=source;box.append(button);
  }
  const download = document.createElement('button'); download.className = 'gbtn'; download.textContent = '두 기록 백업 다운로드';
  download.onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(Acc.A.conflict, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'hero-defense-save-backup.json'; a.click(); URL.revokeObjectURL(url);
  };
  blocked = [...document.body.children].map(el => [el, el.inert]); blocked.forEach(([el]) => el.inert = true);
  box.append(download); document.body.append(panel); box.querySelector('button').focus();
});

// Recovery belongs to the existing result/account UI. Never create another screen.
let pendingKey='',retryJob=null,autoKey='',autoTimer=null,queued=false,blockedAction=false;
const hosts=()=>['runXP','twAcct','mnAcct'].map(id=>document.getElementById(id)).filter(el=>el&&!el.closest('.hidden'));
function clearRetry(){document.querySelectorAll('[data-save-retry]').forEach(el=>el.remove());}
function scheduleRender(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;renderStatus();});}
function renderStatus() {
  const pending=Acc.serverSaveState(),key=pending ? Acc.A.user?.id+':'+Acc.sessionId()+':'+pending.token : '';
  if(key!==pendingKey){blockedAction=false;pendingKey=key;autoKey='';clearTimeout(autoTimer);autoTimer=null;if(retryJob?.key!==key)retryJob=null;}
  clearRetry();
  if(!pending||Acc.A.conflict)return;
  const retrying=retryJob?.key===key;
  // Retry the same durable receipt once automatically after a failed attempt.
  // The server's receipt/CAS checks remain authoritative; no new reward ID is made.
  if(!pending.busy&&!retrying&&autoKey!==key){autoKey=key;autoTimer=setTimeout(()=>{autoTimer=null;if(pendingKey===key)void retrySave();},0);}
  const recovering=pending.busy||retrying||autoTimer!==null;
  for(const host of hosts()){
    const text=host.id==='runXP'?host:host.querySelector('.sync');if(!text)continue;
    text.textContent=recovering?(blockedAction?Acc.SAVE_WAIT_MESSAGE:'저장 중…'):'저장 확인 실패';
    if(recovering)continue;
    const b=document.createElement('button');b.className='gbtn sm saveRetry';b.dataset.saveRetry='1';b.textContent='다시 시도';b.onclick=()=>retrySave();host.append(b);
  }
}
async function retrySave(){
  if(retryJob?.key===pendingKey)return retryJob.promise;
  if(!pendingKey||Acc.serverSaveState()?.busy||Acc.A.conflict)return false;
  const job={key:pendingKey};retryJob=job;blockedAction=false;
  job.promise=Promise.resolve().then(()=>HG.refresh()).finally(()=>{if(retryJob===job)retryJob=null;scheduleRender();});
  scheduleRender();return job.promise;
}
Acc.onChange(scheduleRender); HG.onGrowth(scheduleRender);
Acc.onSaveBlocked(()=>{blockedAction=true;scheduleRender();});
for(const name of ['error','unhandledrejection']) window.addEventListener(name,e=>{
  if((e.error||e.reason)?.code==='server_save_pending'){e.preventDefault();blockedAction=true;scheduleRender();}
});
window.addEventListener('storage',e=>{if(e.key?.includes('_server_save_'))scheduleRender();});
scheduleRender();
