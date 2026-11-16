// ================= 공용 확인창 (브라우저 기본 확인창 대신 · 게임 스타일) =================
// askConfirm({ title, body, ok, cancel, tone:'danger', icon }) → Promise<boolean>
// Enter/Space = 포커스된 버튼 · Esc = 취소 (캡처 단계에서 처리해 뒤 패널의 Esc 가 같이 닫히지 않음) · 바깥 클릭 = 취소
// DOM 은 #advConfirm 과 같은 모양(.acBox) — body 에 #gConfirm 한 번만 만들어 재사용. 열린 상태에서 또 부르면 이전 것은 취소(false)
import { Snd } from '../audio/audio.js';
import { esc } from '../core/util.js';
import { escLayer } from './keys.js';

let el = null, pend = null, returnFocus = null;
function ensure() {
  if (el) return el;
  el = document.createElement('div'); el.id = 'gConfirm'; el.className = 'hidden';
  el.innerHTML = '<div class="acBox" role="dialog" aria-modal="true"><div class="acIco"></div><h3 class="gcT"></h3><div class="gcB"></div><div class="acBtns"><button class="gbtn main" id="gcOk"></button><button class="gbtn" id="gcNo"></button></div></div>';
  document.body.appendChild(el); escLayer('confirm', 100, () => !!pend, () => done(false));
  el.addEventListener('click', e => { if (e.target === el) done(false); });
  el.querySelector('#gcOk').onclick = () => done(true); el.querySelector('#gcNo').onclick = () => done(false);
  addEventListener('keydown', e => { if (!pend) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(false); }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      const focused = document.activeElement;
      if (focused === el.querySelector('#gcOk')) done(true);
      else if (focused === el.querySelector('#gcNo')) done(false);
    }
    else if (e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation();
      const ok = el.querySelector('#gcOk'), no = el.querySelector('#gcNo');
      (document.activeElement === ok ? no : document.activeElement === no ? ok : e.shiftKey ? no : ok).focus({ preventScroll: true });
    }
    else e.stopImmediatePropagation(); // 확인창이 떠 있는 동안 다른 단축키(게임·패널) 막기
  }, { capture: true });
  return el;
}
function done(v) { if (!pend) return; const r = pend; pend = null; el.classList.add('hidden'); if (!v) Snd.play('ui'); const prev = returnFocus; returnFocus = null; if (prev?.isConnected) prev.focus?.({ preventScroll: true }); r(v); }
export function askConfirm({ title = '확인', body = '', ok = '확인', cancel = '취소', tone = '', icon = '' } = {}) {
  ensure(); if (pend) { const r = pend; pend = null; r(false); } else returnFocus = document.activeElement;
  el.querySelector('.acIco').textContent = icon; el.querySelector('.acIco').style.display = icon ? '' : 'none';
  el.querySelector('.gcT').textContent = title; el.querySelector('.gcB').innerHTML = esc(body).replace(/\n/g, '<br>');
  const okB = el.querySelector('#gcOk'); okB.textContent = ok; okB.classList.toggle('danger', tone === 'danger'); el.querySelector('#gcNo').textContent = cancel;
  el.classList.toggle('danger', tone === 'danger'); el.classList.remove('hidden'); Snd.play('ui');
  return new Promise(res => { pend = res; okB.focus({ preventScroll: true }); });
}
