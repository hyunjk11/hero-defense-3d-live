import { STAGE, PRACTICE_SANDBOX } from '../core/grid.js';
import { canSpecialize, upgradeBlock, upgradeCost } from '../data/growth.js';
import { towerAvailable as waveAvailable } from '../data/towers.js';

const hideBeam = !!STAGE && !STAGE.hard;
export const HARD_BEAM_COLD = .35;
export const HARD_BEAM_HOT = 1.5;
export const hardBeam = STAGE?.hard === true || PRACTICE_SANDBOX;
export const towerVisible = type => type !== 'guardian' || !hideBeam;
export const towerAvailable = (type, state) => state.practiceSandbox
  ? type !== 'clear' && !state.dungeon
  : towerVisible(type) && waveAvailable(type, state);
export const towerSpecializable = (tw, sandbox) => sandbox
  ? !!tw && !tw.dead && tw.lvl >= 3 && !tw.branch
  : canSpecialize(tw);
export const towerUpgradeBlock = (tw, gold, sandbox) => sandbox && towerSpecializable(tw, true)
  ? '전문화 선택 필요'
  : upgradeBlock(tw, sandbox ? Infinity : gold);
export const towerUpgradeCost = (tw, sandbox) => sandbox ? 0 : upgradeCost(tw.type, tw.lvl, tw.mods);
