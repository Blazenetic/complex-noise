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
 *    to populate and its length, and should write samples in roughly the
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
 * @type {Record<string, (data: Float32Array, length: number) => void>}
 */
export const GENERATORS = {
  /** Flat spectrum — equal energy per hertz. */
  white(data, length) {
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
  },

  /** Brownian / red noise — leaky integrator of white noise (−6 dB/octave). */
  brown(data, length) {
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
  },

  /** Pink noise — Paul Kellet refined multi-pole approximation (−3 dB/octave). */
  pink(data, length) {
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
  generate(data, length);

  return buffer;
}
