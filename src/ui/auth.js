// 이메일·비밀번호로 즉시 가입·로그인하는 화면과 메인 메뉴
import { Snd } from '../audio/audio.js';
import { $ } from '../core/util.js';
import { G } from '../core/state.js';
import { mobileApp } from './mobile-mode.js';
import * as Acc from '../account/account.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); // flow.js 와 같은 정의 (util.esc 는 null → '' 이라 그대로 둠)
// 화면 전환(show)은 flow.js 가 가진 SCREENS 상태 — initAuth 로 받음
let H = { show: () => {} };
let busy = false;
function message(text, kind = 'error') { $('lgMsg').textContent = text; $('lgMsg').dataset.kind = kind; }
export function initAuth(h) {
  H = h;
  $('lgEmail').addEventListener('input', () => message(''));
}
export async function afterIntro() {
  Snd.unlock(); Snd.play('confirm'); H.show('login'); refreshLogin(); message('');
  if (Acc.hasSession()) { message('자동 로그인 중…', 'info'); setBusy(true); const ok = await Acc.autoLogin(); setBusy(false); if (ok) { toMenu(); return; } message(Acc.A.msg || '세션이 만료되었습니다. 다시 로그인해 주세요.'); }
}
function setBusy(b) {
  busy = b;
  document.querySelectorAll('#scr_login button, #scr_login input').forEach(x => x.disabled = b);
}
export function refreshLogin() { const st = $('lgStatus'); if (st) st.textContent = Acc.A.user ? `로그인됨: ${Acc.A.user.email}` : ''; }
export async function doAuth(kind) {
  if (busy || !['in', 'up'].includes(kind)) return; // Enter 입력도 버튼과 같은 잠금을 사용한다.
  const email = $('lgEmail').value.trim(), pw = $('lgPw').value; Snd.play('ui');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { message('이메일을 정확히 입력해 주세요.'); return; }
  if (pw.length < 6) { message('비밀번호는 6자 이상이어야 합니다.'); return; }
  setBusy(true); message(kind === 'up' ? '회원가입 중…' : '로그인 중…', 'info');
  try {
    await (kind === 'up' ? Acc.signUp(email, pw) : Acc.signIn(email, pw));
    Snd.play('confirm');
    message(''); $('lgPw').value = ''; toMenu();
  } catch (e) {
    message(e.message || String(e)); Snd.play('error');
  } finally { setBusy(false); }
}
export function toMenu() { H.show('menu'); refreshMenu(); }
export function refreshMenu() {
  if (G.screen !== 'menu') return; const s = Acc.load(), A = Acc.A;
  $('mnAcct').innerHTML = A.user ? `<b data-native-emoji>${esc(A.user.email)}</b><br><span class="sync s_${A.sync}">${Acc.syncText()}</span>` : `<b>게스트</b><br><span class="sync">이 기기에만 저장됩니다</span>`;
  if (document.activeElement !== $('mnNick')) $('mnNick').value = s.nick || '';
  $('mnCont').disabled = !mobileApp && !(s.stats.runs > 0 || s.souls > 0); $('mnSummary').innerHTML = `영혼석 <b>${s.souls}</b> · 최고 웨이브 <b>${s.bestWave}</b> · 출정 ${s.stats.runs}회`;
  $('mnAuth').textContent = A.user ? '로그아웃' : '로그인 / 회원가입';
}
