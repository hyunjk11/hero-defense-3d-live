import { STAGE } from '../core/grid.js';
import { towerAvailable as waveAvailable } from '../data/towers.js';

const hideBeam = !!STAGE && !STAGE.hard;
export const HARD_BEAM_COLD = .35;
export const HARD_BEAM_HOT = 1.5;
export const hardBeam = STAGE?.hard === true;
export const towerVisible = type => type !== 'guardian' || !hideBeam;
export const towerAvailable = (type, state) => towerVisible(type) && waveAvailable(type, state);
