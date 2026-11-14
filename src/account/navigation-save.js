// In-app navigation waits for the live document's work. A failed remote request
// remains in the existing account journals; it is not an acknowledgement.
// No new daily entry, reward ID, or save merge is created here.
export async function settleNavigation(Acc, HG, G, report = () => {}) {
  const session = Acc.sessionId(), owner = Acc.A.user?.id, client = Acc.A.sb;
  const same = () => Acc.sessionId() === session && Acc.A.user?.id === owner;
  if (G.xpPendingWrite && !await G.xpPendingWrite) return false;
  if (!same()) return false;
  const saved = !owner || await Acc.flush();
  if (!same()) return false;
  let xp = await HG.retry(); // same durable IDs; waits for an existing XP lock
  if (same() && Acc.serverSaveState?.() && !Acc.A.conflict) {
    await HG.refresh(); // Same receipt: automatically re-read an uncertain commit.
    xp = !HG.HG.pending;
  }
  await client?.drain?.();
  if (!same()) return false;
  // Keep the existing result screen when a hard settlement is still uncertain.
  if (Acc.serverSaveState?.()) return false;
  // Existing offline/conflict recovery remains authoritative. Do not strand a
  // confirmed dungeon entry merely because a subsequent save acknowledgement failed.
  if (!saved || (HG.HG.pending && !xp)) report('서버 확인 대기 중인 진행은 이 기기에 보관되어 있습니다.');
  return true;
}
