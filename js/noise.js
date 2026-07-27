/**
 * Procedural noise buffer generators.
 *
 * Algorithms sourced from classic noisehack / Paul Kellet methods.
 * These produce continuous-feeling stochastic signals; long buffers make
 * the loop point effectively inaudible.
 *
 * Extension point for AI agents: add a new `case` here + a type button
 * in the UI to introduce additional noise colours or variants.
 */

import { BUFFER_DURATION } from './constants.js';

/**
 * Generate a mono AudioBuffer filled with the requested noise type.
 * @param {AudioContext} ctx
 * @param {'white'|'brown'|'pink'} type
 * @param {number} [durationSec=BUFFER_DURATION]
 * @returns {AudioBuffer}
 */
export function generateNoiseBuffer(ctx, type, durationSec = BUFFER_DURATION) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
  } else if (type === 'brown') {
    // Brownian / red noise — leaky integrator of white noise
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }
  } else if (type === 'pink') {
    // Paul Kellet refined multi-pole approximation
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
  }
  return buffer;
}
