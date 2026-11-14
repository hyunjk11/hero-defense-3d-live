// The server receipt owns the amount. A failed mail claim remains recoverable in the mailbox.
export async function settleDungeon(entry, floors, win, api) {
  if (entry.mode === 'local') return api.finishLocal(entry.token, floors, win);
  if (entry.mode !== 'ranked') return { ok: true, souls: 0, practice: true, floors, win };
  const result = await api.finish(entry.token, floors, win);
  if (!result.ok || !result.mail) return result;
  try {
    const claim = await api.claim(result.mail, { quiet: true });
    if (claim.ok) { await api.flush(); return { ...result, claimed: true }; }
  } catch (error) { console.warn('dungeon reward kept in mailbox', error); }
  return { ...result, claimed: false };
}
