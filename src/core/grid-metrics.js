// Shared by map construction and position-based combat modifiers. No mode/DOM dependencies.
export const GW = 24, GH = 16, S = 2;
export const tileX = c => (c - GW / 2 + .5) * S, tileZ = r => (r - GH / 2 + .5) * S;
export const toTile = (x, z) => [Math.floor(x / S + GW / 2), Math.floor(z / S + GH / 2)];
