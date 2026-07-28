/**
 * Procedural noise buffer generators.
 *
 * Algorithms sourced from classic noisehack / Paul Kellet methods.
 * These produce continuous-feeling stochastic signals; long buffers make
 * the loop point effectively inaudible.
 *
 * ## Adding a noise colour (the main extension point in this file)
 *
 * 1. Add a fill function to `GENERATORS` below. It receives the Float32Array
 *    to populate, its length, and the sampleRate, and should write samples in roughly the
 *    −1…1 range — aim to match the perceived loudness of the existing colours.
 * 2. Add the name to `NOISE_TYPES` in constants.js.
 * 3. Add a `<button class="type-btn" data-type="...">` in index.html.
 *
 * app.js wires the button automatically from `data-type`, so no event code
 * needs to change.
 */

import { BUFFER_DURATION, DEFAULTS } from './constants.js';

/**
 * Sample generators keyed by noise colour.
 * @type {Record<string, (data: Float32Array, length: number, sampleRate?: number) => void>}
 */
export const GENERATORS = {
  /** Flat spectrum — equal energy per hertz. */
  white(data, length, _sampleRate) {
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
  },

  /** Brownian / red noise — leaky integrator of white noise (−6 dB/octave). */
  brown(data, length, _sampleRate) {
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
  },

  /** Pink noise — Paul Kellet refined multi-pole approximation (−3 dB/octave). */
  pink(data, length, _sampleRate) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  },

  /**
   * Green noise — mid-range emphasis for stream / soft foliage character.
   * Why this shape: pure white is too bright and fatiguing for long listening;
   * brown is too dark. A moderate-Q bandpass centred near 520 Hz on white
   * yields the natural mid focus users associate with soft water or leaves,
   * while remaining fully continuous and cheap to generate.
   */
  green(data, length, sampleRate = 44100) {
    const f0 = 520;
    const Q = 1.0;
    const w0 = 2 * Math.PI * f0 / sampleRate;
    const alpha = Math.sin(w0) / (2 * Q);
    const cosw0 = Math.cos(w0);
    // RBJ bandpass (constant skirt)
    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;
    const nb0 = b0 / a0;
    const nb1 = b1 / a0;
    const nb2 = b2 / a0;
    const na1 = a1 / a0;
    const na2 = a2 / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < length; i++) {
      const x0 = Math.random() * 2 - 1;
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      data[i] = y0 * 1.9;
      x2 = x1; x1 = x0;
      y2 = y1; y1 = y0;
    }
  },

  /**
   * Fan / airflow — soft mechanical whir.
   * Why this shape: start from pink for natural 1/f character, mild low-pass
   * (~900 Hz) to remove hiss, then extremely shallow, slow amplitude LFO
   * (period ~13.5 s, depth 0.11). The modulation is deliberately sub-rhythmic
   * and low-depth so it never becomes a detectable beat or startle source;
   * it simply gives the gentle “fan turning” presence many people find calming.
   */
  fan(data, length, sampleRate = 44100) {
    // Temporary buffer for pink base (one-time generation only; not hot path).
    const pinkBuf = new Float32Array(length);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkBuf[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    // Mild 1-pole lowpass ~900 Hz
    const cutoff = 900;
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sampleRate;
    const alphaLp = dt / (rc + dt);
    let y = 0;
    const period = 13.5;
    const depth = 0.11;
    const twoPiOverPeriod = 2 * Math.PI / (sampleRate * period);
    for (let i = 0; i < length; i++) {
      y = y + alphaLp * (pinkBuf[i] - y);
      const lfo = 1 + depth * Math.sin(i * twoPiOverPeriod);
      data[i] = y * lfo * 1.33;
    }
  },

  /**
   * Rain — calm continuous procedural rain texture (no thunder, no discrete drops).
   * Why this shape: a low brown bed supplies the steady “wet” body; a higher
   * bandpass layer (~1400 Hz) supplies the brighter, more granular texture.
   * Independent very slow amplitude modulation on the texture layer only keeps
   * the surface alive without ever producing a sudden event. Everything remains
   * a continuous stochastic process so the overnight loop is as seamless as
   * the original colours.
   */
  rain(data, length, sampleRate = 44100) {
    // Bed: soft brown
    let lastOut = 0.0;
    const bed = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      bed[i] = lastOut * 3.5 * 0.65;
    }
    // Texture: higher bandpass
    const f0 = 1400;
    const Q = 1.2;
    const w0 = 2 * Math.PI * f0 / sampleRate;
    const alpha = Math.sin(w0) / (2 * Q);
    const cosw0 = Math.cos(w0);
    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;
    const nb0 = b0 / a0;
    const nb1 = b1 / a0;
    const nb2 = b2 / a0;
    const na1 = a1 / a0;
    const na2 = a2 / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const texPeriod = 8.5;
    const twoPiTex = 2 * Math.PI / (sampleRate * texPeriod);
    for (let i = 0; i < length; i++) {
      const x0 = Math.random() * 2 - 1;
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      x2 = x1; x1 = x0;
      y2 = y1; y1 = y0;
      const mod = 0.75 + 0.25 * Math.sin(i * twoPiTex + 0.7);
      data[i] = (bed[i] + y0 * 0.9 * mod) * 1.15;
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
