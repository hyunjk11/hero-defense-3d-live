// The warning and hit test share the same fixed ground footprint.
export const inDesertCircle = (p, q, radius) => Math.hypot(p.x - q.x, p.z - q.z) <= radius;
export function inDesertLane(p, from, to, width) {
  const dx = to.x - from.x, dz = to.z - from.z, n = dx * dx + dz * dz;
  if (n < 1e-8) return false;
  const t = ((p.x - from.x) * dx + (p.z - from.z) * dz) / n;
  return t >= 0 && t <= 1 && Math.abs((p.x - from.x) * dz - (p.z - from.z) * dx) <= width * .5 * Math.sqrt(n);
}
