import * as Acc from './account.js';
import * as HG from './hero-growth.js';
import { getStage } from '../data/stages.js';
import { cleanTarget } from '../data/repeat-target.js';
import { ls } from '../core/store.js';

const owner = () => Acc.A.user?.id || (Acc.A.mode === 'guest' ? 'guest' : null);
const key = (who, ch) => `hd3d_live_repeat_target_v1_${who}_${ch}`;
export function readTarget(stage) {
  const who = owner(), ch = getStage(stage)?.ch;
  if (HG.sortieSettingsEnabled()) return cleanTarget(HG.HG.growth?.sortieSettings?.repeatTarget?.[ch]);
  return who && ch ? cleanTarget(ls.get(key(who, ch))) : null;
}
export function writeTarget(stage, row) {
  const who = owner(), ch = getStage(stage)?.ch;
  if (!who || !ch) return false;
  if (HG.sortieSettingsEnabled() || Acc.A.user && Acc.A.sb?.serverEconomy && !HG.enabled()) return HG.changeSortieSettings('repeat', cleanTarget(row), { p_chapter: ch });
  try { localStorage.setItem(key(who, ch), cleanTarget(row) || ''); return true; } catch { return false; }
}
