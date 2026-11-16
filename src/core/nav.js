// ================= 페이지 전환 (URL 쿼리 바꾼 뒤 location.replace 새로고침) =================
// 모드 키 목록은 여기 한 곳에서 관리 → 새 모드 파라미터를 추가할 때 이 목록만 고치면 됨. 그 밖의 키(rng·seed·sb 등)는 유지
// go({town:1}) 마을 · go({stage:id}) 스테이지 출정 · go({dungeon:1}) 던전 원정
export const MODE_KEYS = ['town', 'stage', 'run', 'hard', 'dungeon', 'spire', 'challenge']; // spire = 🗼 무한의 탑 시작 층 (던전 원정 페이지 재사용)
export function navQuery(search, to = {}) {
  const q = new URLSearchParams(search); MODE_KEYS.forEach(k => q.delete(k));
  if (to.town) q.set('town', '1');
  else if (to.dungeon) { q.set('dungeon', '1'); q.set('run', '1'); }
  else if (to.spire) { q.set('dungeon', '1'); q.set('run', '1'); q.set('spire', String(to.spire)); }
  else if (to.stage != null) { q.set('stage', to.stage); q.set('run', '1'); }
  else if (to.challenge) {
    q.set('challenge', '1'); q.set('run', '1');
    // A new run always replaces a stale seed; the resulting URL reproduces its map.
    const previous = Number(q.get('seed')) >>> 0;
    const words = new Uint32Array(1); crypto.getRandomValues(words);
    let seed = words[0] || 1;
    if (seed === previous) seed = (seed % 4294967295) + 1;
    q.set('seed', String(seed));
  }
  return q.toString();
}
let hooks = {}, navigating = null;
export function configureNavigation(next = {}) { hooks = next; }
function navigate(move, delay) {
  if (navigating) return navigating;
  const current = hooks;
  navigating = Promise.resolve().then(async () => {
    current.onWaiting?.(true);
    try {
      if (await current.beforeLeave?.() === false) { current.onCancel?.(); return false; }
      current.onReady?.(); // Start the visual transition only after pending writes settle.
      await new Promise(resolve => setTimeout(resolve, delay)); move(); return true;
    } catch (error) { current.onCancel?.(error); return false; }
    finally { current.onWaiting?.(false); navigating = null; }
  });
  return navigating;
}
export function go(to, delay = 500) { const s = navQuery(location.search, to); return navigate(() => location.replace(location.pathname + '?' + s), delay); }
export function reload(delay = 0) { return navigate(() => location.reload(), delay); }
