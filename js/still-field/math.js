/**
 * Small mathematical constants and helpers shared across the Still Field.
 *
 * This is a leaf module: it imports nothing and holds no state, so anything in
 * here can be used from any other Still Field module without thinking about
 * load order. Keep it that way — the moment this file needs `settings` or the
 * canvas, it stops being safe to import from everywhere.
 */

/** The golden ratio. Used wherever a schedule must never line up with itself. */
export const PHI = 1.6180339887498949;
export const TAU = Math.PI * 2;
export const RAD_TO_DEG = 180 / Math.PI;

/**
 * Smooth 0→1 ramp; gentler at both ends than a straight line.
 * @param {number} t
 * @returns {number} 0–1
 */
export function smoothstep(t) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}
