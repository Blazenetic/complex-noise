/**
 * The callout detail modes, and the schedule that rotates them.
 *
 * The rotation is global — the field walks these modes on a quasi-periodic
 * schedule — but the mode a *given* node displays is that base index offset by
 * the node's own stable `modeOffset` (derived from its lifetime ID in
 * `respawnNode`, so it survives as long as the node does). Eight nodes on
 * screen therefore read eight different quantities at once, and each of them
 * still cycles through the whole set over a few dwells. One global mode meant
 * every callout on screen was a copy of its neighbour, which is a lot of pixels
 * spent saying one thing.
 *
 * **Adding a mode** means adding a name here, a glyph to `MODE_HANDLE` (both
 * arrays must stay the same length), and the branch that fills its rows in
 * `callout-content.js`. The weights and the per-node spread re-derive
 * themselves.
 */

import { PHI } from './math.js';
import { settings } from './settings.js';

export const LABEL_MODE_NAMES = [
  'energy', 'transform', 'velocity', 'projection',
  'wave', 'links', 'lifecycle', 'seed',
];
export const LABEL_MODE_COUNT = LABEL_MODE_NAMES.length;

/**
 * Per-mode handle glyph, drawn on the node the callout belongs to. A square for
 * a transform, a circle for a scalar, a diamond for a phase, a crosshair for a
 * vector: the shape says which family of quantity is being read before the text
 * is legible at all.
 */
export const HANDLE_SQUARE = 0, HANDLE_CIRCLE = 1, HANDLE_DIAMOND = 2, HANDLE_CROSS = 3;
export const MODE_HANDLE = Int8Array.from([
  HANDLE_CIRCLE,   // energy
  HANDLE_SQUARE,   // transform
  HANDLE_CROSS,    // velocity
  HANDLE_SQUARE,   // projection
  HANDLE_DIAMOND,  // wave
  HANDLE_CROSS,    // links
  HANDLE_CIRCLE,   // lifecycle
  HANDLE_DIAMOND,  // seed
]);

/**
 * Per-mode dwell weights, from the golden ratio.
 *
 * A fixed rotation period is the one piece of this visualisation that felt like
 * a `setInterval` rather than a simulation: eight modes, eight seconds each,
 * forever. Weighting each mode by `frac((k + 1)φ)` makes the cycle
 * quasi-periodic instead — every mode gets a different, irrationally-related
 * slice of the cycle, so the rotation never lines up with the travelling wave
 * or with the node lifetimes, and the whole schedule falls out of the same
 * mathematics as the field itself. The weights average 1, so the user's dwell
 * setting is still the mean seconds per mode.
 */
export const MODE_WEIGHTS = new Float32Array(LABEL_MODE_COUNT);
let modeWeightSum = 0;
for (let k = 0; k < LABEL_MODE_COUNT; k++) {
  MODE_WEIGHTS[k] = 0.72 + 0.56 * (((k + 1) * PHI) % 1);
  modeWeightSum += MODE_WEIGHTS[k];
}
// The raw golden-ratio samples only approach a mean of one; for eight modes
// they average about 1.017. Normalise the finite set so the Lab's dwell control
// means exactly what it says, and so adding a mode cannot silently change the
// mean duration of every setting.
const modeWeightScale = LABEL_MODE_COUNT / modeWeightSum;
modeWeightSum = 0;
for (let k = 0; k < LABEL_MODE_COUNT; k++) {
  MODE_WEIGHTS[k] *= modeWeightScale;
  modeWeightSum += MODE_WEIGHTS[k];
}

/** Countdown to the next rotation, written by `modeAt()`. */
export const schedule = { remainingS: 0 };

/**
 * Which detail mode is showing at time `t`, and how long it has left.
 *
 * The schedule is quasi-periodic (see MODE_WEIGHTS), so it cannot be a modulo —
 * it walks the weighted slices of one cycle. Eight iterations, no allocation,
 * and the remaining time falls out of the same walk.
 *
 * @param {number} t seconds on the diagnostics clock
 * @returns {number} mode index; `schedule.remainingS` carries the countdown
 */
export function modeAt(t) {
  const cycle = settings.dwell * modeWeightSum;
  let u = t % cycle;
  for (let k = 0; k < LABEL_MODE_COUNT; k++) {
    const slice = settings.dwell * MODE_WEIGHTS[k];
    if (u < slice) {
      schedule.remainingS = slice - u;
      return k;
    }
    u -= slice;
  }
  schedule.remainingS = 0;
  return LABEL_MODE_COUNT - 1;
}
