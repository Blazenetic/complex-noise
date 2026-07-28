/**
 * Energy: what makes the field breathe.
 *
 * Three layers that never line up with each other, which is the whole trick —
 * anything periodic enough to spot is something you will spot at 3 a.m.:
 *
 * 1. a personal breath — each node's own slow sinusoid;
 * 2. a plane wave travelling across the field at an irrational angle, so the
 *    crest never settles into the lattice and never visibly repeats;
 * 3. the audio signal, weighted toward the mid and high bands because those are
 *    where brown, pink and white noise actually differ from one another.
 *
 * Silence leaves layers 1 and 2, which is why the field still lives when the
 * app is paused — just more quietly. That has a consequence the info layer has
 * to respect: with nothing playing, per-node energy tops out at
 * `0.3 + 0.24 = 0.54`, so any gate above that is unreachable while paused.
 */

import { clamp } from '../storage.js';
import { TAU } from './math.js';
import { clock } from './clock.js';

/** Travelling-wave parameters. */
export const WAVE_RATE = 0.55;      // rad/s
export const WAVE_KX = 0.0042;      // rad per world unit
export const WAVE_KY = 0.0042 * 1.6180339887;

/** Smoothing rate (per second) for the value mirrored to CSS. */
export const ENERGY_SMOOTH = 2.4;
/** Energy must move by at least this much before we touch CSS again. */
const ENERGY_EPSILON = 0.002;

/** The field's smoothed 0–1 energy, mirrored to the `--still-energy` variable. */
export const energy = { level: 0 };

let lastPublishedEnergy = -1;

/**
 * Write `--still-energy` only when it has moved perceptibly.
 *
 * Writing a CSS custom property forces a style recalculation for the whole
 * document, so this is one of the two things in the render loop that is
 * deliberately rationed (the other is `getComputedStyle`).
 * @param {number} value 0–1
 */
export function publishEnergy(value) {
  if (Math.abs(value - lastPublishedEnergy) < ENERGY_EPSILON) return;
  lastPublishedEnergy = value;
  document.documentElement.style.setProperty('--still-energy', value.toFixed(4));
}

/**
 * Per-node energy, 0–1.
 * @param {object} n
 * @param {number} audioBoost 0–1, the audio layer, shared by every node
 */
export function computeNodeEnergy(n, audioBoost) {
  const breath = 0.5 + 0.5 * Math.sin(n.phase);
  const wave = 0.5 + 0.5 * Math.sin(clock.drift * WAVE_RATE - (n.x * WAVE_KX + n.y * WAVE_KY));
  return clamp(0.3 * breath + 0.24 * wave + 0.46 * audioBoost, 0, 1);
}

/** Local travelling-wave phase at a node, in radians, wrapped to [0, 2π). */
export function nodeWavePhase(n) {
  const raw = clock.drift * WAVE_RATE - (n.x * WAVE_KX + n.y * WAVE_KY);
  return ((raw % TAU) + TAU) % TAU;
}
