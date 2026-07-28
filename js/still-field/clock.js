/**
 * The Still Field's two clocks.
 *
 * There are two of them because there are two questions, and answering both
 * with one number is how a diagnostics readout ends up measuring the user's
 * speed slider:
 *
 * - `drift` is the **animation** clock. It advances at `dt · speed`, so every
 *   position, phase and wave crest is a function of it. Turning the speed up
 *   makes the field move faster precisely because this clock does.
 * - `real` is the **diagnostics** clock. It advances at plain `dt`, so dwell
 *   times, envelopes and "how long has this callout been up" are properties of
 *   the reader rather than of the simulation's speed setting.
 *
 * Both integrate the *accepted* timestep, which is capped at `MAX_STEP_S` (see
 * `loop.js`). On a loaded machine they therefore fall behind the wall clock on
 * purpose — a test that asserts against `Date.now()` is testing the host's
 * spare CPU, which is why `tests/run.mjs` asserts against `real` instead.
 */
export const clock = {
  /** Speed-scaled animation clock, in seconds. */
  drift: 0,
  /** Real accepted time, in seconds. Diagnostics ignore the drift speed. */
  real: 0,
};

/**
 * How often dynamic label strings are rebuilt, in seconds on the real clock.
 *
 * Text is read at human speed, not at canvas speed. Refreshing a callout's rows
 * once a second rather than once a frame is what lets the info layer print
 * changing numbers without building strings at 30–60 fps.
 */
export const VALUE_REFRESH_S = 1;
