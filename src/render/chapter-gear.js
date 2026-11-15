import { updateAbyssalGear } from './abyssal-gear.js';
import { updateEndgameGear } from './endgame-gear.js';
import { updateMachineGear } from './machine-gear.js';
import { updateStormGear } from './storm-gear.js';
import { updateMorviaGear } from './morvia-gear.js';
import { updateSwampGear } from './swamp-gear.js';
import { updateDesertGear } from './desert-gear.js';
export function updateChapterGear(ch, items) { updateEndgameGear(ch, items); updateSwampGear(ch, items); updateDesertGear(ch, items); updateStormGear(ch, items); updateMachineGear(ch, items); updateMorviaGear(ch, items); updateAbyssalGear(ch, items); }
