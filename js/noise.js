/**
 * Procedural noise buffer generators.
 *
 * Algorithms sourced from classic noisehack / Paul Kellet methods.
 * These produce continuous-feeling stochastic signals; the buffer is looped
 * forever, so every generator here has to be *periodic*, not merely long.
 *
 * ## Adding a noise colour (the main extension point in this file)
 *
 * 1. Add a fill function to `GENERATORS` below. It receives the Float32Array to
 *    populate, its length, and the context sample rate, and should write
 *    samples in roughly the −1…1 range.
 * 2. Add the name to `NOISE_TYPES` in constants.js.
 * 3. Add a `<button class="type-btn" data-type="...">` in index.html.
 *
 * app.js wires the button automatically from `data-type`, so no event code
 * needs to change.
 *
 * ## Three rules a new colour has to obey
 *
 * **Match the perceived loudness of the existing colours.** Switching colour
 * mid-session must not change how loud the room is — people are asleep in front
 * of this. Raw RMS is the wrong thing to match on: green's energy sits near
 * 520 Hz where the ear is most sensitive and brown's near 130 Hz where it is
 * not, so at equal RMS green lands several decibels louder. The gains below are
 * set against an *A-weighted* level, the standard low-level loudness
 * approximation, which also happens to agree with how the original three
 * already relate to each other by ear. `tests/run.mjs` measures it, and holds
 * every colour inside ±2 dB of the brown/pink centre.
 *
 * **Leave headroom.** A Gaussian-ish noise of this buffer length peaks around
 * 5.15× its RMS, so an RMS much above 0.18 will clip on the loudest sample. The
 * first cut of green, fan and rain peaked over 1.0.
 *
 * **Be periodic over the buffer, not just long.** Two ways to get this wrong,
 * both of which were measurable:
 *
 * - A filter started from zero state makes a step at every wrap, because
 *   sample 0 comes out of a silent filter and sample N−1 does not. Brown was
 *   doing this before the seam pass below existed: a jump 1.7× larger than
 *   anything else in the signal, every twelve seconds, all night.
 * - An amplitude LFO whose period does not divide the buffer restarts
 *   mid-cycle at every wrap — +0.7 dB (fan) and +1.0 dB (rain) on the first cut
 *   of those two. Derive its rate from `lfoStep()`.
 *
 * ## The seam pass
 *
 * A stable IIR filter fed a periodic input settles into a periodic output, but
 * only once its state has forgotten the silence it started from. So each
 * stateful generator keeps the head of its white-noise sequence in a small
 * scratch array (`seamHead()`), fills the whole buffer, and then runs that head
 * through *again* carrying the state the buffer ended on. The second lap is the
 * state the filter would really have been in on the next time round, so
 * sample 0 now follows sample N−1 continuously; and because the scratch array
 * is far longer than the filter's memory, the first sample past it is
 * continuous too.
 *
 * The per-sample work is deliberately written out inline in each generator
 * rather than handed to a shared callback. Passing a step function to one shared
 * loop reads better and measured six times slower — the call site sees five
 * different closures, so nothing inlines. Buffer generation blocks the main
 * thread during the 150 ms cross-fade of a colour change, so that cost is a
 * visible one. Keep new colours inline too.
 */

import { BUFFER_DURATION, DEFAULTS } from './constants.js';

/**
 * How many samples the seam pass re-filters.
 *
 * It has to be several time constants of the slowest pole used by any generator
 * here. Pink's slowest pole is 0.99886, a time constant of ~877 samples, so
 * 16384 is roughly nineteen of them and the residual mismatch at the join is
 * e⁻¹⁹ — nothing. Raise it if a generator ever grows a slower pole.
 */
const SEAM_WARMUP = 16384;

/**
 * White-noise scratch for the seam pass — the head of the sequence, which each
 * stateful generator consumes twice. 64 KB, versus the megabytes a full copy of
 * the sequence would cost for no extra accuracy.
 *
 * @param {number} length buffer length in samples
 * @returns {Float32Array} samples in −1…1
 */
function seamHead(length) {
  const n = Math.min(SEAM_WARMUP, length);
  const head = new Float32Array(n);
  for (let i = 0; i < n; i++) head[i] = Math.random() * 2 - 1;
  return head;
}

/**
 * Angular step, in radians per sample, for an amplitude LFO that completes a
 * whole number of cycles across the buffer.
 *
 * The buffer loops forever, so an LFO whose period does not divide the buffer
 * length jumps back to its starting phase at every wrap — a step change in
 * level every BUFFER_DURATION seconds, which in an app people sleep to is the
 * one thing that must not happen. Rounding to whole cycles removes it outright,
 * at the cost of pulling the period to the nearest divisor of the buffer, so
 * pick a target that already lands near one.
 *
 * Exported only so `tests/run.mjs` can assert the whole-cycle property
 * directly. It cannot be checked from the samples instead: the wrap step it
 * prevents is around 0.6 dB, and the intended modulation and the noise's own
 * short-window level both move further than that.
 *
 * @param {number} targetPeriodSec the period the sound wants, in seconds
 * @param {number} length buffer length in samples
 * @param {number} sampleRate
 * @returns {number} radians per sample
 */
export function lfoStep(targetPeriodSec, length, sampleRate) {
  const cycles = Math.max(1, Math.round(length / (sampleRate * targetPeriodSec)));
  return 2 * Math.PI * cycles / length;
}

/**
 * Robert Bristow-Johnson constant-skirt bandpass, normalised by a0. `b1` is
 * always zero in this form, so it is not returned.
 *
 * @param {number} f0 centre frequency in Hz
 * @param {number} q
 * @param {number} sampleRate
 * @returns {{b0: number, b2: number, a1: number, a2: number}}
 */
function bandpassCoeffs(f0, q, sampleRate) {
  const w0 = 2 * Math.PI * f0 / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: alpha / a0,
    b2: -alpha / a0,
    a1: (-2 * Math.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
  };
}

/**
 * Smoothing coefficient for a one-pole lowpass at `cutoff`.
 * @param {number} cutoff in Hz
 * @param {number} sampleRate
 * @returns {number} 0…1
 */
function onePoleAlpha(cutoff, sampleRate) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  return dt / (rc + dt);
}

/**
 * Output gains for the three newer colours, set by measurement rather than by
 * ear: each lands its colour inside a decibel of the brown/pink A-weighted
 * centre while keeping the peak under about 0.95. Green sits deliberately a
 * little above centre — it is the only narrow-band colour here, and a single
 * band reads quieter than a broadband one at equal weighted level.
 */
const GREEN_GAIN = 1.28;
const FAN_GAIN = 1.08;
const RAIN_GAIN = 0.72;

/**
 * Sample generators keyed by noise colour.
 *
 * The sample rate is only needed by colours with a frequency-dependent stage;
 * the original three are scale-free and take two arguments. It defaults rather
 * than being required so that a direct call cannot quietly fill a buffer with
 * NaN — silence is the one failure this app must never ship.
 *
 * @type {Record<string, (data: Float32Array, length: number, sampleRate?: number) => void>}
 */
export const GENERATORS = {
  /** Flat spectrum — equal energy per hertz. Stateless, so already periodic. */
  white(data, length) {
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
  },

  /** Brownian / red noise — leaky integrator of white noise (−6 dB/octave). */
  brown(data, length) {
    const head = seamHead(length);
    const warm = head.length;
    let lastOut = 0.0;
    for (let pass = 0; pass < 2; pass++) {
      const end = pass === 0 ? length : warm;
      for (let i = 0; i < end; i++) {
        const white = i < warm ? head[i] : Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
  },

  /** Pink noise — Paul Kellet refined multi-pole approximation (−3 dB/octave). */
  pink(data, length) {
    const head = seamHead(length);
    const warm = head.length;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let pass = 0; pass < 2; pass++) {
      const end = pass === 0 ? length : warm;
      for (let i = 0; i < end; i++) {
        const white = i < warm ? head[i] : Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
  },

  /**
   * Green noise — mid-range emphasis for stream / soft foliage character.
   *
   * Why this shape: white is too bright to listen to for eight hours and brown
   * is too dark to have any texture at all. A moderate-Q bandpass near 520 Hz
   * puts the energy where soft running water and moving leaves live, for the
   * cost of one biquad. Its gain looks low next to the others because 520 Hz is
   * close to where the ear is most sensitive — see the loudness note at the top.
   */
  green(data, length, sampleRate = 44100) {
    const { b0, b2, a1, a2 } = bandpassCoeffs(520, 1.0, sampleRate);
    const head = seamHead(length);
    const warm = head.length;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let pass = 0; pass < 2; pass++) {
      const end = pass === 0 ? length : warm;
      for (let i = 0; i < end; i++) {
        const x0 = i < warm ? head[i] : Math.random() * 2 - 1;
        const y0 = b0 * x0 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = y0;
        data[i] = y0 * GREEN_GAIN;
      }
    }
  },

  /**
   * Fan / airflow — soft mechanical whir.
   *
   * Why this shape: pink for the natural 1/f slope, a gentle one-pole lowpass
   * to take the hiss off it, and an extremely shallow slow LFO for the sense of
   * a blade going round. The cutoff is deliberately no lower than this. Down at
   * a few hundred hertz it stops sounding like moving air and starts sounding
   * like traffic through a wall, and it sheds so much of the band the ear is
   * sensitive to that matching the other colours' loudness needs a gain that
   * clips — at 900 Hz the peak lands at 1.03 before it is even level with pink.
   *
   * The modulation is sub-rhythmic and shallow on purpose: enough that the
   * sound is not dead flat, nowhere near enough to read as a beat. It runs a
   * whole number of cycles per buffer — see `lfoStep()`.
   */
  fan(data, length, sampleRate = 44100) {
    const alphaLp = onePoleAlpha(2600, sampleRate);
    // One slow cycle per buffer. Written as a period that already divides
    // BUFFER_DURATION so `lfoStep` has nothing to round and the number here is
    // the number you hear.
    const lfo = lfoStep(12, length, sampleRate);
    const depth = 0.11;
    const head = seamHead(length);
    const warm = head.length;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lp = 0;
    for (let pass = 0; pass < 2; pass++) {
      const end = pass === 0 ? length : warm;
      for (let i = 0; i < end; i++) {
        const white = i < warm ? head[i] : Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
        lp += alphaLp * (pink - lp);
        data[i] = lp * (1 + depth * Math.sin(i * lfo)) * FAN_GAIN;
      }
    }
  },

  /**
   * Rain — calm continuous rain texture. No thunder, no discrete drops.
   *
   * Why this shape: a brown bed for the steady wet body, a bandpass layer near
   * 1400 Hz for the brighter granular surface, and a very slow swell on the
   * surface layer only. Both layers are driven from one white sequence rather
   * than two — they sit in different bands, so they are uncorrelated where it
   * matters, and it halves the random draws.
   *
   * Everything stays a continuous stochastic process, so there is no event to
   * be startled by and nothing that has to line up with the loop point.
   */
  rain(data, length, sampleRate = 44100) {
    const { b0, b2, a1, a2 } = bandpassCoeffs(1400, 1.2, sampleRate);
    // Two cycles per buffer — again an exact divisor of BUFFER_DURATION.
    const swell = lfoStep(6, length, sampleRate);
    const depth = 0.14;
    const head = seamHead(length);
    const warm = head.length;
    let bed = 0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let pass = 0; pass < 2; pass++) {
      const end = pass === 0 ? length : warm;
      for (let i = 0; i < end; i++) {
        const white = i < warm ? head[i] : Math.random() * 2 - 1;
        bed = (bed + (0.02 * white)) / 1.02;
        const y0 = b0 * white + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = white;
        y2 = y1; y1 = y0;
        const surface = y0 * 0.9 * (1 + depth * Math.sin(i * swell));
        data[i] = (bed * 3.5 * 0.65 + surface) * RAIN_GAIN;
      }
    }
  },
};

/**
 * Generate a mono AudioBuffer filled with the requested noise type.
 *
 * Unknown types fall back to the default colour rather than returning silence,
 * so a typo in a new noise colour is audible and logged instead of producing a
 * dead-quiet player at 2 a.m.
 *
 * @param {BaseAudioContext} ctx
 * @param {string} type one of the keys of GENERATORS
 * @param {number} [durationSec=BUFFER_DURATION]
 * @returns {AudioBuffer}
 */
export function generateNoiseBuffer(ctx, type, durationSec = BUFFER_DURATION) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let generate = GENERATORS[type];
  if (!generate) {
    console.warn(`[complex-noise] unknown noise type "${type}" — falling back to "${DEFAULTS.type}"`);
    generate = GENERATORS[DEFAULTS.type];
  }
  generate(data, length, sampleRate);

  return buffer;
}
